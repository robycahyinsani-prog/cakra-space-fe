// format angka dan tanggal untuk tampilan (locale id-ID, zona waktu browser)
export default class Format {
  static rupiah(value) {
    return `Rp ${Number(value || 0).toLocaleString("id-ID")}`;
  }

  // 20000 -> "20rb", 1500000 -> "1,5jt" untuk label slot yang sempit
  static rupiahShort(value) {
    if (value >= 1_000_000) return `${(value / 1_000_000).toLocaleString("id-ID", { maximumFractionDigits: 1 })}jt`;
    if (value >= 1000) return `${(value / 1000).toLocaleString("id-ID", { maximumFractionDigits: 1 })}rb`;
    return String(value);
  }

  // "2026-10-23" dibaca sebagai tanggal lokal, bukan UTC
  static parseDate(iso) {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d);
  }

  static isoDate(date) {
    const pad = (n) => String(n).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  static longDate(iso) {
    return Format.parseDate(iso).toLocaleDateString("id-ID", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }

  static shortDate(iso) {
    return Format.parseDate(iso).toLocaleDateString("id-ID", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
  }

  static dateTime(timestamp) {
    return new Date(timestamp).toLocaleString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  static time(timestamp) {
    return new Date(timestamp).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  }

  // "09:00" -> "09.00" mengikuti penulisan jam di Indonesia
  static clock(hhmm) {
    return hhmm ? hhmm.slice(0, 5).replace(":", ".") : "";
  }

  static hours(minutes) {
    const jam = minutes / 60;
    return `${Number.isInteger(jam) ? jam : jam.toFixed(1)} jam`;
  }
}
