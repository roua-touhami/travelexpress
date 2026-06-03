import { useState, useEffect, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { getMyChats } from "../api/auth";

export default function ChatList() {
  const navigate = useNavigate();
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchChats = useCallback(() => {
    getMyChats()
      .then((res) => {
        const sorted = [...res.data].sort(
          (a, b) => new Date(b.last_message_at) - new Date(a.last_message_at),
        );
        setChats(sorted);
      })
      .catch((err) => {
        if (err.response?.status === 401) navigate("/login");
      })
      .finally(() => setLoading(false));
  }, [navigate]);

  useEffect(() => {
    if (!localStorage.getItem("token")) {
      navigate("/login");
      return;
    }
    fetchChats();
    const interval = setInterval(fetchChats, 5000);
    return () => clearInterval(interval);
  }, [fetchChats, navigate]);

  const totalUnread = chats.reduce((sum, c) => sum + (c.unread_count || 0), 0);

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.logo}>✈ TravelExpress</div>
          <Link to="/dashboard" style={styles.backBtn}>
            ← Dashboard
          </Link>
        </div>

        <div style={styles.titleRow}>
          <h2 style={styles.title}>💬 My Conversations</h2>
          {totalUnread > 0 && (
            <span style={styles.totalBadge}>{totalUnread} unread</span>
          )}
        </div>

        {loading ? (
          <p style={{ textAlign: "center", color: "#6b7280" }}>Loading...</p>
        ) : chats.length === 0 ? (
          <div style={styles.empty}>
            <p style={{ fontSize: "40px", marginBottom: "12px" }}>💬</p>
            <p style={{ color: "#6b7280" }}>No conversations yet.</p>
            <p style={{ color: "#9ca3af", fontSize: "13px" }}>
              Chats open automatically when an application is accepted.
            </p>
          </div>
        ) : (
          <div style={styles.list}>
            {chats.map((chat) => {
              const hasUnread = chat.unread_count > 0;
              return (
                <div
                  key={chat.application_id}
                  style={{
                    ...styles.chatCard,
                    borderLeft: hasUnread
                      ? "4px solid #1a56db"
                      : "4px solid transparent",
                    background: hasUnread ? "#f8faff" : "#fff",
                  }}
                  onClick={() => navigate(`/chat/${chat.application_id}`)}
                >
                  {/* Avatar */}
                  <div style={styles.avatarWrap}>
                    <div style={styles.chatAvatar}>
                      {chat.other_user_name.charAt(0).toUpperCase()}
                    </div>
                    {hasUnread && <div style={styles.unreadDot} />}
                  </div>

                  {/* Info */}
                  <div style={styles.chatInfo}>
                    <div style={styles.chatTopRow}>
                      <span
                        style={{
                          ...styles.chatName,
                          fontWeight: hasUnread ? "800" : "700",
                        }}
                      >
                        {chat.other_user_name}
                      </span>
                      <span style={styles.chatTime}>
                        {new Date(chat.last_message_at).toLocaleDateString()}
                      </span>
                    </div>
                    <div style={styles.chatProduct}>📦 {chat.product_name}</div>
                    <div style={styles.chatRoute}>
                      ✈ {chat.departure_city} → {chat.arrival_city}
                    </div>
                    <div style={styles.lastMsgRow}>
                      {chat.last_message && (
                        <span
                          style={{
                            ...styles.lastMessage,
                            color: hasUnread ? "#1a56db" : "#9ca3af",
                            fontWeight: hasUnread ? "600" : "400",
                          }}
                        >
                          {chat.last_message.length > 45
                            ? chat.last_message.slice(0, 45) + "…"
                            : chat.last_message}
                        </span>
                      )}
                      {hasUnread && (
                        <span style={styles.unreadBadge}>
                          {chat.unread_count}
                        </span>
                      )}
                    </div>
                  </div>

                  <div style={styles.chatArrow}>›</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#f0f4f8",
    fontFamily: "'Segoe UI', sans-serif",
    padding: "24px",
  },
  container: { maxWidth: "600px", margin: "0 auto" },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "24px",
  },
  logo: { fontSize: "22px", fontWeight: "700", color: "#1a56db" },
  backBtn: {
    color: "#1a56db",
    fontWeight: "600",
    textDecoration: "none",
    fontSize: "14px",
  },
  titleRow: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    marginBottom: "20px",
  },
  title: { fontSize: "22px", fontWeight: "700", color: "#111", margin: 0 },
  totalBadge: {
    padding: "3px 10px",
    background: "#1a56db",
    color: "#fff",
    borderRadius: "20px",
    fontSize: "12px",
    fontWeight: "700",
  },
  empty: { textAlign: "center", padding: "60px 20px" },
  list: { display: "flex", flexDirection: "column", gap: "10px" },
  chatCard: {
    background: "#fff",
    borderRadius: "12px",
    padding: "16px 16px 16px 14px",
    boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
    display: "flex",
    alignItems: "center",
    gap: "14px",
    cursor: "pointer",
    transition: "box-shadow 0.2s, background 0.15s",
  },
  avatarWrap: { position: "relative", flexShrink: 0 },
  chatAvatar: {
    width: "48px",
    height: "48px",
    borderRadius: "50%",
    background: "#1a56db",
    color: "#fff",
    fontSize: "20px",
    fontWeight: "700",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  unreadDot: {
    position: "absolute",
    top: 0,
    right: 0,
    width: "12px",
    height: "12px",
    borderRadius: "50%",
    background: "#ef4444",
    border: "2px solid #f8faff",
  },
  chatInfo: { flex: 1, minWidth: 0 },
  chatTopRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "2px",
  },
  chatName: { fontSize: "15px", color: "#111" },
  chatTime: {
    fontSize: "11px",
    color: "#9ca3af",
    flexShrink: 0,
    marginLeft: "8px",
  },
  chatProduct: { fontSize: "13px", color: "#374151", marginBottom: "1px" },
  chatRoute: { fontSize: "12px", color: "#6b7280", marginBottom: "4px" },
  lastMsgRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  lastMessage: {
    fontSize: "12px",
    fontStyle: "italic",
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  unreadBadge: {
    flexShrink: 0,
    marginLeft: "8px",
    minWidth: "20px",
    height: "20px",
    borderRadius: "10px",
    background: "#1a56db",
    color: "#fff",
    fontSize: "11px",
    fontWeight: "700",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "0 5px",
  },
  chatArrow: { fontSize: "20px", color: "#d1d5db", flexShrink: 0 },
};
