import React, { useMemo, useState } from "react";
import "./BenefitsBloggers.css";

import blogger1 from "../Assets/blogger1.png";
import blogger2 from "../Assets/blogger2.png";
import blogger3 from "../Assets/blogger3.png";

export default function BenefitsBloggers() {
  const benefits = useMemo(
    () => [
      {
        title: "Монетизация",
        description:
          "Получайте заявки от брендов под вашу тематику и монетизируйте блог уже на старте.",
      },
      {
        title: "Прозрачные требования",
        description: "Безопасные сделки за счёт чётких ТЗ, сроков и предоплаты.",
      },
      {
        title: "Рост профиля",
        description: "Развивайте профиль благодаря идеальной рекламе.",
      },
    ],
    []
  );

  const slides = useMemo(
    () => [
      { src: blogger1, alt: "Скрин 1" },
      { src: blogger2, alt: "Скрин 2" },
      { src: blogger3, alt: "Скрин 3" },
    ],
    []
  );

  const [idx, setIdx] = useState(0);

  const next = () => setIdx((p) => (p + 1) % slides.length);
  const prev = () => setIdx((p) => (p - 1 + slides.length) % slides.length);

  return (
    <section className="bbSection" id="benefits-bloggers">
      <div className="bbContainer">
        {/* LEFT */}
        <div className="bbLeft">
          <div className="benefits-header">
            <div className="highlight-badge">
              <span className="highlight-text">Для блогеров</span>
            </div>

            <h2 className="bbTitle">Преимущества для блогеров</h2>
          </div>

          <p className="bbLead">
            Получайте заявки от брендов, работайте прозрачно и монетизируйте блог.
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

        {/* RIGHT (slider) */}
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
    </section>
  );
}