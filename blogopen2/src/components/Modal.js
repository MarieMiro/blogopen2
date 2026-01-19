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

  const handleChange = (e) => {
    setFormData((p) => ({ ...p, [e.target.name]: e.target.value }));
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

      const text = await response.text();

      let data = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = null;
      }

      console.log("REGISTER RESPONSE", response.status, data ?? text);

      if (!response.ok) {
        const err1 = data?.error;   // {"error": "..."}
        const err2 = data?.detail;  // {"detail": "..."}

        const err3 =
          data && typeof data === "object"
            ? Object.entries(data)
                .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : String(v)}`)
                .join(" | ")
            : null;

        const err4 = typeof text === "string" && text.trim() ? text : null;

        setError(
          err1 || err2 || err3 || err4  `Ошибка регистрации (status ${response.status})`
        );
        return;
      }

      onSuccess?.(data ?? {});
      onClose?.();
    } catch (err) {
      console.error("REGISTER ERROR", err);
      setError("Не удалось подключиться к серверу API.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal" id="modal" aria-hidden="true">
      <div className="modal__backdrop" onClick={() => !loading && onClose?.()} />

      <div className="modal__panel card blur" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <strong>Создать аккаунт</strong>
          <button className="btn" onClick={() => !loading && onClose?.()} type="button">
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
                onClose?.();
                onOpenLogin?.();
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