import React, { useEffect, useMemo, useState } from "react";
import Select from "react-select";
import { Link, useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle,
  Eye,
  EyeOff,
  Github,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  MapPin,
  MessageCircle,
  Pencil,
  Save,
  Send,
  ShieldAlert,
  User,
  X,
  Chrome,
} from "lucide-react";
import { useAuth } from "./AuthContext";
import { searchCityOptions } from "./cities";

function providerLabel(provider) {
  if (provider === "google") return "Google";
  if (provider === "github") return "GitHub";
  return "Email";
}

function ProviderIcon({ provider, size = 18 }) {
  if (provider === "google") return <Chrome size={size} />;
  if (provider === "github") return <Github size={size} />;
  return <Mail size={size} />;
}

function ProfileAvatar({ user, className = "" }) {
  const initials = String(user?.name || user?.email || "U")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return (
    <div className={`profile-avatar ${className}`}>
      {user?.profilePicture ? (
        <img src={user.profilePicture} alt={`${user.name || "User"} profile`} referrerPolicy="no-referrer" />
      ) : (
        <span>{initials || "U"}</span>
      )}
    </div>
  );
}

function Notice({ type, children }) {
  if (!children) return null;
  const Icon = type === "success" ? CheckCircle : AlertCircle;
  return (
    <div className={`profile-notice ${type}`} role={type === "success" ? "status" : "alert"}>
      <Icon size={17} />
      {children}
    </div>
  );
}

export default function ProfilePage() {
  const {
    user,
    getProfile,
    updateProfile,
    changePassword,
    updateTelegram,
    getTelegramStatus,
    sendTelegramTest,
    logout,
  } = useAuth();
  const navigate = useNavigate();

  const [profile, setProfile] = useState(user);
  const [profileLoading, setProfileLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ name: user?.name || "", city: user?.city || "" });
  const [cityOption, setCityOption] = useState(user?.city ? { value: user.city, label: user.city } : null);
  const [cityInput, setCityInput] = useState("");
  const [cityOptions, setCityOptions] = useState([]);
  const [citiesLoading, setCitiesLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [notice, setNotice] = useState({ type: "", message: "" });
  const [passwordNotice, setPasswordNotice] = useState({ type: "", message: "" });
  const [passwordForm, setPasswordForm] = useState({ oldPassword: "", newPassword: "", confirmPassword: "" });
  const [showPasswords, setShowPasswords] = useState(false);

  // Telegram state
  const [telegramChatId, setTelegramChatId] = useState("");
  const [telegramEnabled, setTelegramEnabled] = useState(false);
  const [telegramSaving, setTelegramSaving] = useState(false);
  const [telegramNotice, setTelegramNotice] = useState({ type: "", message: "" });
  const [telegramToggling, setTelegramToggling] = useState(false);
  const [telegramTesting, setTelegramTesting] = useState(false);
  const [telegramBot, setTelegramBot] = useState({ configured: false, username: "" });

  const hasPassword = Boolean(profile?.hasPassword);
  const authProvider = providerLabel(profile?.authProvider);

  const profileStats = useMemo(
    () => [
      { label: "Email", value: profile?.email || "--", icon: Mail },
      { label: "Alert City", value: profile?.city || "--", icon: MapPin },
      { label: "Provider", value: authProvider, icon: profile?.authProvider === "github" ? Github : profile?.authProvider === "google" ? Chrome : Mail },
    ],
    [authProvider, profile]
  );

  useEffect(() => {
    let active = true;
    setProfileLoading(true);

    getProfile()
      .then((freshProfile) => {
        if (!active) return;
        setProfile(freshProfile);
        setForm({ name: freshProfile.name || "", city: freshProfile.city || "" });
        setCityOption(freshProfile.city ? { value: freshProfile.city, label: freshProfile.city } : null);
        setTelegramChatId(freshProfile.telegramChatId || "");
        setTelegramEnabled(Boolean(freshProfile.telegramEnabled));
      })
      .catch((err) => {
        if (active) setNotice({ type: "error", message: err.response?.data?.message || "Could not load profile." });
      })
      .finally(() => {
        if (active) setProfileLoading(false);
      });

    return () => {
      active = false;
    };
  }, [getProfile]);

  useEffect(() => {
    let active = true;

    getTelegramStatus()
      .then((status) => {
        if (active) setTelegramBot(status);
      })
      .catch(() => {
        if (active) setTelegramBot({ configured: false, username: "" });
      });

    return () => {
      active = false;
    };
  }, [getTelegramStatus]);

  useEffect(() => {
    let active = true;
    setCitiesLoading(true);

    searchCityOptions(cityInput)
      .then((options) => {
        if (active) setCityOptions(options);
      })
      .catch(() => {
        if (active) setCityOptions([]);
      })
      .finally(() => {
        if (active) setCitiesLoading(false);
      });

    return () => {
      active = false;
    };
  }, [cityInput]);

  function openEditModal() {
    setForm({ name: profile?.name || "", city: profile?.city || "" });
    setCityOption(profile?.city ? { value: profile.city, label: profile.city } : null);
    setNotice({ type: "", message: "" });
    setModalOpen(true);
  }

  function closeEditModal() {
    if (saving) return;
    setModalOpen(false);
    setForm({ name: profile?.name || "", city: profile?.city || "" });
    setCityOption(profile?.city ? { value: profile.city, label: profile.city } : null);
  }

  function handleCityChange(option) {
    setCityOption(option);
    setForm((prev) => ({ ...prev, city: option?.value || "" }));
    setNotice({ type: "", message: "" });
  }

  async function handleSaveProfile(e) {
    e.preventDefault();
    const name = form.name.trim();
    const city = form.city.trim();

    if (name.length < 2) {
      setNotice({ type: "error", message: "Name must be at least 2 characters." });
      return;
    }
    if (city.length < 2) {
      setNotice({ type: "error", message: "Please select a valid city." });
      return;
    }

    setSaving(true);
    setNotice({ type: "", message: "" });

    try {
      const res = await updateProfile({ name, city });
      setProfile(res.user);
      setNotice({ type: "success", message: res.message || "Profile updated successfully." });
      setModalOpen(false);
    } catch (err) {
      setNotice({ type: "error", message: err.response?.data?.message || "Could not update profile." });
    } finally {
      setSaving(false);
    }
  }

  async function handlePasswordSave(e) {
    e.preventDefault();
    setPasswordNotice({ type: "", message: "" });

    if (hasPassword && !passwordForm.oldPassword) {
      setPasswordNotice({ type: "error", message: "Current password is required." });
      return;
    }
    if (passwordForm.newPassword.length < 6) {
      setPasswordNotice({ type: "error", message: "New password must be at least 6 characters." });
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordNotice({ type: "error", message: "New passwords do not match." });
      return;
    }

    setPasswordSaving(true);

    try {
      const res = await changePassword({
        oldPassword: passwordForm.oldPassword,
        newPassword: passwordForm.newPassword,
      });
      setProfile(res.user);
      setPasswordForm({ oldPassword: "", newPassword: "", confirmPassword: "" });
      setPasswordNotice({ type: "success", message: res.message || "Password saved successfully." });
    } catch (err) {
      setPasswordNotice({ type: "error", message: err.response?.data?.message || "Could not save password." });
    } finally {
      setPasswordSaving(false);
    }
  }

  function handleLogout() {
    logout();
    navigate("/login");
  }

  async function handleTelegramSave(e) {
    e.preventDefault();
    setTelegramNotice({ type: "", message: "" });
    const chatId = telegramChatId.trim();

    setTelegramSaving(true);
    try {
      const res = await updateTelegram({ telegramChatId: chatId, telegramEnabled: chatId ? telegramEnabled : false });
      setProfile(res.user);
      setTelegramChatId(res.user.telegramChatId || "");
      setTelegramEnabled(Boolean(res.user.telegramEnabled));
      setTelegramNotice({ type: "success", message: res.message || "Telegram settings saved." });
    } catch (err) {
      setTelegramNotice({ type: "error", message: err.response?.data?.message || "Could not save Telegram settings." });
    } finally {
      setTelegramSaving(false);
    }
  }

  async function handleTelegramToggle(enabled) {
    setTelegramToggling(true);
    setTelegramNotice({ type: "", message: "" });
    try {
      const res = await updateTelegram({ telegramChatId: profile?.telegramChatId || "", telegramEnabled: enabled });
      setProfile(res.user);
      setTelegramEnabled(Boolean(res.user.telegramEnabled));
      setTelegramNotice({ type: "success", message: enabled ? "Telegram alerts enabled." : "Telegram alerts paused." });
    } catch (err) {
      setTelegramNotice({ type: "error", message: err.response?.data?.message || "Could not update preference." });
    } finally {
      setTelegramToggling(false);
    }
  }

  async function handleTelegramTest() {
    setTelegramTesting(true);
    setTelegramNotice({ type: "", message: "" });

    try {
      const res = await sendTelegramTest();
      setTelegramNotice({ type: "success", message: res.message || "Telegram test alert sent." });
    } catch (err) {
      setTelegramNotice({
        type: "error",
        message: err.response?.data?.message || "Could not send Telegram test alert.",
      });
    } finally {
      setTelegramTesting(false);
    }
  }

  return (
    <div className="profile-root">
      <main className="profile-main">
        <header className="profile-topbar">
          <Link className="profile-back" to="/dashboard" aria-label="Back to dashboard">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <p className="eyebrow">Account settings</p>
            <h1>Profile Management</h1>
          </div>
          <button className="profile-signout" onClick={handleLogout}>
            Sign out
          </button>
        </header>

        <div className="profile-content">
          <Notice type={notice.type}>{notice.message}</Notice>

          <section className="profile-hero-card">
            {profileLoading ? (
              <div className="profile-loading">
                <Loader2 size={28} className="spin-icon" />
                Loading profile
              </div>
            ) : (
              <>
                <div className="profile-hero-left">
                  <ProfileAvatar user={profile} className="large" />
                  <div>
                    <p className="eyebrow">Registered user</p>
                    <h2>{profile?.name || "User"}</h2>
                    <div className="provider-chip">
                      <ProviderIcon provider={profile?.authProvider} />
                      {authProvider} account
                    </div>
                  </div>
                </div>
                <button className="profile-primary-btn" onClick={openEditModal}>
                  <Pencil size={17} />
                  Edit Profile
                </button>
              </>
            )}
          </section>

          <section className="profile-info-grid">
            {profileStats.map(({ label, value, icon: Icon }) => (
              <article className="profile-info-card" key={label}>
                <span className="profile-info-icon"><Icon size={19} /></span>
                <div>
                  <p>{label}</p>
                  <strong>{value}</strong>
                </div>
              </article>
            ))}
          </section>

          <section className="profile-card">
            <div className="profile-card-header">
              <div>
                <p className="eyebrow">City-based alerts</p>
                <h2>Alert Delivery City</h2>
              </div>
              <MapPin size={22} />
            </div>
            <p className="profile-muted">
              Future disaster alerts are matched against your saved city in MongoDB. After a city update, alerts will use the new city for all future checks.
            </p>
            <div className="city-change-preview">
              <span>Current city</span>
              <strong>{profile?.city || "--"}</strong>
            </div>
          </section>

          {/* ── Telegram Integration ───────────────────────── */}
          <section className="profile-card">
            <div className="profile-card-header">
              <div>
                <p className="eyebrow">Instant alerts</p>
                <h2>Telegram Integration</h2>
              </div>
              <MessageCircle size={22} />
            </div>

            {/* Connection status chip */}
            <div className="telegram-status-row">
              {profile?.telegramChatId ? (
                <span className="telegram-connected-chip">
                  ✅ Connected — Chat ID: <code>{profile.telegramChatId}</code>
                </span>
              ) : (
                <span className="telegram-disconnected-chip">
                  ⚡ Not connected
                </span>
              )}
            </div>

            <p className="profile-muted">
              Connect your Telegram account to receive instant disaster alerts.
              First open <strong>{telegramBot.username ? `@${telegramBot.username}` : "your AegisAlert bot"}</strong> on Telegram and tap Start.
              Then open <strong>@userinfobot</strong>, send it a message, and paste your numeric Chat ID below.
            </p>

            <Notice type={telegramNotice.type}>{telegramNotice.message}</Notice>

            <form className="profile-telegram-form" onSubmit={handleTelegramSave}>
              <label className="profile-field">
                <span>Telegram Chat ID</span>
                <div className="profile-input-wrap">
                  <Send size={17} />
                  <input
                    type="text"
                    placeholder="e.g. 123456789"
                    value={telegramChatId}
                    onChange={(e) => {
                      setTelegramChatId(e.target.value);
                      setTelegramNotice({ type: "", message: "" });
                    }}
                    autoComplete="off"
                  />
                </div>
              </label>

              <div className="telegram-actions-row">
                <button
                  type="submit"
                  className="profile-secondary-btn"
                  disabled={telegramSaving}
                >
                  {telegramSaving ? <Loader2 size={17} className="spin-icon" /> : <Save size={17} />}
                  {telegramSaving ? "Saving" : profile?.telegramChatId ? "Update / Disconnect" : "Connect Telegram"}
                </button>

                {profile?.telegramChatId && (
                  <label className="telegram-toggle-label">
                    <span>Alerts {telegramEnabled ? "enabled" : "paused"}</span>
                    <button
                      type="button"
                      id="telegram-toggle"
                      className={`telegram-toggle ${telegramEnabled ? "on" : "off"}`}
                      onClick={() => handleTelegramToggle(!telegramEnabled)}
                      disabled={telegramToggling}
                      aria-checked={telegramEnabled}
                      role="switch"
                      aria-label="Toggle Telegram alerts"
                    >
                      <span className="telegram-toggle-knob" />
                    </button>
                  </label>
                )}

                {profile?.telegramChatId && (
                  <button
                    type="button"
                    className="profile-secondary-btn"
                    onClick={handleTelegramTest}
                    disabled={telegramTesting}
                  >
                    {telegramTesting ? <Loader2 size={17} className="spin-icon" /> : <Send size={17} />}
                    {telegramTesting ? "Sending" : "Send Test"}
                  </button>
                )}
              </div>

              {telegramChatId.trim() === "" && profile?.telegramChatId && (
                <p className="telegram-hint">
                  Clear the field and save to disconnect Telegram.
                </p>
              )}
            </form>
          </section>

          <section className="profile-card">
            <div className="profile-card-header">
              <div>
                <p className="eyebrow">Security</p>
                <h2>{hasPassword ? "Change Password" : "Set Password"}</h2>
              </div>
              <KeyRound size={22} />
            </div>
            <p className="profile-muted">
              {hasPassword
                ? "Verify your current password before saving a new one."
                : `Your ${authProvider} account does not have an email password yet. Set one to also sign in with email and password.`}
            </p>
            <Notice type={passwordNotice.type}>{passwordNotice.message}</Notice>

            <form className="profile-password-form" onSubmit={handlePasswordSave}>
              {hasPassword && (
                <label className="profile-field">
                  <span>Current password</span>
                  <div className="profile-input-wrap">
                    <Lock size={17} />
                    <input
                      type={showPasswords ? "text" : "password"}
                      value={passwordForm.oldPassword}
                      onChange={(e) => setPasswordForm((prev) => ({ ...prev, oldPassword: e.target.value }))}
                      autoComplete="current-password"
                    />
                  </div>
                </label>
              )}
              <label className="profile-field">
                <span>New password</span>
                <div className="profile-input-wrap">
                  <Lock size={17} />
                  <input
                    type={showPasswords ? "text" : "password"}
                    value={passwordForm.newPassword}
                    onChange={(e) => setPasswordForm((prev) => ({ ...prev, newPassword: e.target.value }))}
                    minLength={6}
                    autoComplete="new-password"
                  />
                </div>
              </label>
              <label className="profile-field">
                <span>Confirm password</span>
                <div className="profile-input-wrap">
                  <Lock size={17} />
                  <input
                    type={showPasswords ? "text" : "password"}
                    value={passwordForm.confirmPassword}
                    onChange={(e) => setPasswordForm((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                    minLength={6}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className="profile-icon-btn"
                    onClick={() => setShowPasswords((value) => !value)}
                    aria-label="Toggle password visibility"
                  >
                    {showPasswords ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </label>
              <button className="profile-secondary-btn" type="submit" disabled={passwordSaving}>
                {passwordSaving ? <Loader2 size={17} className="spin-icon" /> : <Save size={17} />}
                {passwordSaving ? "Saving" : hasPassword ? "Change Password" : "Set Password"}
              </button>
            </form>
          </section>
        </div>
      </main>

      {modalOpen && (
        <div className="profile-modal-backdrop" role="presentation" onMouseDown={closeEditModal}>
          <section className="profile-modal" role="dialog" aria-modal="true" aria-labelledby="edit-profile-title" onMouseDown={(e) => e.stopPropagation()}>
            <div className="profile-modal-header">
              <div>
                <p className="eyebrow">Edit details</p>
                <h2 id="edit-profile-title">Update Profile</h2>
              </div>
              <button className="profile-icon-btn" onClick={closeEditModal} aria-label="Close edit profile">
                <X size={18} />
              </button>
            </div>

            <form className="profile-edit-form" onSubmit={handleSaveProfile}>
              <label className="profile-field">
                <span>Name</span>
                <div className="profile-input-wrap">
                  <User size={17} />
                  <input
                    value={form.name}
                    onChange={(e) => {
                      setForm((prev) => ({ ...prev, name: e.target.value }));
                      setNotice({ type: "", message: "" });
                    }}
                    required
                    minLength={2}
                    autoComplete="name"
                  />
                </div>
              </label>

              <label className="profile-field">
                <span>City</span>
                <div className="profile-select-wrap">
                  <MapPin size={18} className="profile-select-icon" />
                  <Select
                    classNamePrefix="city-select"
                    value={cityOption}
                    onChange={handleCityChange}
                    onInputChange={(value, meta) => {
                      if (meta.action === "input-change") setCityInput(value);
                    }}
                    options={cityOptions}
                    placeholder="Search any city worldwide"
                    isLoading={citiesLoading}
                    noOptionsMessage={({ inputValue }) =>
                      inputValue.length < 2 ? "Loading popular cities" : "No cities found"
                    }
                    isClearable
                    isSearchable
                  />
                </div>
              </label>

              <div className="profile-modal-actions">
                <button type="button" className="profile-cancel-btn" onClick={closeEditModal} disabled={saving}>
                  Cancel
                </button>
                <button type="submit" className="profile-primary-btn" disabled={saving}>
                  {saving ? <Loader2 size={17} className="spin-icon" /> : <Save size={17} />}
                  {saving ? "Saving" : "Save Changes"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
