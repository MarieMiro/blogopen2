import React from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import "../../styles/dashboard.css";

export default function BrandLayout() {
  const navigate = useNavigate();

  const goHome = () => {
    navigate("/"); // главная страница сайта
  };

  return (
    <div className="dash">
      {/* ЛЕВЫЙ САЙДБАР */}
      <aside className="dash__side">
        <NavLink to="/dashboard/brand" className="dash__icon">
          ☰
        </NavLink>
        <NavLink to="/dashboard/brand/bloggers" className="dash__icon">
          👥
        </NavLink>
        <NavLink to="/dashboard/brand/messages" className="dash__icon">
          💬
        </NavLink>
      </aside>

      {/* КОНТЕНТ */}
      <div className="dash__content">
        {/* TOPBAR */}
        <header className="dash__topbar">
          <div className="dash__brand">BlogOpen</div>

          <button className="dash__logout" onClick={goHome}>
            Выйти
          </button>
        </header>

        {/* СТРАНИЦЫ */}
         <main className="dash__main dash__main--messages">
          <Outlet />
        </main>
      </div>
    </div>
  );
}