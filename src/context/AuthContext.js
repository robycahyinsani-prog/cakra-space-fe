import { createContext, useContext } from "react";

// context dipisah dari AuthProvider.jsx supaya file komponen hanya mengekspor komponen (fast refresh)
export const AuthContext = createContext(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth harus dipakai di dalam AuthProvider");
  }
  return context;
}
