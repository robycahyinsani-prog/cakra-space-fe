import axios from "axios";
import ApiError from "./ApiError";

// pembungkus axios: pasang token, rapikan error, beri tahu saat sesi habis
export default class ApiClient {
  constructor(baseURL, session) {
    this.session = session;
    this.onUnauthorized = null;
    this.http = axios.create({ baseURL, timeout: 15000 });

    this.http.interceptors.request.use((config) => {
      const token = this.session.token;
      if (token) config.headers.Authorization = `Bearer ${token}`;
      return config;
    });

    this.http.interceptors.response.use(
      (response) => response,
      (error) => {
        const apiError = ApiError.fromAxios(error);
        const pakaiToken = Boolean(error.config?.headers?.Authorization);
        if (apiError.status === 401 && pakaiToken && this.onUnauthorized) {
          this.onUnauthorized();
        }
        return Promise.reject(apiError);
      }
    );
  }

  async get(url, params) {
    const { data } = await this.http.get(url, { params });
    return data;
  }

  async post(url, body) {
    const { data } = await this.http.post(url, body);
    return data;
  }

  async put(url, body) {
    const { data } = await this.http.put(url, body);
    return data;
  }

  async patch(url, body) {
    const { data } = await this.http.patch(url, body);
    return data;
  }

  async delete(url) {
    const { data } = await this.http.delete(url);
    return data;
  }

  async upload(url, file) {
    const form = new FormData();
    form.append("file", file);
    const { data } = await this.http.put(url, form);
    return data;
  }

  async blob(url, params) {
    const { data } = await this.http.get(url, { params, responseType: "blob" });
    return data;
  }
}
