import React, { useMemo, useState } from "react";
import "./BenefitsBrands.css";

import brand1 from "../Assets/brand1.jpg";
import brand2 from "../Assets/brand2.jpg";

export default function BenefitsBrands() {
  const benefits = useMemo(
    () => [
      {
        title: "Быстрый запуск",
        description:
          "Быстрая регистрация, подбор блогера и старт рекламной кампании.",
      },
      {
        title: "Безопасные сделки",
        description:
          "Фиксация условий и контроль охватов рекламы в личном кабинете.",
      },
      {
        title: "Максимальная ROI",
        description:
          "Оптимизация бюджета по метрикам и детальная аналитика эффективности.",
      },
    ],
    []
  );

  const slides = useMemo(
    () => [
      { src: brand1, alt: "Скрин 1" },
      { src: brand2, alt: "Скрин 2" },
    ],
    []
  );

  const [idx, setIdx] = useState(0);

  const next = () => setIdx((p) => (p + 1) % slides.length);
  const prev = () => setIdx((p) => (p - 1 + slides.length) % slides.length);

  return (
    <section className="bbBrandsSection" id="benefits-brands">
      <div className="bbBrandsContainer">

        {/* LEFT (slider) */}
        <div className="bbBrandsLeft">
          <div className="bbBrandsSlider">
            <button
              type="button"
              className="bbNav bbNav--prev"
              onClick={prev}
              aria-label="Предыдущий слайд"
            >
              ‹
            </button>

            <div className="bbBrandsFrame">
              <img
                className="bbSlide"
                src={slides[idx].src}
                alt={slides[idx].alt}
                draggable="false"
              />
            </div>

            <button
              type="button"
              className="bbNav bbNav--next"
              onClick={next}
              aria-label="Следующий слайд"
            >
              ›
            </button>

            <div className="bbBrandsDots">
              {slides.map((_, i) => (
                <span
                  key={i}
                  className={`bbDot ${i === idx ? "isActive" : ""}`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT (text) */}
       <div className="bbBrandsRight">
          <div className="benefits-header">
            <div className="highlight-badge">
              <span className="highlight-text">Для брендов</span>
            </div>

            <h2 className="bbBrandsTitle">Преимущества для брендов</h2>
          </div>

          <p className="bbBrandsLead">
             Быстрый подбор блогеров, прозрачные условия и контроль результата.
          </p>

          <div className="benefits-cards">
            {benefits.map((benefit) => (
              <div className="benefit-card compact" key={benefit.title}>
                <h3 className="benefit-title">{benefit.title}</h3>
                <p className="benefit-desc">{benefit.description}</p>
              </div>
            ))}
          </div>
        </div> 

      </div>
    </section>
  );
}