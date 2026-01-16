import React from 'react';
import brand from '../Assets/brands.jpg'

const BenefitsBrands = () => {
  const benefits = [
    {
      title: 'Быстрый запуск',
      description: 'Быстрая регистрация, подбор блогера и старт рекламной кампании.'
    },
    {
      title: 'Безопасные сделки',
      description: 'Фиксация условий и контроль охватов рекламы в личном кабинете.'
    },
    {
      title: 'Максимальная ROI',
      description: 'Оптимизация бюджета по метрикам и детальная аналитика эффективности.'
    }
  ];

  return (
    <section className="section" id="benefits-brands">
      <div className="container split">
        <div className="split__media">
          <img src={brand} alt="Преимущества для брендов" />
        </div>

        <div className="split__content">
          <div className="benefits-header">
            <div className="highlight-badge">
              <span className="highlight-text">Для брендов</span>
            </div>
            <h2 className="hl">
              <span className="hl__row hl__row--a">Преимущества для брендов</span>
            </h2>
          </div>

          <p className="muted split__lead">
            Быстрый подбор блогеров, прозрачные условия и контроль результата.
          </p>

          <div className="benefits-cards">
            {benefits.map((benefit, index) => (
              <div className="card blur pad benefit-card compact" key={index}>
                <h3 className="benefit-title">{benefit.title}</h3>
                <p className="muted benefit-desc">{benefit.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default BenefitsBrands;