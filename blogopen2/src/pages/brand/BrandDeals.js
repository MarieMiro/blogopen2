import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "../../api";
import "./brandDeals.css";

const STATUS_LABEL = {
  pending:     { text: "Ожидает ответа",  color: "#ba7517", bg: "rgba(186,117,23,0.10)" },
  accepted:    { text: "Принята",          color: "#5b66b8", bg: "rgba(91,102,184,0.10)" },
  declined:    { text: "Отклонена",        color: "#c0392b", bg: "rgba(192,57,43,0.10)" },
  in_progress: { text: "В работе",         color: "#5b66b8", bg: "rgba(91,102,184,0.10)" },
  completed:   { text: "Выполнена",        color: "#1d9e75", bg: "rgba(29,158,117,0.10)" },
};

function fmtDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("ru-RU", {
    day: "numeric", month: "long", year: "numeric",
  });
}

export default function BrandDeals() {
  const navigate = useNavigate();
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState(null);
  const [acting, setActing] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch(`${API_BASE}/api/deals/`, { credentials: "include" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) { if (alive) setError(data.error || "Не удалось загрузить сделки"); return; }
        if (alive) setDeals(data.results || []);
      } catch {
        if (alive) setError("Ошибка соединения с сервером");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const toggleExpand = (id) => setExpanded((p) => p === id ? null : id);

  // Подтвердить выполнение со стороны бренда
  const onMarkDone = async (deal) => {
    setActing(deal.id);
    try {
      const res = await fetch(`${API_BASE}/api/deals/${deal.id}/done/`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { alert(data.error || "Ошибка"); return; }
      setDeals((p) => p.map((d) =>
        d.id === deal.id
          ? { ...d, status: data.deal.status, completed_by_brand: data.deal.completed_by_brand }
          : d
      ));
    } catch {
      alert("Ошибка соединения с сервером");
    } finally {
      setActing(null);
    }
  };

  const goToChat = (convId) => {
    navigate("/dashboard/brand/messages", { state: { convId } });
  };

  if (loading) return <div className="muted" style={{ padding: 24 }}>Загрузка сделок…</div>;

  return (
    <div className="deals">
      <div className="deals__head">
        <h1 className="deals__title">Мои сделки</h1>
        <p className="deals__sub muted">История всех предложений о сотрудничестве</p>
      </div>

      {error && <div className="deals__error">{error}</div>}

      {!loading && deals.length === 0 && (
        <div className="deals__empty">
          <div className="deals__emptyIcon">🤝</div>
          <p>Пока нет ни одной сделки</p>
          <p className="muted small">Оформите сделку в мессенджере — она появится здесь</p>
        </div>
      )}

      <div className="deals__list">
        {deals.map((deal) => {
          const s = STATUS_LABEL[deal.status] || STATUS_LABEL.pending;
          const isOpen = expanded === deal.id;
          const isActing = acting === deal.id;

          // Бренд может подтвердить если блогер уже отметил выполнение
          const canConfirm = ["accepted", "in_progress"].includes(deal.status)
            && deal.completed_by_blogger
            && !deal.completed_by_brand;

          // Бренд уже подтвердил, ждём блогера
          const waitingBlogger = ["accepted", "in_progress"].includes(deal.status)
            && deal.completed_by_brand
            && !deal.completed_by_blogger;

          return (
            <div key={deal.id} className={`dealCard ${isOpen ? "dealCard--open" : ""}`}>

              <button
                className="dealCard__head"
                type="button"
                onClick={() => toggleExpand(deal.id)}
              >
                <div className="dealCard__headLeft">
                  <div className="dealCard__partner">👤 {deal.partner_name}</div>
                  <div className="dealCard__date">{fmtDate(deal.created_at)}</div>
                </div>

                <div className="dealCard__headRight">
                  {deal.amount && (
                    <span className="dealCard__amount">💰 {deal.amount}</span>
                  )}
                  <span className="dealCard__status" style={{ color: s.color, background: s.bg }}>
                    {s.text}
                  </span>
                  {/* Индикатор — блогер отметил выполнение */}
                  {canConfirm && (
                    <span className="dealCard__alert">⚡ Требует подтверждения</span>
                  )}
                  <span className="dealCard__arrow">{isOpen ? "▲" : "▼"}</span>
                </div>
              </button>

              {isOpen && (
                <div className="dealCard__body">
                  <div className="dealCard__section">
                    <p className="dealCard__label">Условия сделки</p>
                    <p className="dealCard__desc">{deal.description}</p>
                  </div>

                  {deal.deadline && (
                    <div className="dealCard__section">
                      <p className="dealCard__label">Сроки</p>
                      <p className="dealCard__value">📅 {deal.deadline}</p>
                    </div>
                  )}

                  {deal.amount && (
                    <div className="dealCard__section">
                      <p className="dealCard__label">Бюджет</p>
                      <p className="dealCard__value">💰 {deal.amount}</p>
                    </div>
                  )}

                  {/* Статус выполнения */}
                  {canConfirm && (
                    <div className="dealCard__notice dealCard__notice--warn">
                      ⚡ Блогер отметил выполнение — подтвердите со своей стороны
                    </div>
                  )}

                  {waitingBlogger && (
                    <div className="dealCard__notice dealCard__notice--info">
                      ⏳ Вы подтвердили — ожидаем отметки от блогера
                    </div>
                  )}

                  {deal.status === "completed" && (
                    <div className="dealCard__notice dealCard__notice--success">
                      ✅ Сделка успешно завершена! Обе стороны подтвердили выполнение.
                    </div>
                  )}

                  {deal.status === "declined" && (
                    <div className="dealCard__notice dealCard__notice--error">
                      ❌ Блогер отклонил предложение
                    </div>
                  )}

                  {deal.status === "pending" && (
                    <div className="dealCard__notice dealCard__notice--info">
                      ⏳ Ожидаем ответа от блогера
                    </div>
                  )}

                  <div className="dealCard__actions">
                    {/* Подтвердить выполнение */}
                    {canConfirm && (
                      <button
                        className="dealCard__btn dealCard__btn--done"
                        onClick={() => onMarkDone(deal)}
                        disabled={isActing}
                      >
                        {isActing ? "…" : "✅ Подтвердить выполнение"}
                      </button>
                    )}

                    {/* Написать блогеру */}
                    {deal.conversation_id && (
                      <button
                        className="dealCard__btn dealCard__btn--chat"
                        onClick={() => goToChat(deal.conversation_id)}
                      >
                        💬 Написать блогеру
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}