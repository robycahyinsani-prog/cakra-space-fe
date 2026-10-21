import { useCallback, useEffect, useMemo, useState } from "react";
import { AuthContext } from "./AuthContext";
import { api, client, session } from "../api";

export function AuthProvider({ children }) {
  // sesi dibaca dari localStorage saat aplikasi pertama dibuka
  const [state, setState] = useState(() => ({ token: session.token, user: session.user }));

  const clear = useCallback(() => {
    session.clear();
    setState({ token: null, user: null });
  }, []);

  const applyUser = useCallback((user) => {
    session.saveUser(user);
    setState((prev) => ({ ...prev, user }));
    return user;
  }, []);

  // result = respons POST /auth/login (access_token, user, landing)
  const login = useCallback((result) => {
    session.save(result.access_token, result.user);
    setState({ token: result.access_token, user: result.user });
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.auth.logout();
    } catch {
      // token mungkin sudah kedaluwarsa, sesi lokal tetap dihapus
    }
    clear();
  }, [clear]);

  const refreshUser = useCallback(() => api.auth.me().then(applyUser), [applyUser]);

  // token ditolak server (kedaluwarsa/dicabut) maka sesi lokal dibersihkan
  useEffect(() => {
    client.onUnauthorized = clear;
    return () => {
      client.onUnauthorized = null;
    };
  }, [clear]);

  // data user disegarkan sekali, misalnya status verifikasi email
  useEffect(() => {
    if (session.token) api.auth.me().then(applyUser, () => {});
  }, [applyUser]);

  const value = useMemo(
    () => ({
      user: state.user,
      token: state.token,
      isAuthenticated: Boolean(state.token),
      isStaff: Boolean(state.user && state.user.role !== "member"),
      login,
      logout,
      refreshUser,
    }),
    [state, login, logout, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
