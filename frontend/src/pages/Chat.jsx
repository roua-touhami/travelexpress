import { useParams, Link, useNavigate } from "react-router-dom";
import {
  getMessages,
  sendMessage,
  uploadImage,
  markChatAsRead,
} from "../api/auth";
import { useState, useEffect, useRef, useCallback } from "react";

export default function Chat() {
  const { appId } = useParams();
  const navigate = useNavigate();
  const bottomRef = useRef(null);
  const fileRef = useRef(null);

  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);

  // Decode current user from JWT
  const currentUserId = (() => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return null;
      const payload = JSON.parse(atob(token.split(".")[1]));
      return parseInt(payload.sub);
    } catch {
      return null;
    }
  })();

  // ── Fetch messages ────────────────────────────────────────────────────────
  const fetchMessages = useCallback(async () => {
    try {
      const res = await getMessages(appId);
      setMessages((prev) =>
        JSON.stringify(res.data) !== JSON.stringify(prev) ? res.data : prev,
      );
    } catch (err) {
      if (err.response?.status === 403) navigate("/dashboard");
    }
  }, [appId, navigate]);

  // ── Mark as read silently ─────────────────────────────────────────────────
  const markRead = useCallback(async () => {
    try {
      await markChatAsRead(appId);
    } catch {
      /* ignore */
    }
  }, [appId]);

  useEffect(() => {
    if (!localStorage.getItem("token")) {
      navigate("/login");
      return;
    }

    // Fetch + mark read immediately on open
    const init = async () => {
      await fetchMessages();
      await markRead();
    };
    init();

    // Poll every 5s, mark read after each fetch
    const interval = setInterval(async () => {
      await fetchMessages();
      await markRead();
    }, 5000);

    return () => clearInterval(interval);
  }, [fetchMessages, markRead, navigate]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // ── Send text ─────────────────────────────────────────────────────────────
  const handleSend = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    setSending(true);
    setError("");
    try {
      await sendMessage(appId, { content: text.trim() });
      setText("");
      await fetchMessages();
    } catch (err) {
      setError(err.response?.data?.detail || "Error sending message");
    } finally {
      setSending(false);
    }
  };

  // ── Send image ────────────────────────────────────────────────────────────
  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const res = await uploadImage(appId, file);
      await sendMessage(appId, { image_url: res.data.image_url });
      await fetchMessages();
    } catch (err) {
      setError(err.response?.data?.detail || "Error uploading image");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  // ── Group by date ─────────────────────────────────────────────────────────
  const groupedMessages = messages.reduce((groups, msg) => {
    const date = new Date(msg.created_at).toLocaleDateString();
    if (!groups[date]) groups[date] = [];
    groups[date].push(msg);
    return groups;
  }, {});

  return (
    <div style={styles.page}>
      {/* ── Header ── */}
      <div style={styles.header}>
        <Link to="/chats" style={styles.backBtn}>
          ← Back
        </Link>
        <div style={styles.headerCenter}>
          <div style={styles.headerTitle}>💬 Chat</div>
          <div style={styles.headerSub}>Application #{appId}</div>
        </div>
        <div style={{ width: "60px" }} />
      </div>

      {/* ── Messages ── */}
      <div style={styles.messagesContainer}>
        {Object.entries(groupedMessages).map(([date, msgs]) => (
          <div key={date}>
            <div style={styles.dateSeparator}>
              <span style={styles.dateLabel}>{date}</span>
            </div>

            {msgs.map((msg) => {
              const isMe = msg.sender_id === currentUserId;
              return (
                <div
                  key={msg.id}
                  style={{
                    ...styles.messageRow,
                    justifyContent: isMe ? "flex-end" : "flex-start",
                  }}
                >
                  {/* Avatar other */}
                  {!isMe && (
                    <div style={styles.avatar}>
                      {msg.sender_name.charAt(0).toUpperCase()}
                    </div>
                  )}

                  <div style={{ maxWidth: "65%" }}>
                    {!isMe && (
                      <div style={styles.senderName}>{msg.sender_name}</div>
                    )}

                    <div
                      style={{
                        ...styles.bubble,
                        background: isMe ? "#1a56db" : "#fff",
                        color: isMe ? "#fff" : "#111",
                        borderRadius: isMe
                          ? "18px 18px 4px 18px"
                          : "18px 18px 18px 4px",
                        boxShadow: isMe
                          ? "0 2px 8px rgba(26,86,219,0.3)"
                          : "0 2px 8px rgba(0,0,0,0.08)",
                      }}
                    >
                      {msg.image_url && (
                        <img
                          src={
                            msg.image_url.startsWith("http")
                              ? msg.image_url
                              : `${import.meta.env.VITE_API_URL}${msg.image_url}`
                          }
                          alt="attachment"
                          style={styles.messageImage}
                          onClick={() =>
                            window.open(
                              msg.image_url.startsWith("http")
                                ? msg.image_url
                                : `${import.meta.env.VITE_API_URL}${msg.image_url}`,
                              "_blank",
                            )
                          }
                        />
                      )}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "flex-end",
                          gap: "4px",
                          marginTop: "4px",
                        }}
                      >
                        <span
                          style={{
                            ...styles.messageTime,
                            color: isMe ? "rgba(255,255,255,0.65)" : "#9ca3af",
                          }}
                        >
                          {new Date(msg.created_at).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                        {/* ✓✓ read receipt for own messages */}
                        {isMe && (
                          <span
                            style={{
                              fontSize: "11px",
                              color: msg.is_read
                                ? "#93c5fd"
                                : "rgba(255,255,255,0.4)",
                            }}
                          >
                            {msg.is_read ? "✓✓" : "✓"}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Avatar me */}
                  {isMe && (
                    <div
                      style={{
                        ...styles.avatar,
                        background: "#1a56db",
                        fontSize: "11px",
                      }}
                    >
                      Me
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* ── Error ── */}
      {error && <div style={styles.errorBanner}>{error}</div>}

      {/* ── Input ── */}
      <div style={styles.inputArea}>
        <button
          style={styles.imageBtn}
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          title="Send image"
        >
          {uploading ? "⏳" : "🖼"}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={handleImageUpload}
        />
        <form onSubmit={handleSend} style={styles.inputForm}>
          <input
            style={styles.textInput}
            placeholder="Type a message..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={sending}
          />
          <button
            style={{
              ...styles.sendBtn,
              background: text.trim() ? "#1a56db" : "#e5e7eb",
              color: text.trim() ? "#fff" : "#9ca3af",
              cursor: text.trim() ? "pointer" : "default",
            }}
            disabled={sending || !text.trim()}
          >
            {sending ? "⏳" : "➤"}
          </button>
        </form>
      </div>
    </div>
  );
}

const styles = {
  page: {
    display: "flex",
    flexDirection: "column",
    height: "100vh",
    background: "#f0f4f8",
    fontFamily: "'Segoe UI', sans-serif",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "14px 20px",
    background: "#fff",
    boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
    flexShrink: 0,
  },
  backBtn: {
    color: "#1a56db",
    fontWeight: "600",
    textDecoration: "none",
    fontSize: "14px",
    minWidth: "60px",
  },
  headerCenter: { textAlign: "center" },
  headerTitle: { fontSize: "16px", fontWeight: "700", color: "#111" },
  headerSub: { fontSize: "12px", color: "#6b7280" },
  messagesContainer: {
    flex: 1,
    overflowY: "auto",
    padding: "20px 16px",
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  dateSeparator: {
    display: "flex",
    justifyContent: "center",
    margin: "16px 0 8px",
  },
  dateLabel: {
    background: "#e5e7eb",
    color: "#6b7280",
    fontSize: "11px",
    fontWeight: "600",
    padding: "4px 12px",
    borderRadius: "20px",
  },
  messageRow: {
    display: "flex",
    alignItems: "flex-end",
    gap: "8px",
    marginBottom: "4px",
  },
  avatar: {
    width: "32px",
    height: "32px",
    borderRadius: "50%",
    background: "#6b7280",
    color: "#fff",
    fontSize: "12px",
    fontWeight: "700",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  senderName: {
    fontSize: "11px",
    color: "#6b7280",
    marginBottom: "3px",
    marginLeft: "4px",
  },
  bubble: { padding: "10px 14px", maxWidth: "100%" },
  messageText: {
    margin: 0,
    fontSize: "14px",
    lineHeight: 1.5,
    wordBreak: "break-word",
  },
  messageImage: {
    maxWidth: "240px",
    maxHeight: "240px",
    borderRadius: "10px",
    display: "block",
    cursor: "pointer",
    marginTop: "4px",
  },
  messageTime: { fontSize: "10px" },
  errorBanner: {
    background: "#fef2f2",
    border: "1px solid #fca5a5",
    color: "#dc2626",
    padding: "10px 16px",
    fontSize: "13px",
    flexShrink: 0,
  },
  inputArea: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "12px 16px",
    background: "#fff",
    borderTop: "1px solid #e5e7eb",
    flexShrink: 0,
  },
  imageBtn: {
    width: "42px",
    height: "42px",
    borderRadius: "50%",
    background: "#f3f4f6",
    border: "none",
    fontSize: "18px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  inputForm: { display: "flex", gap: "8px", flex: 1 },
  textInput: {
    flex: 1,
    padding: "10px 16px",
    borderRadius: "24px",
    border: "1.5px solid #e5e7eb",
    fontSize: "14px",
    outline: "none",
    fontFamily: "'Segoe UI', sans-serif",
  },
  sendBtn: {
    width: "42px",
    height: "42px",
    borderRadius: "50%",
    border: "none",
    fontSize: "18px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    transition: "background 0.2s",
  },
};
