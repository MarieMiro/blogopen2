import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import "./bloggerMessage.css";
import { API_BASE } from "../../api";

function fmtTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

function dialogName(d) {
  return d?.other?.name || d?.title || d?.nickname || d?.brand_name || "Диалог";
}

function dialogAvatarUrl(d) {
  return d?.other?.avatar_url || d?.avatar_url || "";
}

function buildBloggerTemplate(activeDialog) {
  const name = activeDialog ? dialogName(activeDialog) : "";
  return `Привет${name ? `, ${name}` : ""}! 👋

Я пишу с платформы BlogOpen. Хочу предложить сотрудничество.

Коротко о задаче:
— продукт/услуга: ____
— формат: ____
— сроки: ____
— бюджет: ____

Если интересно — подскажи, пожалуйста:
1) прайс/условия
2) свободные даты
3) куда удобнее прислать ТЗ

Спасибо!`;
}

export default function BloggerMessages() {
  const location = useLocation();

  const [dialogs, setDialogs] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");

  const [loadingDialogs, setLoadingDialogs] = useState(true);
  const [loadingChat, setLoadingChat] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const listRef = useRef(null);
  const isAtBottomRef = useRef(true);
  const pollRef = useRef(null);

  // Черновики по id диалога — чтобы не терять текст при переключении
  const draftsRef = useRef({});

  const [q, setQ] = useState("");
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

  // =========================
  // Открыть диалог
  // =========================
  const openDialog = async (id) => {
    // Сохраняем черновик текущего диалога
    if (activeId) {
      draftsRef.current[activeId] = text;
    }

    setActiveId(id);
    setMessages([]);

    // Помечаем как прочитанное
    try {
      await fetch(`${API_BASE}/api/chat/${id}/read/`, {
        method: "POST",
        credentials: "include",
      });
    } catch {
      // не критично
    }

    // Сбрасываем счётчик непрочитанных локально
    setDialogs((prev) =>
      prev.map((d) => (d.id === id ? { ...d, unread_count: 0 } : d))
    );
  };

  // =========================
  // 1) Загрузка диалогов
  // =========================
  useEffect(() => {
    let alive = true;

    const loadDialogs = async () => {
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

        if (results.length > 0) {
          setActiveId((prev) => prev ?? results[0].id);
        }
      } catch {
        if (alive) setError("Ошибка соединения с сервером");
      } finally {
        if (alive) setLoadingDialogs(false);
      }
    };

    loadDialogs();

    // Polling диалогов каждые 30 сек — чтобы появлялись новые диалоги
    const dialogsPoll = setInterval(async () => {
      if (!alive) return;
      try {
        const res = await fetch(`${API_BASE}/api/chat/`, { credentials: "include" });
        const data = await res.json().catch(() => ({}));
        if (res.ok && alive) setDialogs(data.results || []);
      } catch {
        // тихо
      }
    }, 30000);

    return () => {
      alive = false;
      clearInterval(dialogsPoll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // =========================
  // 2) Текст при смене диалога:
  //    - если есть черновик — восстанавливаем
  //    - если диалог новый (нет сообщений) — шаблон
  //    - если диалог с историей — пустое поле
  // =========================
  useEffect(() => {
    if (!activeId) return;

    // Есть сохранённый черновик — восстанавливаем
    if (draftsRef.current[activeId] !== undefined) {
      setText(draftsRef.current[activeId]);
      return;
    }

    // Черновика нет — ждём загрузки сообщений,
    // текст выставится в блоке загрузки сообщений (эффект ниже)
    setText("");
  }, [activeId]);

  // =========================
  // 3) Сообщения: polling 10s
  // =========================
  useEffect(() => {
    if (!activeId) return;

    let alive = true;

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

        setMessages(results);

        // Шаблон показываем ТОЛЬКО если диалог пустой (нет сообщений)
        // и черновика нет
        if (isFirst && results.length === 0 && draftsRef.current[activeId] === undefined) {
          setText(buildBloggerTemplate(activeDialog));
        }

        requestAnimationFrame(() => {
          if (!listRef.current) return;
          if (isAtBottomRef.current) {
            listRef.current.scrollTop = listRef.current.scrollHeight;
          }
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

  // =========================
  // 4) Отправка сообщения
  // =========================
  const onSend = async (e) => {
    e.preventDefault();

    const t = text.trim();
    if (!t || !activeId || sending) return;

    setSending(true);
    setError("");

    // Optimistic UI
    const tempId = `tmp_${Date.now()}`;
    setMessages((p) => [
      ...p,
      { id: tempId, text: t, created_at: new Date().toISOString(), is_mine: true },
    ]);
    setText("");

    // Удаляем черновик — сообщение отправлено
    delete draftsRef.current[activeId];

    requestAnimationFrame(() => {
      if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
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
        // Откатываем optimistic сообщение
        setMessages((p) => p.filter((m) => m.id !== tempId));
        setText(t); // возвращаем текст пользователю
        setError(data.error || "Не удалось отправить сообщение");
        return;
      }

      // Заменяем временное сообщение на реальное
      if (data.message) {
        setMessages((p) =>
          p.map((m) => (m.id === tempId ? { ...data.message, is_mine: true } : m))
        );
      }

      // Обновляем превью диалога локально — без лишнего запроса
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

  // Enter = отправить, Shift+Enter = новая строка
  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend(e);
    }
  };

  // =========================
  // RENDER
  // =========================
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
                      <div className="msgItem__name">{dialogName(d)}</div>
                      <div className="msgItem__time">{fmtTime(d.last_message_at)}</div>
                    </div>
                    <div className="msgItem__bottom">
                      <div className="msgItem__preview">
                        {d.last_message || "Без сообщений"}
                      </div>
                      {/* Счётчик непрочитанных */}
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
            <button
              className="msg__back"
              onClick={() => setActiveId(null)}
              type="button"
            >
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
              const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
              isAtBottomRef.current = nearBottom;
            }}
          >
            {loadingChat ? (
              <div className="msg__muted">Загрузка сообщений…</div>
            ) : !activeId ? (
              <div className="msg__muted">Выберите диалог слева</div>
            ) : messages.length === 0 ? (
              <div className="msg__muted">Начните диалог — отправьте первое сообщение</div>
            ) : (
              messages.map((m) => {
                const mine = m.is_mine ?? false;
                const isTemp = String(m.id).startsWith("tmp_");
                return (
                  <div
                    key={m.id}
                    className={`bubbleRow ${mine ? "bubbleRow--mine" : "bubbleRow--their"}`}
                  >
                    <div
                      className={`bubble ${mine ? "bubble--mine" : "bubble--their"} ${
                        isTemp ? "bubble--sending" : ""
                      }`}
                    >
                      <div className="bubble__text">{m.text}</div>
                      <div className="bubble__meta">
                        {isTemp ? "Отправка…" : fmtTime(m.created_at)}
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

          <form className="msg__composer" onSubmit={onSend}>
            <textarea
              className="msg__input msg__input--textarea"
              placeholder={activeId ? "Написать сообщение… (Enter — отправить, Shift+Enter — новая строка)" : "Выберите диалог слева"}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={onKeyDown}
              disabled={!activeId || sending}
              rows={2}
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