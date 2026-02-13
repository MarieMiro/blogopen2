import React, { useMemo, useState } from "react";
import "./BenefitsBrands.css";

import brand1 from "../Assets/brand1.jpg";
import brand2 from "../Assets/brand2.jpg";


export default function BenefitsBrands() {
  const benefits = useMemo(
    () => [
      {
        title: "Быстрый запуск",
        description: "Быстрая регистрация, подбор блогера и старт рекламной кампании.",
      },
      {
        title: "Безопасные сделки",
        description: "Фиксация условий и контроль охватов рекламы в личном кабинете.",
      },
      {
        title: "Максимальная ROI",
        description: "Оптимизация бюджета по метрикам и детальная аналитика эффективности.",
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
    <section className="bbSection" id="benefits-brands">
      <div className="bbContainer">
        {/* LEFT (text) */}
        <div className="bbRight">
          <div className="bbSlider">
            <button
              type="button"
              className="bbNav bbNav--prev"
              onClick={prev}
              aria-label="Предыдущий слайд"
            >
              ‹
            </button>

            <div className="bbFrame">
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

            <div className="bbDots" aria-hidden="true">
              {slides.map((_, i) => (
                <span key={i} className={`bbDot ${i === idx ? "isActive" : ""}`} />
              ))}
            </div>
          </div>
      </div>
      </div>
        {/* RIGHT (slider) */}
         <div className="bbLeft">
          <div className="bbBadge">Для брендов</div>

          <h2 className="bbTitle">Преимущества для брендов</h2>
          <p className="bbLead">
            Быстрый подбор блогеров, прозрачные условия и контроль результата.
          </p>

          <div className="bbCards">
            {benefits.map((b) => (
              <div className="bbCard" key={b.title}>
                <h3 className="bbCardTitle">{b.title}</h3>
                <p className="bbCardDesc">{b.description}</p>
              </div>
            ))}
          </div>
        </div>
       
       
    </section>
  );
}