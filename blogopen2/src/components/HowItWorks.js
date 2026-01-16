import React from 'react';

const HowItWorks = () => {
  const steps = [
    {
      number: '01',
      title: 'Регистрация',
      description: 'Быстро создайте профиль бренда или блогера.'
    },
    {
      number: '02',
      title: 'Поиск и предложения',
      description: 'Бренды ищут блогеров, блогеры получают предложения.'
    },
    {
      number: '03',
      title: 'Сотрудничество',
      description: 'Обсуждайте условия и запускайте кампании.'
    },
    {
      number: '04',
      title: 'Результат и монетизация',
      description: 'Блогеры получают оплату, бренды — результат.'
    }
  ];

  return (
    <section className="section" id="how">
      <div className="container how">
        <h2 className="how__title">Как это работает?</h2>

        <div className="how__grid">
          {steps.map((step, index) => (
            <div className="how__item" key={index}>
              <div className="how__line">
                <span className="how__step">{step.number}</span>
              </div>
              <h3>{step.title}</h3>
              <p className="muted">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;