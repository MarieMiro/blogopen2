import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import "./brandMessages.css";
import { API_BASE } from "../../api";

function fmtTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

// ── Дата для разделителя ─────────────────────────────────────────────────────
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
    day: "numeric",
    month: "long",
    year: d.getFullYear() !== today.getFullYear() ? "numeric" : undefined,
  });
}

// Возвращает строку вида "2024-05-25" для группировки по дням
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

  // Группируем сообщения по дням для разделителей
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
    didPrefillRef.current = false;

    try {
      await fetch(`${API_BASE}/api/chat/${id}/read/`, {
        method: "POST",
        credentials: "include",
      });
    } catch {}

    setDialogs((prev) =>
      prev.map((d) => (d.id === id ? { ...d, unread_count: 0 } : d))
    );
  };

  // Восстанавливаем черновик при смене диалога
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

        if (!res.ok) {
          if (alive) setError(data.error || "Не удалось загрузить диалоги");
          return;
        }

        const results = data.results || [];
        if (!alive) return;

        setDialogs(results);

        if (preferredConvId) {
          setActiveId(preferredConvId);
          return;
        }

        if (results.length > 0) setActiveId((prev) => prev ?? results[0].id);
      } catch {
        if (alive) setError("Ошибка соединения с сервером");
      } finally {
        if (alive) setLoadingDialogs(false);
      }
    })();

    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Polling диалогов каждые 30 сек
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

        const res = await fetch(`${API_BASE}/api/chat/${activeId}/messages/`, {
          credentials: "include",
        });
        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          if (alive) setError(data.error || "Не удалось загрузить сообщения");
          return;
        }

        const results = data.messages || data.results || [];
        if (!alive) return;

        const last = results.length ? results[results.length - 1] : null;
        const key = last ? `${last.id}_${last.created_at}` : `empty_${results.length}`;
        if (key === lastMsgKeyRef.current) return;
        lastMsgKeyRef.current = key;

        setMessages(results);

        // Шаблон только если диалог пустой
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
      if (document.visibilityState === "hidden") {
        if (pollRef.current) clearInterval(pollRef.current);
      } else {
        load(false);
        startPolling();
      }
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
    setMessages((p) => [
      ...p,
      { id: tempId, text: t, created_at: new Date().toISOString(), is_mine: true },
    ]);
    setText("");
    delete draftsRef.current[activeId];

    requestAnimationFrame(() => {
      const el = listRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });

    try {
      const res = await fetch(`${API_BASE}/api/chat/${activeId}/messages/`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: t }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setMessages((p) => p.filter((m) => m.id !== tempId));
        setText(t);
        setError(data.error || "Не удалось отправить сообщение");
        return;
      }

      if (data.message) {
        setMessages((p) =>
          p.map((m) => (m.id === tempId ? { ...data.message, is_mine: true } : m))
        );
      }

      setDialogs((prev) =>
        prev.map((d) =>
          d.id === activeId
            ? { ...d, last_message: t, last_message_at: new Date().toISOString() }
            : d
        )
      );
    } catch {
      setMessages((p) => p.filter((m) => m.id !== tempId));
      setText(t);
      setError("Ошибка соединения с сервером");
    } finally {
      setSending(false);
    }
  };

  // Enter — отправить, Shift+Enter — новая строка
  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend(e);
    }
  };

  return (
    <div className={`msg ${activeId ? "chat-open" : ""}`}>
      {/* LEFT */}
      <section className="msg__left">
        <div className="msg__leftHead">
          <div className="msg__leftTop">
            <div className="msg__title">Все чаты</div>
          </div>
          <div className="msg__search">
            <input
              className="msg__searchInput"
              placeholder="Поиск"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
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
                <button
                  key={d.id}
                  className={`msgItem ${activeId === d.id ? "isActive" : ""}`}
                  onClick={() => openDialog(d.id)}
                  type="button"
                >
                  <div className="msgItem__avatar">
                    {ava ? (
                      <img className="msgItem__avatarImg" src={ava} alt="" />
                    ) : (
                      <div className="msgItem__avatarEmpty">👤</div>
                    )}
                  </div>

                  <div className="msgItem__body">
                    <div className="msgItem__top">
                      {/* FIX 1: имя не переносится, обрезается */}
                      <div className="msgItem__name">{dialogName(d)}</div>
                      <div className="msgItem__time">{fmtTime(d.last_message_at)}</div>
                    </div>
                    <div className="msgItem__bottom">
                      {/* FIX 2: превью обрезается через CSS */}
                      <div className="msgItem__preview">
                        {d.last_message || "Без сообщений"}
                      </div>
                      {d.unread_count > 0 && (
                        <span className="msgItem__badge">{d.unread_count}</span>
                      )}
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
            <button className="msg__back" onClick={() => setActiveId(null)} type="button">
              ← Назад
            </button>
          )}
          <div className="msg__chatTitle">
            {activeDialog ? dialogName(activeDialog) : "Выберите диалог"}
          </div>
        </header>

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
              // FIX 3: рендерим группы с разделителями по дням
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
                  <div
                    key={item.id}
                    className={`bubbleRow ${mine ? "bubbleRow--mine" : "bubbleRow--their"}`}
                  >
                    <div
                      className={`bubble ${mine ? "bubble--mine" : "bubble--their"} ${
                        isTemp ? "bubble--sending" : ""
                      }`}
                    >
                      <div className="bubble__text">{item.text}</div>
                      <div className="bubble__meta">
                        {isTemp ? "Отправка…" : fmtTime(item.created_at)}
                      </div>
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

          {/* FIX 1: textarea вместо input */}
          <form className="msg__composer" onSubmit={onSend}>
            <textarea
              className="msg__input msg__input--textarea"
              placeholder={
                activeId
                  ? "Написать сообщение… (Enter — отправить, Shift+Enter — новая строка)"
                  : "Выберите диалог слева"
              }
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={onKeyDown}
              disabled={!activeId || sending}
              rows={3}
            />
            <button
              className="msg__send"
              type="submit"
              disabled={!activeId || !text.trim() || sending}
            >
              {sending ? "…" : "Отправить"}
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}