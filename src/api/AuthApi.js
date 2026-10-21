// endpoint akun: register, verifikasi email, login, logout, reset password
export default class AuthApi {
  constructor(client) {
    this.client = client;
  }

  login(email, password) {
    return this.client.post("/auth/login", { email, password });
  }

  register({ name, email, password, confirm }) {
    // role tidak dikirim, registrasi selalu menghasilkan akun member
    return this.client.post("/auth/register", {
      name,
      email,
      password,
      password_confirmation: confirm,
    });
  }

  verifyEmail(token) {
    return this.client.post("/auth/verify-email", { token });
  }

  resendVerification(email) {
    return this.client.post("/auth/resend-verification", { email });
  }

  forgotPassword(email) {
    return this.client.post("/auth/forgot-password", { email });
  }

  resetPassword(token, password, confirm) {
    return this.client.post("/auth/reset-password", {
      token,
      new_password: password,
      password_confirmation: confirm,
    });
  }

  // juga dipakai staf baru untuk mengganti password sementara, respons berisi token baru
  changePassword(current, password, confirm) {
    return this.client.post("/auth/change-password", {
      current_password: current,
      new_password: password,
      password_confirmation: confirm,
    });
  }

  logout() {
    return this.client.post("/auth/logout");
  }

  me() {
    return this.client.get("/me");
  }
}
