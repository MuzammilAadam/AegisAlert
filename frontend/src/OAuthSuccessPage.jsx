import React, { useEffect, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { AlertCircle, ShieldAlert } from "lucide-react";
import { useAuth } from "./AuthContext";

export default function OAuthSuccessPage() {
  const { completeOAuthSession } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const token = searchParams.get("token");

  useEffect(() => {
    let active = true;
    if (!token) {
      setError("OAuth login did not return a valid token.");
      return;
    }

    completeOAuthSession(token)
      .then(() => {
        if (active) navigate("/dashboard", { replace: true });
      })
      .catch((err) => {
        if (active) setError(err.response?.data?.message || "OAuth login failed.");
      });

    return () => {
      active = false;
    };
  }, [completeOAuthSession, navigate, token]);

  if (!token && !error) return <Navigate to="/login" replace />;

  return (
    <div className="auth-screen">
      <div className="auth-bg-overlay" />
      <div className="auth-card compact-auth-card">
        <div className="auth-logo">
          <div className="auth-logo-icon"><ShieldAlert size={28} /></div>
          <div>
            <h1 className="auth-brand">AegisAlert</h1>
            <p className="auth-brand-sub">Completing secure sign in</p>
          </div>
        </div>

        {error ? (
          <div className="auth-error"><AlertCircle size={16} />{error}</div>
        ) : (
          <div className="auth-processing">
            <span className="auth-spinner large" />
            <span>Signing you in...</span>
          </div>
        )}
      </div>
    </div>
  );
}
