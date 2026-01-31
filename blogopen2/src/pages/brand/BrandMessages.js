import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import "./brandMessages.css";
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

// ✅ проверка: пользователь почти внизу?
function isNearBottom(el, px = 120) {
  if (!el) return true;
  const { scrollTop, scrollHeight, clientHeight } = el;
  return scrollHeight - (scrollTop + clientHeight) <= px;
}

// ✅ шаблон для бренда
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
  const [error, setError] = useState("");

  const [q, setQ] = useState("");

  const listRef = useRef(null);

  // ✅ refs для “умного” polling/скролла
  const pollRef = useRef(null);
  const isAtBottomRef = useRef(true);
  const lastMsgKeyRef = useRef("");

  // ✅ чтобы шаблон вставлялся один раз на диалог
  const didPrefillRef = useRef(false);

  const preferredConvId = location.state?.convId ?? null;

  const filteredDialogs = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return dialogs;
    return dialogs.filter((d) => dialogName(d).toLowerCase().includes(s));
  }, [q, dialogs]);

  const openDialog = (id) => setActiveId(id);

  const activeDialog = useMemo(
    () => dialogs.find((d) => d.id === activeId) || null,
    [dialogs, activeId]
  );

  // ✅ 1) ДИАЛОГИ — загружаем один раз (без polling)
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

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ✅ 1.5) при смене диалога разрешаем снова вставить шаблон
  useEffect(() => {
    didPrefillRef.current = false;
  }, [activeId]);

  // ✅ 1.6) вставляем шаблон (один раз), если поле пустое
  useEffect(() => {
    if (!activeId || !activeDialog) return;
    if (didPrefillRef.current) return;

    setText((prev) => {
      if (prev && prev.trim().length > 0) return prev;
      return buildBrandTemplate(activeDialog);
    });

    didPrefillRef.current = true;
  }, [activeId, activeDialog]);

  // ✅ 2) MESSAGES + polling 10 сек + пауза на hidden + без “прыжков” скролла
  useEffect(() => {
    if (!activeId) return;

    let alive = true;
    lastMsgKeyRef.current = "";

    const load = async () => {
      try {
        setError("");
        setLoadingChat(true);

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

        // ✅ обновляем state только если реально изменилось последнее сообщение
        const last = results.length ? results[results.length - 1] : null;
        const key = last ? `${last.id}_${last.created_at}` : `empty_${results.length}`;
        if (key === lastMsgKeyRef.current) return;
        lastMsgKeyRef.current = key;

        setMessages(results);

        requestAnimationFrame(() => {
          const el = listRef.current;
          if (!el) return;

          // автоскролл только если пользователь внизу
          if (isAtBottomRef.current) {
            el.scrollTop = el.scrollHeight;
          }
        });
      } catch {
        if (alive) setError("Ошибка соединения с сервером");
      } finally {
        if (alive) setLoadingChat(false);
      }
    };

    // стартовая загрузка
    load();

    const startPolling = () => {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(load, 10000); // ✅ 10 секунд
    };
    startPolling();

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        if (pollRef.current) clearInterval(pollRef.current);
      } else {
        load();
        startPolling();
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      alive = false;
      if (pollRef.current) clearInterval(pollRef.current);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [activeId]);

  // ✅ 3) отправка сообщения
  const onSend = async (e) => {
    e.preventDefault();

    const t = text.trim();
    if (!t || !activeId) return;

    const tempId = `tmp_${Date.now()}`;
    setMessages((p) => [
      ...p,
      { id: tempId, text: t, created_at: new Date().toISOString(), is_mine: true },
    ]);
    setText("");

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
        setError(data.error || "Не удалось отправить сообщение");
        return;
      }

      // сразу обновим сообщения
      const r2 = await fetch(`${API_BASE}/api/chat/${activeId}/messages/`, {
        credentials: "include",
      });
      const d2 = await r2.json().catch(() => ({}));
      if (r2.ok) setMessages(d2.messages || d2.results || []);

      // обновим список диалогов (последнее сообщение/время)
      const rChat = await fetch(`${API_BASE}/api/chat/`, { credentials: "include" });
      const dChat = await rChat.json().catch(() => ({}));
      if (rChat.ok) setDialogs(dChat.results || []);
    } catch {
      setError("Ошибка соединения с сервером");
    }
  };

  return (
    <div className="msg">
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
                      <div className="msgItem__preview">{d.last_message || "Без сообщений"}</div>
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
            ) : (
              messages.map((m) => {
                const mine = m.is_mine ?? false;
                return (
                  <div
                    key={m.id}
                    className={`bubbleRow ${mine ? "bubbleRow--mine" : "bubbleRow--their"}`}
                  >
                    <div className={`bubble ${mine ? "bubble--mine" : "bubble--their"}`}>
                      <div className="bubble__text">{m.text}</div>
                      <div className="bubble__meta">{fmtTime(m.created_at)}</div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <form className="msg__composer" onSubmit={onSend}>
            <input
              className="msg__input"
              placeholder={activeId ? "Написать сообщение…" : "Выберите диалог слева"}
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={!activeId}
            />
            <button className="msg__send" type="submit" disabled={!activeId || !text.trim()}>
              Отправить
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}