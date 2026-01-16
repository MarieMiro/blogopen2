import React from "react";
import { Navigate } from "react-router-dom";

export default function RequireAuth({ user, loading, children }) {
  if (loading) return null;
  if (!user) return <Navigate to="/" replace />;
  return children;
}