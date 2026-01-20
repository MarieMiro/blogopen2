import React, { useState } from "react";
import { api } from "../api";

export default function LoginModal({ onClose, onSuccess, onOpenSignup }) {
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e) => {
    setFormData((p) => ({ ...p, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    e.stopPropagation();

    setError("");
    setLoading(true);

    try {
      const res = await fetch(api("/api/login/"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
        }),
      });

      const text = await res.text();
      let data = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = null; // если пришел HTML или пусто
      }

      console.log("LOGIN RESPONSE", res.status, data ?? text);

      if (!res.ok) {
        const err =
          data?.error ||
          data?.detail ||
          (data && typeof data === "object"
            ? Object.entries(data)
                .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : String(v)}`)
                .join(" | ")
            : null) ||
          (text && text.trim()) ||
          `Ошибка входа (status ${res.status})`;

        setError(err);
        return;
      }

      // успех
      onSuccess?.(data ?? {});
      onClose?.();
    } catch (err) {
      console.error("LOGIN ERROR", err);
      setError("Не удалось подключиться к серверу API.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal" aria-hidden="true">
      <div className="modal__backdrop" onClick={() => !loading && onClose?.()} />
      <div className="modal__panel card blur" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <strong>Войти</strong>
          <button className="btn" type="button" onClick={() => !loading && onClose?.()}>
            ✕
          </button>
        </div>

        <form className="form" onSubmit={handleSubmit}>
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
            />
          </label>

          {error && <p className="small" style={{ color: "crimson", marginTop: 8 }}>{error}</p>}

          <button className="btn btnPrimary" type="submit" disabled={loading}>
            {loading ? "Вход..." : "Войти"}
          </button>

          <p className="muted small" style={{ marginTop: 12 }}>
            Нет аккаунта?{" "}
            <button
              type="button"
              disabled={loading}
              onClick={() => {
                onClose?.();
                onOpenSignup?.();
              }}
              style={{ padding: 0, border: "none", background: "none", textDecoration: "underline", cursor: "pointer" }}
            >
              Создать
            </button>
          </p>
        </form>
      </div>
    </div>
  );
}