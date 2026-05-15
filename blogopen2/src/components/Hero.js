import React from 'react';
import Me from "../Assets/me.png";
import Modal from './Modal';


const Hero = ({ onSignupClick }) => {
  return (
    <section className="section hero">
      <div className="container">

        <div className="hero__kicker">
          <span className="hero__kicker-dot" />
          Платформа для брендов и блогеров
        </div>

        <h1>Blog<em>Open</em></h1>

        <p className="muted hero__sub">
          Находите идеальных партнёров для рекламных интеграций.<br />
          Бренды — блогеров, блогеры — бренды.
        </p>

        <p className="hero__beta">🚀 Закрытая бета — ранний доступ открыт</p>

        <div className="hero__cta">
          <button className="btn btnPrimary" onClick={onSignupClick}>
            Создать аккаунт
          </button>
          <a className="btn" href="#features">
            Смотреть возможности →
          </a>
        </div>

        <div className="hero__stats">
          <div className="hero__stat">
            <span className="hero__stat-num">500+</span>
            <span className="hero__stat-label">Блогеров</span>
          </div>
          <div className="hero__stat-div" />
          <div className="hero__stat">
            <span className="hero__stat-num">120+</span>
            <span className="hero__stat-label">Брендов</span>
          </div>
          <div className="hero__stat-div" />
          <div className="hero__stat">
            <span className="hero__stat-num">98%</span>
            <span className="hero__stat-label">Довольных</span>
          </div>
        </div>

      </div>
    </section>
  );
};

export default Hero;