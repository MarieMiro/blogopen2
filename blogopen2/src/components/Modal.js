import React, { useState } from "react";
import { api } from "../api";

const Modal = ({ onClose, onSuccess, onOpenLogin }) => {
  const [formData, setFormData] = useState({
    role: "brand",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const safeClose = () => {
    if (typeof onClose === "function") onClose();
  };

  const safeSuccess = (payload) => {
    if (typeof onSuccess === "function") onSuccess(payload);
  };

  const safeOpenLogin = () => {
    if (typeof onOpenLogin === "function") onOpenLogin();
  };

  const handleChange = (e) => {
    setFormData((p) => ({ ...p, [e.target.name]: e.target.value }));
  };

  const buildErrorMessage = (data, rawText, status) => {
    // 1) {"error": "..."}
    if (data && typeof data === "object" && data.error) return String(data.error);

    // 2) DRF {"detail": "..."}
    if (data && typeof data === "object" && data.detail) return String(data.detail);

    // 3) {"email":["..."], "password":["..."]}
    if (data && typeof data === "object") {
      const entries = Object.entries(data);
      if (entries.length) {
        const msg = entries
          .map(([k, v]) => {
            if (Array.isArray(v)) return `${k}: ${v.join(", ")}`;
            if (v && typeof v === "object") return `${k}: ${JSON.stringify(v)}`;
            return `${k}: ${String(v)}`;
          })
          .join(" | ");
        if (msg.trim()) return msg;
      }
    }

    // 4) если пришёл HTML/текст
    if (typeof rawText === "string" && rawText.trim()) {
      return rawText.slice(0, 500); // чтобы не залить весь HTML
    }

    return `Ошибка регистрации (status ${status})`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    e.stopPropagation();

    setError("");

    if (formData.password !== formData.confirmPassword) {
      setError("Пароли не совпадают");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(api("/api/register/"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          role: formData.role,
          email: formData.email,
          password: formData.password,
        }),
      });

      const rawText = await response.text();

      let data = null;
      try {
        data = rawText ? JSON.parse(rawText) : null;
      } catch {
        data = null;
      }

      console.log("REGISTER RESPONSE", response.status, data ?? rawText);

      if (!response.ok) {
        setError(buildErrorMessage(data, rawText, response.status));
        return;
      }

      safeSuccess(data ?? {});
      safeClose();
    } catch (err) {
      console.error("REGISTER ERROR", err);
      setError("Не удалось подключиться к серверу API.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal" id="modal" aria-hidden="true">
      <div
        className="modal__backdrop"
        onClick={() => {
          if (!loading) safeClose();
        }}
      />

      <div className="modal__panel card blur" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <strong>Создать аккаунт</strong>
          <button
            className="btn"
            onClick={() => {
              if (!loading) safeClose();
            }}
            type="button"
            aria-label="Закрыть"
          >
            ✕
          </button>
        </div>

        <form className="form" onSubmit={handleSubmit}>
          <label>
            Роль
            <select
              name="role"
              value={formData.role}
              onChange={handleChange}
              disabled={loading}
              required
            >
              <option value="brand">Бренд/Рекламодатель</option>
              <option value="blogger">Блогер</option>
            </select>
          </label>

          <label>
            Email
            <input
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              disabled={loading}
              required
            />
          </label>

          <label>
            Пароль
            <input
              name="password"
              type="password"
              value={formData.password}
              onChange={handleChange}
              disabled={loading}
              required
              minLength={6}
            />
          </label>

          <label>
            Повтор пароля
            <input
              name="confirmPassword"
              type="password"
              value={formData.confirmPassword}
              onChange={handleChange}
              disabled={loading}
              required
              minLength={6}
            />
          </label>

          {error && (
            <p className="small" style={{ color: "crimson", marginTop: 8 }}>
              {error}
            </p>
          )}

          <button className="btn btnPrimary" type="submit" disabled={loading}>
            {loading ? "Создание..." : "Продолжить"}
          </button>

          <p className="muted small" style={{ marginTop: 12 }}>
            Уже есть аккаунт?{" "}
            <button
              type="button"
              onClick={() => {
                if (loading) return;
                safeClose();
                safeOpenLogin();
              }}
              disabled={loading}
              style={{
                padding: 0,
                border: "none",
                background: "none",
                textDecoration: "underline",
                cursor: "pointer",
              }}
            >
              Войти
            </button>
          </p>
        </form>
      </div>
    </div>
  );
};

export default Modal;