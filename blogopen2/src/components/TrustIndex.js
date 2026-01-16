import React from 'react';
import trust from '../Assets/trust.png'

const TrustIndex = () => {
  return (
    <section className="section" id="trust">
      <div className="container trust">
        <div className="trust__text">
          <div className="sectionTitle">
            <h2>Trust Index — ваш гарант доверия</h2>
            <p className="muted">Снижает риски и помогает выбирать качественных партнёров.</p>
          </div>

          <ul className="list">
            <li>Проверка подозрительной активности</li>
            <li>Оценка качества аудитории</li>
            <li>История сделок и репутация</li>
            <li>Риски и "красные флаги"</li>
          </ul>
        </div>

        <div className="trust__image">
          <img src={trust} alt="Trust Index" />
        </div>
      </div>
    </section>
  );
};

export default TrustIndex;