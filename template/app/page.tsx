"use client";

import { useChat } from "@ai-sdk/react";
import { useState, type FormEvent, type ReactNode } from "react";

export default function ChatPage(): ReactNode {
  const { messages, sendMessage, status } = useChat();
  const [input, setInput] = useState("");

  const busy = status === "submitted" || status === "streaming";

  function onSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    void sendMessage({ text });
    setInput("");
  }

  return (
    <main className="chat">
      <h1>InfoLang Chatbot</h1>
      <p className="sub">
        I remember you across sessions. Tell me something about yourself, then
        come back later and ask.
      </p>

      <div className="messages">
        {messages.length === 0 ? (
          <p className="empty">Say hello to start a conversation.</p>
        ) : (
          messages.map((message) => (
            <div key={message.id} className={`msg ${message.role}`}>
              <div className="role">{message.role}</div>
              {message.parts.map((part, index) =>
                part.type === "text" ? (
                  <span key={index}>{part.text}</span>
                ) : null,
              )}
            </div>
          ))
        )}
      </div>

      <form onSubmit={onSubmit}>
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Type a message…"
          aria-label="Message"
        />
        <button type="submit" disabled={busy}>
          Send
        </button>
      </form>
    </main>
  );
}
