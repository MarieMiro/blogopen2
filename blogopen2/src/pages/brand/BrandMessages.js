import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import "./brandMessages.css";
import { API_BASE } from "../../api";

function fmtTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

function fmtDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const isSameDay = (a, b) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  if (isSameDay(d, today)) return "Сегодня";
  if (isSameDay(d, yesterday)) return "Вчера";
  return d.toLocaleDateString("ru-RU", {
    day: "numeric", month: "long",
    year: d.getFullYear() !== today.getFullYear() ? "numeric" : undefined,
  });
}

function dayKey(iso) {
  if (!iso) return "";
  return iso.slice(0, 10);
}

function dialogName(d) {
  return d?.other?.name || d?.title || d?.nickname || d?.brand_name || "Диалог";
}

function dialogAvatarUrl(d) {
  return d?.other?.avatar_url || d?.avatar_url || "";
}

function isNearBottom(el, px = 120) {
  if (!el) return true;
  const { scrollTop, scrollHeight, clientHeight } = el;
  return scrollHeight - (scrollTop + clientHeight) <= px;
}

function buildBrandTemplate(activeDialog) {
  const name = activeDialog ? dialogName(activeDialog) : "";
  return `Привет${name ? `, ${name}` : ""}! 👋

Я пишу с платформы BlogOpen. Хочу предложить сотрудничество.

Коротко о задаче:
— продукт/услуга: ________
— формат: ________
— сроки: ________
— бюджет: ________

Если интересно — подскажи, пожалуйста:
1) прайс/условия
2) свободные даты
3) куда удобнее прислать ТЗ

Спасибо!`;
}

// ── Модальное окно создания сделки ───────────────────────────────────────────
function DealModal({ activeDialog, activeId, onClose, onCreated }) {
  const [form, setForm] = useState({ description: "", amount: "", deadline: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const setField = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!form.description.trim()) { setError("Опишите условия сделки"); return; }
    setSaving(true);
    setError("");
    try {
      const bloggerId = activeDialog?.blogger_id;
        if (!bloggerId) {
          setError("Не удалось определить блогера. Обновите страницу.");
          setSaving(false);
          return;
        }
      const res = await fetch(`${API_BASE}/api/deals/create/`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          blogger_id: bloggerId,
          conversation_id: activeId,
          description: form.description.trim(),
          amount: form.amount.trim(),
          deadline: form.deadline.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error || "Ошибка создания сделки"); return; }
      onCreated(data.deal);
      onClose();
    } catch {
      setError("Ошибка соединения с сервером");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="dealModal__backdrop" onClick={onClose}>
      <div className="dealModal__panel" onClick={(e) => e.stopPropagation()}>
        <div className="dealModal__head">
          <strong>🤝 Оформить сделку</strong>
          <button type="button" className="dealModal__close" onClick={onClose}>✕</button>
        </div>

        <p className="dealModal__hint">
          Опишите условия сотрудничества. Блогер получит уведомление и сможет принять или отклонить сделку.
        </p>

        <form onSubmit={onSubmit} className="dealModal__form">
          <label className="dealModal__label">
            Условия сделки *
            <textarea
              className="dealModal__textarea"
              placeholder="Опишите задачу, требования, что нужно сделать…"
              value={form.description}
              onChange={(e) => setField("description", e.target.value)}
              rows={4}
              disabled={saving}
            />
          </label>

          <div className="dealModal__row">
            <label className="dealModal__label">
              Бюджет
              <input
                className="dealModal__input"
                placeholder="например: 15 000 ₽"
                value={form.amount}
                onChange={(e) => setField("amount", e.target.value)}
                disabled={saving}
              />
            </label>
            <label className="dealModal__label">
              Сроки
              <input
                className="dealModal__input"
                placeholder="например: до 10 июня"
                value={form.deadline}
                onChange={(e) => setField("deadline", e.target.value)}
                disabled={saving}
              />
            </label>
          </div>

          {error && <p className="dealModal__error">{error}</p>}

          <div className="dealModal__actions">
            <button type="button" className="btn" onClick={onClose} disabled={saving}>Отмена</button>
            <button type="submit" className="btn btnPrimary" disabled={saving}>
              {saving ? "Отправка…" : "Отправить предложение"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Основной компонент ────────────────────────────────────────────────────────
export default function BrandMessages() {
  const location = useLocation();

  const [dialogs, setDialogs] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");

  const [loadingDialogs, setLoadingDialogs] = useState(true);
  const [loadingChat, setLoadingChat] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");

  // Сделка
  const [showDealModal, setShowDealModal] = useState(false);
  const [pendingDeal, setPendingDeal] = useState(null); // активная сделка в диалоге

  const listRef = useRef(null);
  const pollRef = useRef(null);
  const isAtBottomRef = useRef(true);
  const lastMsgKeyRef = useRef("");
  const didPrefillRef = useRef(false);
  const draftsRef = useRef({});

  const preferredConvId = location.state?.convId ?? null;

  const filteredDialogs = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return dialogs;
    return dialogs.filter((d) => dialogName(d).toLowerCase().includes(s));
  }, [q, dialogs]);

  const activeDialog = useMemo(
    () => dialogs.find((d) => d.id === activeId) || null,
    [dialogs, activeId]
  );

  const groupedMessages = useMemo(() => {
    const groups = [];
    let lastDay = "";
    messages.forEach((m) => {
      const day = dayKey(m.created_at);
      if (day !== lastDay) {
        groups.push({ type: "separator", day, label: fmtDate(m.created_at), id: `sep_${day}` });
        lastDay = day;
      }
      groups.push({ type: "message", ...m });
    });
    return groups;
  }, [messages]);

  const openDialog = async (id) => {
    if (activeId) draftsRef.current[activeId] = text;
    setActiveId(id);
    setMessages([]);
    setPendingDeal(null);
    didPrefillRef.current = false;

    try {
      await fetch(`${API_BASE}/api/chat/${id}/read/`, { method: "POST", credentials: "include" });
    } catch {}

    setDialogs((prev) => prev.map((d) => (d.id === id ? { ...d, unread_count: 0 } : d)));
  };

  // Загружаем pending сделку при смене диалога
  useEffect(() => {
    if (!activeId) { setPendingDeal(null); return; }
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/deals/in-conversation/${activeId}/`, { credentials: "include" });
        const data = await res.json().catch(() => ({}));
        if (res.ok) setPendingDeal(data.deal || null);
      } catch {}
    })();
  }, [activeId]);

  useEffect(() => {
    if (!activeId) return;
    if (draftsRef.current[activeId] !== undefined) {
      setText(draftsRef.current[activeId]);
    } else {
      setText("");
    }
  }, [activeId]);

  // 1) Диалоги
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setError("");
        setLoadingDialogs(true);
        const res = await fetch(`${API_BASE}/api/chat/`, { credentials: "include" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) { if (alive) setError(data.error || "Не удалось загрузить диалоги"); return; }
        const results = data.results || [];
        if (!alive) return;
        setDialogs(results);
        if (preferredConvId) { setActiveId(preferredConvId); return; }
       const isMobile = window.innerWidth <= 768;
        if (results.length > 0 && !isMobile) {
          setActiveId((prev) => prev ?? results[0].id);
        }
      } catch {
        if (alive) setError("Ошибка соединения с сервером");
      } finally {
        if (alive) setLoadingDialogs(false);
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE}/api/chat/`, { credentials: "include" });
        const data = await res.json().catch(() => ({}));
        if (res.ok) setDialogs(data.results || []);
      } catch {}
    }, 30000);
    return () => clearInterval(id);
  }, []);

  // 2) Сообщения + polling
  useEffect(() => {
    if (!activeId) return;
    let alive = true;
    lastMsgKeyRef.current = "";

    const load = async (isFirst = false) => {
      try {
        if (isFirst) setLoadingChat(true);
        const res = await fetch(`${API_BASE}/api/chat/${activeId}/messages/`, { credentials: "include" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) { if (alive) setError(data.error || "Не удалось загрузить сообщения"); return; }
        const results = data.messages || data.results || [];
        if (!alive) return;
        const last = results.length ? results[results.length - 1] : null;
        const key = last ? `${last.id}_${last.created_at}` : `empty_${results.length}`;
        if (key === lastMsgKeyRef.current) return;
        lastMsgKeyRef.current = key;
        setMessages(results);
        if (isFirst && results.length === 0 && draftsRef.current[activeId] === undefined) {
          setText(buildBrandTemplate(activeDialog));
          didPrefillRef.current = true;
        }
        requestAnimationFrame(() => {
          const el = listRef.current;
          if (el && isAtBottomRef.current) el.scrollTop = el.scrollHeight;
        });
      } catch {
        if (alive) setError("Ошибка соединения с сервером");
      } finally {
        if (alive && isFirst) setLoadingChat(false);
      }
    };

    load(true);
    const startPolling = () => {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(() => load(false), 10000);
    };
    startPolling();
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") { if (pollRef.current) clearInterval(pollRef.current); }
      else { load(false); startPolling(); }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      alive = false;
      if (pollRef.current) clearInterval(pollRef.current);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  // 3) Отправка
  const onSend = async (e) => {
    e.preventDefault();
    const t = text.trim();
    if (!t || !activeId || sending) return;
    setSending(true);
    setError("");
    const tempId = `tmp_${Date.now()}`;
    setMessages((p) => [...p, { id: tempId, text: t, created_at: new Date().toISOString(), is_mine: true }]);
    setText("");
    delete draftsRef.current[activeId];
    requestAnimationFrame(() => { const el = listRef.current; if (el) el.scrollTop = el.scrollHeight; });

    try {
      const res = await fetch(`${API_BASE}/api/chat/${activeId}/messages/`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: t }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setMessages((p) => p.filter((m) => m.id !== tempId)); setText(t); setError(data.error || "Не удалось отправить"); return; }
      if (data.message) setMessages((p) => p.map((m) => (m.id === tempId ? { ...data.message, is_mine: true } : m)));
      setDialogs((prev) => prev.map((d) => d.id === activeId ? { ...d, last_message: t, last_message_at: new Date().toISOString() } : d));
    } catch {
      setMessages((p) => p.filter((m) => m.id !== tempId));
      setText(t);
      setError("Ошибка соединения с сервером");
    } finally {
      setSending(false);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSend(e); }
  };

  // После создания сделки — перезагружаем сообщения и ставим pendingDeal
  const onDealCreated = (deal) => {
    setPendingDeal(deal);
    lastMsgKeyRef.current = ""; // сбрасываем кэш чтобы polling подхватил новое сообщение
  };

  return (
    <div className={`msg ${activeId ? "chat-open" : ""}`}>

      {/* Модалка создания сделки */}
      {showDealModal && activeDialog && (
        <DealModal
          activeDialog={activeDialog}
          activeId={activeId}
          onClose={() => setShowDealModal(false)}
          onCreated={onDealCreated}
        />
      )}

      {/* LEFT */}
      <section className="msg__left">
        <div className="msg__leftHead">
          <div className="msg__leftTop">
            <div className="msg__title">Все чаты</div>
          </div>
          <div className="msg__search">
            <input className="msg__searchInput" placeholder="Поиск" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>

        <div className="msgList">
          {loadingDialogs ? (
            <div className="msg__muted">Загрузка диалогов…</div>
          ) : filteredDialogs.length === 0 ? (
            <div className="msg__muted">Ничего не найдено</div>
          ) : (
            filteredDialogs.map((d) => {
              const ava = dialogAvatarUrl(d);
              return (
                <button key={d.id} className={`msgItem ${activeId === d.id ? "isActive" : ""}`} onClick={() => openDialog(d.id)} type="button">
                  <div className="msgItem__avatar">
                    {ava ? <img className="msgItem__avatarImg" src={ava} alt="" /> : <div className="msgItem__avatarEmpty">👤</div>}
                  </div>
                  <div className="msgItem__body">
                    <div className="msgItem__top">
                      <div className="msgItem__name">{dialogName(d)}</div>
                      <div className="msgItem__time">{fmtTime(d.last_message_at)}</div>
                    </div>
                    <div className="msgItem__bottom">
                      <div className="msgItem__preview">{d.last_message || "Без сообщений"}</div>
                      {d.unread_count > 0 && <span className="msgItem__badge">{d.unread_count}</span>}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </section>

      {/* RIGHT */}
      <section className="msg__right">
        <header className="msg__topbar">
          {activeId && (
            <button className="msg__back" onClick={() => setActiveId(null)} type="button">← Назад</button>
          )}
          <div className="msg__chatTitle">
            {activeDialog ? dialogName(activeDialog) : "Выберите диалог"}
          </div>

          {/* Кнопка сделки — только если диалог открыт */}
          {activeId && (
            <button
              type="button"
              className="msg__dealBtn"
              onClick={() => setShowDealModal(true)}
              disabled={!!pendingDeal}
              title={pendingDeal ? "Уже есть активная сделка" : "Оформить сделку"}
            >
              {pendingDeal ? "⏳ Сделка отправлена" : "🤝 Оформить сделку"}
            </button>
          )}
        </header>

        {/* Баннер активной сделки */}
        {pendingDeal && (
          <div className="msg__dealBanner">
            <span>🤝 Сделка #{pendingDeal.id} ожидает ответа блогера</span>
            {pendingDeal.amount && <span className="msg__dealBannerAmount">{pendingDeal.amount}</span>}
          </div>
        )}

        <div className="msg__chat">
          <div
            className="msg__messages"
            ref={listRef}
            onScroll={() => {
              const el = listRef.current;
              if (!el) return;
              isAtBottomRef.current = isNearBottom(el, 120);
            }}
          >
            {loadingChat ? (
              <div className="msg__muted">Загрузка сообщений…</div>
            ) : !activeId ? (
              <div className="msg__muted">Выберите диалог слева</div>
            ) : messages.length === 0 ? (
              <div className="msg__muted">Начните диалог — отправьте первое сообщение</div>
            ) : (
              groupedMessages.map((item) => {
                if (item.type === "separator") {
                  return (
                    <div key={item.id} className="msg__dateSep">
                      <span className="msg__dateSepLabel">{item.label}</span>
                    </div>
                  );
                }
                const mine = item.is_mine ?? false;
                const isTemp = String(item.id).startsWith("tmp_");
                return (
                  <div key={item.id} className={`bubbleRow ${mine ? "bubbleRow--mine" : "bubbleRow--their"}`}>
                    <div className={`bubble ${mine ? "bubble--mine" : "bubble--their"} ${isTemp ? "bubble--sending" : ""}`}>
                      <div className="bubble__text">{item.text}</div>
                      <div className="bubble__meta">{isTemp ? "Отправка…" : fmtTime(item.created_at)}</div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {error && (
            <div style={{ padding: "4px 12px" }}>
              <p className="small" style={{ color: "crimson", margin: 0 }}>{error}</p>
            </div>
          )}

          <form className="msg__composer" onSubmit={onSend}>
            <textarea
              className="msg__input msg__input--textarea"
              placeholder={activeId ? "Написать сообщение… (Enter — отправить, Shift+Enter — новая строка)" : "Выберите диалог слева"}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={onKeyDown}
              disabled={!activeId || sending}
              rows={3}
            />
            <button className="msg__send" type="submit" disabled={!activeId || !text.trim() || sending}>
              {sending ? "…" : "Отправить"}
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}