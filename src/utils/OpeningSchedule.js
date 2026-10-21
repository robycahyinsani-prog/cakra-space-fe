import Format from "./Format";

// jam operasional dan hari libur gedung, dipakai strip tanggal di halaman booking
export default class OpeningSchedule {
  constructor(operatingHours = [], holidays = []) {
    this.hours = operatingHours;
    this.holidays = new Map(holidays.map((h) => [h.date, h.description]));
  }

  dayInfo(date) {
    const iso = Format.isoDate(date);
    // weekday dari API: 0 = Senin, getDay() JS: 0 = Minggu
    const weekday = (date.getDay() + 6) % 7;
    const jam = this.hours.find((h) => h.weekday === weekday);
    const libur = this.holidays.get(iso);
    const closed = Boolean(libur) || !jam || jam.is_closed;
    return {
      iso,
      date,
      closed,
      note: libur || (closed ? "Tutup" : `${Format.clock(jam.open_time)}-${Format.clock(jam.close_time)}`),
    };
  }

  nextDays(count, from = new Date()) {
    return Array.from({ length: count }, (_, i) => {
      const date = new Date(from.getFullYear(), from.getMonth(), from.getDate() + i);
      return this.dayInfo(date);
    });
  }
}
