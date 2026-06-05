import React from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import "../../styles/dashboard.css"

export default function BloggerLayout() {
  const navigate = useNavigate();

  const goHome = () => {
    navigate("/"); 
  };
  return (
    <div className="dash">
      {/* ЛЕВЫЙ УЗКИЙ САЙДБАР */}
      <aside className="dash__side">
        <NavLink to="/dashboard/blogger" className="dash__icon">
          ☰
        </NavLink>
        <NavLink to="/dashboard/blogger/brands" className="dash__icon">
          👥
        </NavLink>
        <NavLink to="/dashboard/blogger/messages" className="dash__icon">
          💬
        </NavLink>
        <NavLink to="/dashboard/blogger/deals" className="dash__icon" title="Сделки">
          🤝
        </NavLink>
      </aside>

      {/* ПРАВАЯ ЧАСТЬ */}
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