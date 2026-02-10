import React from 'react';
import blogger from '../Assets/bloggers.jpg'
import "./BenefitsBloggers.css"
import blogger1 from "../../assets/blogger.png";
import blogger2 from "../../assets/blogger2.png";
import blogger3 from "../../assets/blogger3.png";

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

  // ✅ сюда кладёшь 2-5 картинок (можно оставить одну)
  const media = useMemo(() => [blogger1, blogger2, blogger3], []);

  return (
    <section className="section benefitsBloggers" id="benefits-bloggers">
      <div className="container split split--reverse benefitsBloggers__split">
        {/* RIGHT: media slider */}
        <div className="split__media benefitsMedia" aria-label="Скриншоты платформы">
          <div className="benefitsMedia__track" tabIndex={0}>
            {media.map((src, i) => (
              <div className="benefitsMedia__slide" key={i}>
                <img
                  className="benefitsMedia__img"
                  src={src}
                  alt={`Скриншот ${i + 1}`}
                  loading="lazy"
                />
              </div>
            ))}
          </div>

          <div className="benefitsMedia__hint muted">
            Листай →
          </div>
        </div>

        {/* LEFT: text + cards */}
        <div className="split__content benefitsContent">
          <div className="benefitsHeader">
            <div className="benefitsBadge">
              <span>Для блогеров</span>
            </div>

            <h2 className="benefitsTitle">Преимущества для блогеров</h2>

            <p className="benefitsLead muted">
              Получайте заявки от брендов, работайте прозрачно и монетизируйте блог.
            </p>
          </div>

          <div className="benefitsCards">
            {benefits.map((b, idx) => (
              <div className="benefitCard" key={idx}>
                <h3 className="benefitTitle">{b.title}</h3>
                <p className="benefitDesc muted">{b.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
