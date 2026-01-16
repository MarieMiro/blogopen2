import React from 'react';
import Me from "../Assets/me.png";
import Modal from './Modal';

const Hero = ({ onSignupClick }) => {
  return (
    <section className="section hero">
      <div className="container hero__grid">
        <div className="hero__text">
          <div className="kicker">Платформа для брендов и блогеров</div>
          <h1>BlogOpen</h1>
          <p className="muted">
            BlogOpen помогает быстро находить партнёров, фиксировать условия и
            смотреть прозрачные метрики. Умный подбор + Trust Index.
          </p>

          <div className="hero__cta">
            <button className="btn btnPrimary" onClick={onSignupClick}>
              Создать аккаунт
            </button>
            <a className="btn" href="#features">
              Смотреть возможности
            </a>
          </div>
        </div>

        <div className="hero__image">
          
        </div>
      </div>
    </section>

   
  );
};

export default Hero;