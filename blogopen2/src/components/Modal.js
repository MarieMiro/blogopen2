import React, { useState } from "react";

const API_BASE = (process.env.REACT_APP_API_BASE || "http://127.0.0.1:8000")
  .replace(/\/$/, ""); // убираем слэш в конце, если есть

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
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
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
      const response = await fetch(`${API_BASE}/api/register/`, {
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
      let data = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = { raw: text };
      }

      if (!response.ok) {
        setError(data.error || `Ошибка регистрации (status ${response.status})`);
        return;
      }

      onSuccess?.(data);
      onClose?.();
    } catch (err) {
      console.error("REGISTER ERROR", err);
      setError("Не удалось подключиться к серверу.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="modal"
      id="modal"
      aria-hidden="true"
      onKeyDown={(e) => {
        if (e.key === "Escape" && !loading) onClose?.();
      }}
    >
      <div
        className="modal__backdrop"
        onClick={() => {
          if (!loading) onClose?.();
        }}
      />

      <div className="modal__panel card blur" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <strong>Создать аккаунт</strong>
          <button
            className="btn"
            onClick={() => {
              if (!loading) onClose?.();
            }}
            type="button"
            aria-label="Закрыть"
          >
            ✕
          </button>
        </div>

        <form className="form" id="signupForm" onSubmit={handleSubmit}>
          <label>
            Роль
            <select
              name="role"
              value={formData.role}
              onChange={handleChange}
              required
              disabled={loading}
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
              placeholder="name@mail.com"
              value={formData.email}
              onChange={handleChange}
              required
              disabled={loading}
            />
          </label>

          <label>
            Пароль
            <input
              name="password"
              type="password"
              minLength={6}
              placeholder="Минимум 6 символов"
              value={formData.password}
              onChange={handleChange}
              required
              disabled={loading}
            />
          </label>

          <label>
            Повтор пароля
            <input
              name="confirmPassword"
              type="password"
              minLength={6}
              placeholder="Повтори пароль"
              value={formData.confirmPassword}
              onChange={handleChange}
              required
              disabled={loading}
            />
          </label>

          {error && (
            <p className="small" style={{ color: "crimson", marginTop: 8 }}>
              {error}
            </p>)}

          <button className="btn btnPrimary" type="submit" disabled={loading}>
            {loading ? "Создание..." : "Продолжить"}
          </button>

          <p className="muted small" style={{ marginTop: 12 }}>
            Уже есть аккаунт?{" "}
            <button
              type="button"
              onClick={() => {
                onClose?.();
                onOpenLogin?.();
              }}
              disabled={loading}
              style={{
                padding: 0,
                margin: 0,
                border: "none",
                background: "none",
                color: "inherit",
                textDecoration: "underline",
                cursor: "pointer",
              }}
            >
              Войти
            </button>
          </p>

          <p className="muted small">Создавая аккаунт вы соглашаетесь с условиями сервиса.</p>
        </form>
      </div>
    </div>
  );
};

export default Modal;