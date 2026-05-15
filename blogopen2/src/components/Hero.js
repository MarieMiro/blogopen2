import React from 'react';
import Me from "../Assets/me.png";
import Modal from './Modal';


const Hero = ({ onSignupClick }) => {
  return (
    <section className="section hero">
      <div className="container hero__grid">

        <div className="hero__text">
          <div className="hero__kicker">
            <span className="hero__kicker-dot" />
            Платформа для брендов и блогеров
          </div>

          <h1>Blog<em>Open</em></h1>

          <p className="muted">
            Находите идеальных партнёров для рекламных интеграций.
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
            <div className="hero__stat-divider" />
            <div className="hero__stat">
              <span className="hero__stat-num">120+</span>
              <span className="hero__stat-label">Брендов</span>
            </div>
            <div className="hero__stat-divider" />
            <div className="hero__stat">
              <span className="hero__stat-num">98%</span>
              <span className="hero__stat-label">Довольных</span>
            </div>
          </div>
        </div>

        <div className="hero__image hero__cards">
          <div className="hero-card">
            <div className="hero-card__head">
              <div className="hero-avatar hero-avatar--purple">АК</div>
              <div>
                <div className="hero-card__name">@anna_beauty</div>
                <div className="hero-card__role">Блогер · Instagram</div>
              </div>
            </div>
            <div>
              <span className="hero-chip hero-chip--purple">Красота</span>
              <span className="hero-chip hero-chip--amber">Lifestyle</span>
              <span className="hero-chip hero-chip--green">Уход</span>
            </div>
            <div className="hero-card__stats">
              <div className="hero-card__stat">
                <span className="hero-card__stat-num">240К</span>
                <span className="hero-card__stat-label">Подписчиков</span>
              </div>
              <div className="hero-card__stat">
                <span className="hero-card__stat-num">4.8%</span>
                <span className="hero-card__stat-label">Вовлечённость</span>
              </div>
              <div className="hero-card__stat">
                <span className="hero-card__stat-num">✔</span>
                <span className="hero-card__stat-label">Верифицирован</span>
              </div>
            </div>
          </div>

          <div className="hero-msg">
            <div className="hero-msg__row">
              <div className="hero-avatar hero-avatar--purple hero-avatar--sm">АК</div>
              <div className="hero-bubble hero-bubble--them">
                Привет! Интересно сотрудничество с вашим брендом 👋
              </div>
            </div>
            <div className="hero-msg__row hero-msg__row--me">
              <div className="hero-avatar hero-avatar--green hero-avatar--sm">БР</div>
              <div className="hero-bubble hero-bubble--me">
                Отлично! Вышли, пожалуйста, ваш прайс 🎯
              </div>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
};

export default Hero;