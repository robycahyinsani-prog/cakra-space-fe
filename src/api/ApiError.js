// error dari API dirapikan jadi satu bentuk: status, code, message, fieldErrors
export default class ApiError extends Error {
  constructor({ status = 0, code = null, message, fieldErrors = {}, extra = {} }) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
    this.extra = extra;
  }

  static fromAxios(error) {
    if (!error.response) {
      return new ApiError({
        message: "Tidak bisa terhubung ke server API. Pastikan backend sudah berjalan.",
      });
    }
    const { status, data } = error.response;
    const detail = data?.detail;

    // 422 dari FastAPI berupa daftar error per field
    if (Array.isArray(detail)) {
      const fieldErrors = {};
      for (const item of detail) {
        const field = item.loc?.[item.loc.length - 1];
        const pesan = String(item.msg || "").replace(/^Value error, /, "");
        if (field && !fieldErrors[field]) fieldErrors[field] = pesan;
      }
      return new ApiError({
        status,
        message: Object.values(fieldErrors)[0] || "Data yang dikirim belum valid",
        fieldErrors,
      });
    }

    const { code = null, ...extra } = data || {};
    delete extra.detail;
    return new ApiError({
      status,
      code,
      message: typeof detail === "string" ? detail : "Terjadi kesalahan pada server",
      extra,
    });
  }
}
