import React from "react";
import "./Pricing.css";

const Pricing = () => {
  const plans = [
    {
      title: "Start",
      description: "Базовый доступ для знакомства с платформой",
      price: "150 ₽",
      popular: false,
      features: [
        { text: "Регистрация и профиль", available: true },
        { text: "Базовые карточки блогеров", available: true },
        { text: "Ограниченное количество сообщений", available: true },
        { text: "Неограниченные отклики", available: false },
        { text: "Расширенные фильтры", available: false },
        { text: "Trust Index", available: false },
        { text: "Шаблоны ТЗ", available: false },
        { text: "Метрики и аналитика", available: false },
      ],
    },
    {
      title: "Pro",
      description: "Для блогеров, которые хотят стабильно зарабатывать",
      price: "1 500 ₽/мес",
      popular: true,
      features: [
        { text: "Регистрация и профиль", available: true },
        { text: "Неограниченные сообщения и отклики", available: true },
        { text: "Расширенные фильтры", available: true },
        { text: "Trust Index", available: true },
        { text: "Шаблоны ТЗ", available: true },
        { text: "Метрики и аналитика", available: false },
      ],
    },
    {
      title: "Business",
      description: "Для брендов и агентств с фокусом на результат",
      price: "2 000 ₽/мес",
      popular: false,
      features: [
        { text: "Всё из тарифа Pro", available: true },
        { text: "Расширенные метрики кампаний", available: true },
        { text: "Аналитика эффективности", available: true },
        { text: "Сравнение блогеров", available: true },
        { text: "Экспорт отчётов", available: true },
        { text: "Персональный менеджер", available: true },
      ],
    },
  ];

  return (
    <section className="section" id="pricing">
      <div className="container">
        <div className="sectionTitle pricingTitle">
          <h2>Тарифы</h2>
          <p className="muted">Выберите пакет под свои задачи.</p>
        </div>

        <div className="pricingGrid">
          {plans.map((plan, index) => (
            <article
              className={`pricingCard ${plan.popular ? "isPopular" : ""}`}
              key={index}
            >
              {plan.popular && <div className="pricingPill">Популярный</div>}

              <h3 className="pricingName">{plan.title}</h3>

              <p className="pricingDesc">{plan.description}</p>

              <div className="pricingPrice">{plan.price}</div>

              <ul className="pricingList">
                {plan.features.map((item, idx) => (
                  <li
                    key={idx}
                    className={`pricingItem ${
                      item.available ? "isAvailable" : "isUnavailable"
                    }`}
                  >
                    {item.text}
                  </li>
                ))}
              </ul>

              <button
                className={`pricingBtn ${plan.popular ? "primary" : ""}`}
              >
                Выбрать
              </button>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Pricing;