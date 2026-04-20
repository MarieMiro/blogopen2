export const API_BASE = "https://blogopen.onrender.com";

export const apiUrl = (path) =>
  `${API_BASE}${path.startsWith("/") ? "" : "/"}${path}`;

export const api = (path) => apiUrl(path);