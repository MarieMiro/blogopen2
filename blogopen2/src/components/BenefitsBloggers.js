import React from 'react';
import blogger from '../Assets/bloggers.jpg'


const BenefitsBloggers = () => {
  const benefits = [
    {
      title: 'Монетизация',
      description: 'Получайте заявки от брендов под вашу тематику и монетириуйте блог уже на старте.'
    },
    {
      title: 'Прозрачные требования',
      description: 'Безопасные сделки за счет чётких ТЗ, сроков и предоплаты.'
    },
    {
      title: 'Рост профиля',
      description: 'Развивайте профиль благодаря идеальной рекламею.'
    }
  ];

  return (
    <section className="section" id="benefits-bloggers">
      <div className="container split split--reverse">
        <div className="split__media">
          <img src={blogger} alt="Преимущества для блогеров" />
        </div>

        <div className="split__content">
          <div className="benefits-header">
            <div className="highlight-badge">
              <span className="highlight-text">Для блогеров</span>
            </div>
            <h2 className="hl">
              <span className="hl__row hl__row--a">Преимущества для блогеров</span>
            </h2>
          </div>

          <p className="muted split__lead">
            Получайте заявки от брендов, работайте прозрачно и монетирируйте блог.
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

export default BenefitsBloggers;