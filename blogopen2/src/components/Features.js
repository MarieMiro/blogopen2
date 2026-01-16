import React from 'react';

const Features = () => {
  const features = [
    {
      icon: '🎯',
      title: 'Умные Фильтры',
      description: 'Наша система предлагает расширенные фильтры для точного поиска инфлюенсеров.'
    },
    {
      icon: '⚡',
      title: 'Автоподбор',
      description: 'Используйте автоматический алгоритм для мгновенного нахождения идеальных партнеров без ручного поиска.'
    },
    {
      icon: '📊',
      title: 'Честная аналитика',
      description: 'Получайте доступ к подробной и достоверной аналитике рекламы в личном кабинете.'
    }
  ];

  return (
    <section className="section" id="features">
      <div className="container">
        <div className="sectionTitle">
          
          <h2>Возможности BlogOpen</h2>
          <p className="muted">
            Три шага — и у тебя список подходящих авторов под цель кампании. 
            <span className="highlighted-text"> Интеллектуальный подбор инфлюенсеров</span>
          </p>
        </div>

        <div className="grid cards3">
          {features.map((feature, index) => (
            <article className="card blur pad feature-card" key={index}>
              <div className="feature-icon">
                {feature.icon}
              </div>
              <h3>{feature.title}</h3>
              <p className="muted">{feature.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Features;