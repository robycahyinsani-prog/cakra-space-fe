"""Tugas terjadwal. Jalankan `python -m app.jobs` lewat cron, misalnya setiap 5 menit."""

import json

from app.container import Container
from app.core.config import get_settings


def main() -> None:
    container = Container(get_settings())
    container.bootstrap()
    print(json.dumps(container.jobs.run_all(), indent=1))


if __name__ == "__main__":
    main()
