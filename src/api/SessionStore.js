// token JWT dan data user disimpan di localStorage (task FE-02)
export default class SessionStore {
  constructor(storage = window.localStorage) {
    this.storage = storage;
  }

  get token() {
    return this.storage.getItem("token");
  }

  get user() {
    try {
      const raw = this.storage.getItem("user");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  save(token, user) {
    this.storage.setItem("token", token);
    this.storage.setItem("user", JSON.stringify(user));
  }

  saveUser(user) {
    this.storage.setItem("user", JSON.stringify(user));
  }

  clear() {
    this.storage.removeItem("token");
    this.storage.removeItem("user");
  }
}
