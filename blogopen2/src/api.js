export const API_BASE = "";

export const apiUrl = (path) =>
  `${API_BASE}${path.startsWith("/") ? "" : "/"}${path}`;

export const api = (path) => apiUrl(path);