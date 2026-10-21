import os
import tempfile
from dataclasses import replace
from datetime import date, time, timedelta
from pathlib import Path

os.environ["SECRET_KEY"] = "kunci-uji-yang-panjang-dan-acak-0123456789abcdef"
os.environ["DATA_FILE"] = str(Path(tempfile.mkdtemp()) / "import.json")
os.environ["CRON_SECRET"] = "cron-uji"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.core.clock import clock  # noqa: E402
from app.core.config import Settings  # noqa: E402
from app.core.deps import limiter  # noqa: E402
from app.db.json_store import JsonStore  # noqa: E402
from app.main import create_app  # noqa: E402
from app.models.account import User, UserBuilding  # noqa: E402
from app.models.enums import AreaType, BenefitType, BuildingStatus, Role  # noqa: E402
from app.models.location import Area, Building, Floor  # noqa: E402
from app.models.membership import Plan, PlanBenefit  # noqa: E402
from app.services.locations import Schedule  # noqa: E402

PASSWORD = "Rahasia123"
TZ = "Asia/Jakarta"


class World:
    """Pembuat data uji langsung lewat repository supaya test fokus pada perilaku yang diuji."""

    def __init__(self, c):
        self.c = c
        self.hash = c.hasher.hash(PASSWORD)

    def user(self, email: str, role: Role = Role.MEMBER, verified: bool = True, buildings=(), name=None) -> User:
        with self.c.store.write() as tx:
            u = tx.users.add(
                User(
                    email=email,
                    name=name or email.split("@")[0].title(),
                    role=role,
                    is_verified=verified,
                    password_hash=self.hash,
                )
            )
            tx.user_buildings.add_many(UserBuilding(user_id=u.id, building_id=b.id) for b in buildings)
            return u

    def building(self, code: str = "DGO", status: BuildingStatus = BuildingStatus.ACTIVE, **extra) -> Building:
        with self.c.store.write() as tx:
            b = tx.buildings.add(
                Building(
                    code=code,
                    name=f"Cakra Space {code}",
                    address="Jl. Uji No. 1",
                    city="Bandung",
                    status=status,
                    timezone=TZ,
                    **extra,
                )
            )
            tx.operating_hours.add_many(Schedule.default_hours(b.id))
            tx.floors.add(Floor(building_id=b.id, name="Lantai 1", level=1))
            return b

    def floor(self, building: Building) -> Floor:
        with self.c.store.read() as tx:
            return tx.floors.first(building_id=building.id)

    def area(
        self,
        building: Building,
        code: str = "A1",
        type: AreaType = AreaType.HOT_DESK,
        capacity: int = 1,
        price_per_hour: int = 20_000,
        price_per_day: int = 120_000,
    ) -> Area:
        lantai = self.floor(building)
        with self.c.store.write() as tx:
            return tx.areas.add(
                Area(
                    building_id=building.id,
                    floor_id=lantai.id,
                    code=code,
                    name=f"Area {code}",
                    type=type,
                    capacity=capacity,
                    price_per_hour=price_per_hour,
                    price_per_day=price_per_day,
                    pos_x=10,
                    pos_y=10,
                )
            )

    def plan(self, name="Member Bulanan", price=1_500_000, hours=10, buildings=(), days=30) -> Plan:
        with self.c.store.write() as tx:
            p = tx.plans.add(Plan(name=name, duration_days=days, price=price, building_ids=[b.id for b in buildings]))
            tx.plan_benefits.add(PlanBenefit(plan_id=p.id, benefit_type=BenefitType.MEETING_ROOM_HOURS, quantity=hours))
            return p

    def headers(self, user: User) -> dict:
        with self.c.store.read() as tx:
            u = tx.users.require(user.id)
        token, _ = self.c.tokens.issue(u.id, u.role, u.token_version)
        return {"Authorization": f"Bearer {token}"}

    @staticmethod
    def open_day(min_days: int = 2) -> date:
        """Hari kerja (Senin-Sabtu) paling cepat min_days ke depan."""
        hari = clock.local_today(TZ) + timedelta(days=min_days)
        while hari.weekday() == 6:
            hari += timedelta(days=1)
        return hari

    def mailbox(self, email: str) -> list:
        with self.c.store.read() as tx:
            return sorted(tx.notifications.where(to_email=email), key=lambda n: n.id)

    @staticmethod
    def booking_body(area: Area, day: date, start: int = 9, end: int = 11, **extra) -> dict:
        return {
            "area_id": area.id,
            "date": day.isoformat(),
            "start_time": time(start).isoformat(),
            "end_time": time(end).isoformat(),
            **extra,
        }

    def book(self, client, user: User, area: Area, day: date, start: int = 9, end: int = 11, **extra) -> dict:
        r = client.post(
            "/api/v1/bookings", json=self.booking_body(area, day, start, end, **extra), headers=self.headers(user)
        )
        assert r.status_code == 201, r.text
        return r.json()

    def pay(
        self,
        client,
        user: User,
        purpose: str,
        reference_id: int | None,
        outcome: str = "success",
        method: str = "virtual_account",
        **extra,
    ) -> dict:
        r = client.post(
            "/api/v1/payments",
            json={"purpose": purpose, "reference_id": reference_id, "method": method, **extra},
            headers=self.headers(user),
        )
        assert r.status_code == 201, r.text
        data = r.json()
        if data["payment"] is None:
            return data
        hasil = client.post(f"/api/v1/sandbox/payments/{data['payment']['gateway_ref']}/{outcome}")
        assert hasil.status_code == 200, hasil.text
        return {**data, "webhook": hasil.json()}


@pytest.fixture
def app(tmp_path):
    settings = replace(
        Settings(), data_file=tmp_path / "db.json", upload_dir=tmp_path / "uploads", export_dir=tmp_path / "exports"
    )
    application = create_app(settings, JsonStore(settings.data_file))
    limiter.enabled = False
    yield application
    clock.reset()


@pytest.fixture
def client(app):
    return TestClient(app)


@pytest.fixture
def c(app):
    return app.state.container


@pytest.fixture
def world(c):
    return World(c)


@pytest.fixture
def dago(world):
    return world.building("DGO")


@pytest.fixture
def admin(world):
    return world.user("admin@cakraspace.id", Role.CENTRAL_MANAGER)


@pytest.fixture
def member(world):
    return world.user("budi@example.com")
