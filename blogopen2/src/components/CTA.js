import React from 'react';

const CTA = ({ onSignupClick }) => {
  return (
    <section className="section" id="start">
      <div className="container">
        <div className="cta card blur">
          <div>
            <h2>Готовы начать?</h2>
            <p className="muted">Создайте аккаунт и получите подборку партнёров под вашу цель.</p>
            <div className="hero__cta">
              <button className="btn btnPrimary" onClick={onSignupClick}>
                Создать аккаунт
              </button>
              <a className="btn" href="#pricing">
                Смотреть тарифы
              </a>
            </div>
          </div>
          <div className="cta__bubble"></div>
        </div>
      </div>
    </section>
  );
};

export default CTA;