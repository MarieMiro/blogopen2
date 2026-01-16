import React from "react";
import "./dashboard.css";

export default function BrandDashboard() {
  return (
    <div className="dash">
      <aside className="dash__side">
        <div className="dash__menu">
          <a className="dash__link" href="#">Личный кабинет</a>
          <a className="dash__link" href="#">Блогеры</a>
          <a className="dash__link" href="#">Сообщения</a>
        </div>
      </aside>

      <main className="dash__main">
        <div className="dash__tabs">
          <button className="dash__tab dash__tab--active">Все</button>
          <button className="dash__tab">Рекомендации</button>
        </div>

        <div className="dash__grid">
          {Array.from({ length: 6 }).map((_, i) => (
            <div className="cardBlogger" key={i}>
              <div className="cardBlogger__photo" />
              <div className="cardBlogger__name">Иванова<br/>Иванна</div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}