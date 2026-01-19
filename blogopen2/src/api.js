export const API_BASE = (process.env.REACT_APP_API_BASE || "http://127.0.0.1:8000")
  .replace(/\/$/, "");

export const apiUrl = (path) =>
  `${API_BASE}${path.startsWith("/") ? "" : "/"}${path}`;

export const api = (path) => apiUrl(path);