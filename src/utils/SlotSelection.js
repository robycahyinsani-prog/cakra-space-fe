// pilihan slot = rentang jam berurutan di satu area, disimpan sebagai indeks slot
export default class SlotSelection {
  constructor(areaId, start, length) {
    this.areaId = areaId;
    this.start = start;
    this.length = length;
  }

  get last() {
    return this.start + this.length - 1;
  }

  contains(areaId, index) {
    return areaId === this.areaId && index >= this.start && index <= this.last;
  }

  // jam mulai dan selesai yang dikirim ke API
  range(slots) {
    return { start_time: slots[this.start].start_time, end_time: slots[this.last].end_time };
  }

  // rentang yang melewati jam tutup (di luar array) juga dianggap tidak tersedia
  static allAvailable(slots, start, length) {
    if (start < 0 || start + length > slots.length) return false;
    return slots.slice(start, start + length).every((s) => s.status === "available");
  }

  // klik pertama memilih satu jam, klik jam lain memperluas rentang selama jam di antaranya kosong,
  // klik ujung rentang memperpendek, klik jam satu-satunya membatalkan pilihan
  static click(current, areaId, index, slots) {
    const sel = current && current.areaId === areaId ? current : null;
    if (!sel) return new SlotSelection(areaId, index, 1);
    if (sel.length === 1 && index === sel.start) return null;
    if (index === sel.start) return new SlotSelection(areaId, sel.start + 1, sel.length - 1);
    if (index === sel.last) return new SlotSelection(areaId, sel.start, sel.length - 1);
    if (sel.contains(areaId, index)) return new SlotSelection(areaId, index, 1);

    const start = Math.min(sel.start, index);
    const length = Math.max(sel.last, index) - start + 1;
    if (SlotSelection.allAvailable(slots, start, length)) return new SlotSelection(areaId, start, length);
    return new SlotSelection(areaId, index, 1);
  }

  // reschedule: durasi tetap, klik jam mulai langsung memilih blok sepanjang durasi booking awal
  static block(areaId, index, length, slots) {
    return SlotSelection.allAvailable(slots, index, length) ? new SlotSelection(areaId, index, length) : null;
  }

  // pilihan dari query URL (setelah kembali dari login) dipulihkan kalau slotnya masih kosong
  static fromRange(areaId, slots, startTime, endTime) {
    const start = slots.findIndex((s) => s.start_time === startTime);
    const last = slots.findIndex((s) => s.end_time === endTime);
    if (start < 0 || last < start) return null;
    const length = last - start + 1;
    return SlotSelection.allAvailable(slots, start, length) ? new SlotSelection(areaId, start, length) : null;
  }
}
