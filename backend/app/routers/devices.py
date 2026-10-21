from fastapi import APIRouter, Depends

from app.container import Container
from app.core.deps import current_device, get_container, staff_user
from app.models.account import User
from app.models.operations import Device
from app.schemas.commerce import CommandIn, CommandResultIn, DeviceIn, MaintenanceIn

router = APIRouter(prefix="/api/v1", tags=["devices"])


@router.post(
    "/manage/devices", status_code=201, summary="Daftarkan pembaca QR atau kunci pintu, API key tampil sekali (BE-48)"
)
def register_device(body: DeviceIn, actor: User = Depends(staff_user), c: Container = Depends(get_container)):
    return c.devices.register(actor, body.building_id, body.name, body.type, body.door)


@router.get("/manage/devices", summary="Perangkat beserta status online, offline atau dicabut (BE-49)")
def list_devices(
    building_id: int | None = None, actor: User = Depends(staff_user), c: Container = Depends(get_container)
):
    return c.devices.list(actor, building_id)


@router.post("/manage/devices/{device_id}/revoke", summary="Cabut API key perangkat (BE-48)")
def revoke_device(device_id: int, actor: User = Depends(staff_user), c: Container = Depends(get_container)):
    return c.devices.revoke(actor, device_id)


@router.post(
    "/manage/devices/{device_id}/commands",
    status_code=201,
    summary="Buka pintu atau restart perangkat dari panel (BE-50)",
)
def send_command(
    device_id: int, body: CommandIn, actor: User = Depends(staff_user), c: Container = Depends(get_container)
):
    return c.devices.send_command(actor, device_id, body.command)


@router.get("/manage/devices/{device_id}/commands", summary="Riwayat perintah perangkat")
def list_commands(device_id: int, actor: User = Depends(staff_user), c: Container = Depends(get_container)):
    return c.devices.commands(actor, device_id)


@router.post("/manage/devices/{device_id}/maintenances", status_code=201, summary="Catat perbaikan perangkat (BE-51)")
def add_maintenance(
    device_id: int, body: MaintenanceIn, actor: User = Depends(staff_user), c: Container = Depends(get_container)
):
    return c.devices.add_maintenance(actor, device_id, body.date, body.issue, body.action, body.technician)


@router.get("/manage/devices/{device_id}/maintenances", summary="Riwayat maintenance perangkat (BE-51)")
def list_maintenances(device_id: int, actor: User = Depends(staff_user), c: Container = Depends(get_container)):
    return c.devices.maintenances(actor, device_id)


# endpoint yang dipanggil perangkat, autentikasi lewat header X-Device-Key


@router.post("/device/heartbeat", tags=["device api"], summary="Heartbeat perangkat setiap 1 menit (BE-49)")
def heartbeat(device: Device = Depends(current_device), c: Container = Depends(get_container)):
    return c.devices.heartbeat(device)


@router.get("/device/commands", tags=["device api"], summary="Ambil perintah yang menunggu (polling, BE-50)")
def poll_commands(device: Device = Depends(current_device), c: Container = Depends(get_container)):
    return c.devices.poll(device)


@router.post("/device/commands/{command_id}/result", tags=["device api"], summary="Laporkan hasil perintah")
def command_result(
    command_id: int,
    body: CommandResultIn,
    device: Device = Depends(current_device),
    c: Container = Depends(get_container),
):
    return c.devices.complete(device, command_id, body.success, body.result)
