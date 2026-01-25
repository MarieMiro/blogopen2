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
  return (
    d?.other?.name ||
    d?.title ||
    d?.nickname ||
    d?.brand_name ||
    "Диалог"
  );
}

function dialogAvatarUrl(d) {
  return d?.other?.avatar_url || d?.avatar_url || "";
}
export default function BloggerMessages() {
  const location = useLocation();

  const [dialogs, setDialogs] = useState([]);
  const [activeId, setActiveId] = useState(null);

  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");

  const [loadingDialogs, setLoadingDialogs] = useState(true);
  const [loadingChat, setLoadingChat] = useState(false);
  const [error, setError] = useState("");

  const listRef = useRef(null);
  const pollRef = useRef(null);
  const [q, setQ] = useState("");

  const filteredDialogs = useMemo(() => {
  const s = q.trim().toLowerCase();
  if (!s) return dialogs;
  return dialogs.filter((d) => dialogName(d).toLowerCase().includes(s));
}, [q, dialogs]);
  
  const preferredConvId = location.state?.convId ?? null;

  // 1) список диалогов
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

        if (!activeId && results.length > 0) setActiveId(results[0].id);
      } catch {
        if (alive) setError("Ошибка соединения с сервером");
      } finally {
        if (alive) setLoadingDialogs(false);
      }
    })();

    return () => {
      alive = false;
    };
   
  }, []);

  const activeDialog = useMemo(
    () => dialogs.find((d) => d.id === activeId) || null,
    [dialogs, activeId]
  );

  // 2) сообщения выбранного диалога + polling
  useEffect(() => {
    if (!activeId) return;

    let alive = true;

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

        setMessages(results);

        requestAnimationFrame(() => {
          if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
        });
      } catch {
        if (alive) setError("Ошибка соединения с сервером");
      } finally {
        if (alive) setLoadingChat(false);
      }
    };

    load();

    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(load, 2500);

    return () => {
      alive = false;
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [activeId]);

  // 3) отправка (POST в /messages/)
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

      if (!res.ok) {setError(data.error || "Не удалось отправить сообщение");
        return;
      }

     
      const r2 = await fetch(`${API_BASE}/api/chat/${activeId}/messages/`, {
        credentials: "include",
      });
      const d2 = await r2.json().catch(() => ({}));
      if (r2.ok) setMessages(d2.messages || d2.results || []);
    } catch {
      setError("Ошибка соединения с сервером");
    }
  };

const openDialog = (id) => {
  setActiveId(id);
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
  ref={listRef}>
      {loadingChat ? (
        <div className="msg__muted">Загрузка сообщений…</div>
      ) : !activeId ? (
        <div className="msg__muted">Выберите диалог слева</div>
      ) : (
        messages.map((m) => {
          const mine = m.is_mine ?? false;
          return (
            <div key={m.id} className={`bubbleRow ${mine ? "bubbleRow--mine" : "bubbleRow--their"}`}>
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