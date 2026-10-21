// label tampilan untuk nilai enum dari API

export const AREA_TYPES = {
  hot_desk: "Hot Desk",
  dedicated_desk: "Dedicated Desk",
  meeting_room: "Ruang Rapat",
};

export const PAYMENT_METHODS = {
  virtual_account: "Virtual Account",
  e_wallet: "E-Wallet",
  credit_card: "Kartu Kredit",
};

export const SLOT_STATUS = {
  available: "Tersedia",
  booked: "Terisi",
  past: "Lewat",
  closed: "Tutup",
};

export const AREA_STATUS = {
  available: "Tersedia",
  maintenance: "Perawatan",
  inactive: "Nonaktif",
};

export const BUILDING_STATUS = {
  draft: "Draf",
  active: "Aktif",
  inactive: "Nonaktif",
};

export const DEVICE_TYPES = {
  qr_reader: "Pembaca QR",
  door_lock: "Kunci Pintu",
};

export const DEVICE_COMMANDS = {
  unlock: "Buka Pintu",
  restart: "Restart",
};

export const CREDENTIALS = {
  member_qr: "QR Member",
  guest_qr: "QR Tamu",
};

export const DISCOUNT_TYPES = {
  percent: "Persen (%)",
  amount: "Nominal (Rp)",
};
