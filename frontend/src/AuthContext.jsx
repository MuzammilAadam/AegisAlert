import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]     = useState(null);
  const [token, setToken]   = useState(() => localStorage.getItem("aegis_token"));
  const [loading, setLoading] = useState(true);

  // Restore session from stored token
  useEffect(() => {
    if (!token) { setLoading(false); return; }
    axios
      .get(`${API_BASE_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => setUser(res.data.user))
      .catch(() => { localStorage.removeItem("aegis_token"); setToken(null); })
      .finally(() => setLoading(false));
  }, [token]);

  const login = useCallback(async (email, password) => {
    const res = await axios.post(`${API_BASE_URL}/api/auth/login`, { email, password });
    const { token: newToken, user: newUser } = res.data;
    localStorage.setItem("aegis_token", newToken);
    setToken(newToken);
    setUser(newUser);
    return newUser;
  }, []);

  const signup = useCallback(async (name, email, password, city) => {
    const res = await axios.post(`${API_BASE_URL}/api/auth/signup`, { name, email, password, city });
    const { token: newToken, user: newUser } = res.data;
    localStorage.setItem("aegis_token", newToken);
    setToken(newToken);
    setUser(newUser);
    return newUser;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("aegis_token");
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, loading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
