import axios from "axios";
import {
  Bot,
  ChevronDown,
  Clock,
  MessageCircle,
  Send,
  ShieldAlert,
  Trash2,
  X,
} from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "./AuthContext";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

const suggestedQuestions = [
  "Is my city safe?",
  "Current weather",
  "Disaster precautions",
  "Emergency contacts",
  "Why was this disaster predicted?",
];

function formatTime(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function normalizeMessages(messages = []) {
  return messages.map((message, index) => ({
    id: `${message.role}-${message.createdAt || index}-${index}`,
    role: message.role,
    content: message.content,
    createdAt: message.createdAt || new Date().toISOString(),
  }));
}

export default function DisasterChatbot({ currentCity }) {
  const { token, user } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [error, setError] = useState("");
  const listRef = useRef(null);
  const inputRef = useRef(null);

  const headers = useMemo(() => ({
    Authorization: `Bearer ${token}`,
  }), [token]);

  useEffect(() => {
    if (!open || !token) return;

    let active = true;
    setHistoryLoading(true);
    setError("");

    axios
      .get(`${API_BASE_URL}/api/chatbot/history`, { headers })
      .then((res) => {
        if (!active) return;
        setMessages(normalizeMessages(res.data.messages));
      })
      .catch((err) => {
        if (!active) return;
        setError(err.response?.data?.message || "Unable to load chat history.");
      })
      .finally(() => {
        if (active) setHistoryLoading(false);
      });

    return () => {
      active = false;
    };
  }, [headers, open, token]);

  useEffect(() => {
    if (!open) return;
    listRef.current?.scrollTo({
      top: listRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, loading, open]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 180);
  }, [open]);

  async function sendMessage(text = input) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const now = new Date().toISOString();
    setInput("");
    setError("");
    setLoading(true);
    setMessages((items) => [
      ...items,
      { id: `local-user-${Date.now()}`, role: "user", content: trimmed, createdAt: now },
    ]);

    try {
      const res = await axios.post(
        `${API_BASE_URL}/api/chatbot/message`,
        { message: trimmed },
        { headers }
      );
      setMessages(normalizeMessages(res.data.messages));
    } catch (err) {
      setError(err.response?.data?.message || "Assistant is unavailable right now.");
      setMessages((items) => [
        ...items,
        {
          id: `local-error-${Date.now()}`,
          role: "assistant",
          content: "I could not process that request. Please try again.",
          createdAt: new Date().toISOString(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function clearHistory() {
    if (loading || historyLoading) return;
    setError("");

    try {
      await axios.delete(`${API_BASE_URL}/api/chatbot/history`, { headers });
      setMessages([]);
    } catch (err) {
      setError(err.response?.data?.message || "Unable to clear chat history.");
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    sendMessage();
  }

  return (
    <div className={`chatbot-shell ${open ? "open" : ""}`}>
      {open && (
        <section className="chatbot-window" aria-label="Disaster Assistant Chatbot">
          <header className="chatbot-header">
            <div className="chatbot-title-wrap">
              <span className="chatbot-avatar">
                <Bot size={20} />
              </span>
              <div>
                <h2>Disaster Assistant</h2>
                <p>{user?.city || currentCity || "Your city"} risk helper</p>
              </div>
            </div>
            <div className="chatbot-header-actions">
              <button type="button" onClick={clearHistory} title="Clear chat history" aria-label="Clear chat history">
                <Trash2 size={16} />
              </button>
              <button type="button" onClick={() => setOpen(false)} title="Minimize chat" aria-label="Minimize chat">
                <ChevronDown size={18} />
              </button>
            </div>
          </header>

          <div className="chatbot-suggestions" aria-label="Suggested questions">
            {suggestedQuestions.map((question) => (
              <button
                type="button"
                key={question}
                onClick={() => sendMessage(question)}
                disabled={loading}
              >
                {question}
              </button>
            ))}
          </div>

          <div className="chatbot-messages" ref={listRef}>
            {historyLoading && (
              <div className="chatbot-loading-row">
                <span className="silent-spinner" />
                Loading previous conversations
              </div>
            )}

            {!historyLoading && messages.length === 0 && (
              <div className="chatbot-empty">
                <ShieldAlert size={30} />
                <strong>Ask about disaster risk, alerts, weather, or precautions.</strong>
                <span>Responses use your city and current prediction data.</span>
              </div>
            )}

            {messages.map((message) => (
              <article className={`chat-message ${message.role}`} key={message.id}>
                <div className="chat-bubble">{message.content}</div>
                <time>
                  <Clock size={11} />
                  {formatTime(message.createdAt)}
                </time>
              </article>
            ))}

            {loading && (
              <article className="chat-message assistant typing">
                <div className="chat-bubble">
                  <span />
                  <span />
                  <span />
                </div>
              </article>
            )}
          </div>

          {error && <div className="chatbot-error">{error}</div>}

          <form className="chatbot-input-row" onSubmit={handleSubmit}>
            <input
              ref={inputRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask about risk, weather, alerts..."
              maxLength={1000}
            />
            <button type="submit" disabled={loading || !input.trim()} aria-label="Send message">
              <Send size={17} />
            </button>
          </form>
        </section>
      )}

      <button
        type="button"
        className="chatbot-toggle"
        onClick={() => setOpen((value) => !value)}
        aria-label={open ? "Close disaster assistant" : "Open disaster assistant"}
      >
        {open ? <X size={24} /> : <MessageCircle size={25} />}
      </button>
    </div>
  );
}
