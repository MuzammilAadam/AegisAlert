import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [token, setToken]     = useState(() => localStorage.getItem("aegis_token"));
  const [loading, setLoading] = useState(true);

  // Restore session from stored token
  useEffect(() => {
    if (!token) { setLoading(false); return; }
    axios
      .get(`${API_BASE_URL}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => setUser(res.data.user))
      .catch(() => { localStorage.removeItem("aegis_token"); setToken(null); })
      .finally(() => setLoading(false));
  }, [token]);

  function persistSession(newToken, newUser) {
    localStorage.setItem("aegis_token", newToken);
    setToken(newToken);
    setUser(newUser);
  }

  function persistUser(newUser) {
    setUser(newUser);
  }

  const completeOAuthSession = useCallback(async (newToken) => {
    const res = await axios.get(`${API_BASE_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${newToken}` },
    });
    persistSession(newToken, res.data.user);
    return res.data.user;
  }, []);

  /* ── Signup flow ── */
  const signupSendOtp = useCallback(async (name, email, password, city) => {
    await axios.post(`${API_BASE_URL}/api/auth/signup/send-otp`, { name, email, password, city });
  }, []);

  const signupVerifyOtp = useCallback(async (email, otp) => {
    const res = await axios.post(`${API_BASE_URL}/api/auth/signup/verify-otp`, { email, otp });
    persistSession(res.data.token, res.data.user);
    return res.data.user;
  }, []);

  /* ── Login flow ── */
  const loginSendOtp = useCallback(async (email, password) => {
    await axios.post(`${API_BASE_URL}/api/auth/login/send-otp`, { email, password });
  }, []);

  const loginVerifyOtp = useCallback(async (email, otp) => {
    const res = await axios.post(`${API_BASE_URL}/api/auth/login/verify-otp`, { email, otp });
    persistSession(res.data.token, res.data.user);
    return res.data.user;
  }, []);

  const forgotPassword = useCallback(async (email) => {
    const res = await axios.post(`${API_BASE_URL}/api/auth/password/forgot`, { email });
    return res.data;
  }, []);

  const resetPassword = useCallback(async (email, otp, password) => {
    await axios.post(`${API_BASE_URL}/api/auth/password/reset`, { email, otp, password });
  }, []);

  const requestSetPassword = useCallback(async (email) => {
    const res = await axios.post(`${API_BASE_URL}/api/auth/password/set/request`, { email });
    return res.data;
  }, []);

  const confirmSetPassword = useCallback(async (email, otp, password) => {
    await axios.post(`${API_BASE_URL}/api/auth/password/set/confirm`, { email, otp, password });
  }, []);

  const completeOAuthCity = useCallback(async (city, oauthToken) => {
    const activeToken = oauthToken || token;
    const res = await axios.post(
      `${API_BASE_URL}/api/auth/oauth/city`,
      { city },
      { headers: { Authorization: `Bearer ${activeToken}` } }
    );
    persistSession(res.data.token, res.data.user);
    return res.data.user;
  }, [token]);

  const getProfile = useCallback(async () => {
    const res = await axios.get(`${API_BASE_URL}/api/auth/profile`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    persistUser(res.data.user);
    return res.data.user;
  }, [token]);

  const updateProfile = useCallback(async ({ name, city }) => {
    const res = await axios.put(
      `${API_BASE_URL}/api/auth/profile`,
      { name, city },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    persistSession(res.data.token, res.data.user);
    return res.data;
  }, [token]);

  const changePassword = useCallback(async ({ oldPassword, newPassword }) => {
    const res = await axios.put(
      `${API_BASE_URL}/api/auth/profile/password`,
      { oldPassword, newPassword },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    persistUser(res.data.user);
    return res.data;
  }, [token]);

  const updateTelegram = useCallback(async ({ telegramChatId, telegramEnabled }) => {
    const res = await axios.put(
      `${API_BASE_URL}/api/auth/telegram`,
      { telegramChatId, telegramEnabled },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    persistUser(res.data.user);
    return res.data;
  }, [token]);

  const getTelegramStatus = useCallback(async () => {
    const res = await axios.get(`${API_BASE_URL}/api/auth/telegram/status`);
    return res.data;
  }, []);

  const sendTelegramTest = useCallback(async () => {
    const res = await axios.post(
      `${API_BASE_URL}/api/auth/telegram/test`,
      {},
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return res.data;
  }, [token]);

  const startOAuth = useCallback((provider) => {
    window.location.href = `${API_BASE_URL}/api/auth/${provider}`;
  }, []);

  /* ── Logout ── */
  const logout = useCallback(() => {
    localStorage.removeItem("aegis_token");
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        signupSendOtp,
        signupVerifyOtp,
        loginSendOtp,
        loginVerifyOtp,
        forgotPassword,
        resetPassword,
        requestSetPassword,
        confirmSetPassword,
        completeOAuthSession,
        completeOAuthCity,
        getProfile,
        updateProfile,
        changePassword,
        updateTelegram,
        getTelegramStatus,
        sendTelegramTest,
        startOAuth,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
