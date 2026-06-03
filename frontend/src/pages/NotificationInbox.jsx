import { useState, useEffect } from "react";
import { getNotifications, respondApplication } from "../api/auth";

const TYPE_LABEL = {
  new_request: "New request",
  request_accepted: "Request accepted",
  request_rejected: "Request rejected",
};

const STATUS_COLORS = {
  pending: { color: "#d97706", bg: "#fffbeb", border: "#fcd34d" },
  accepted: { color: "#16a34a", bg: "#f0fdf4", border: "#86efac" },
  rejected: { color: "#dc2626", bg: "#fef2f2", border: "#fca5a5" },
};

function StatusBadge({ status }) {
  const s = STATUS_COLORS[status] || STATUS_COLORS.pending;
  return (
    <span
      style={{
        padding: "2px 10px",
        borderRadius: "20px",
        fontSize: "11px",
        fontWeight: "700",
        color: s.color,
        background: s.bg,
        border: `1px solid ${s.border}`,
      }}
    >
      {status.toUpperCase()}
    </span>
  );
}

export default function NotificationInbox({ onClose }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [tab, setTab] = useState("all");
  const [respondMsg, setRespondMsg] = useState("");
  const [responding, setResponding] = useState(false);
  const [respondError, setRespondError] = useState("");

  // ── Fetch on open — also marks applicant notifs as read on the backend ──
  useEffect(() => {
    setError("");
    getNotifications()
      .then((res) => {
        setNotifications(res.data);
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load notifications.");
        setLoading(false);
      });
  }, []);

  const filtered = notifications.filter((n) => {
    if (tab === "received") return n.type === "new_request";
    if (tab === "mine") return n.type !== "new_request";
    return true;
  });

  // Count truly unread items in the list for the dot indicator
  const unreadCount = notifications.filter(
    (n) => n.type !== "new_request" && !n.is_read,
  ).length;

  const handleRespond = async (status) => {
    if (!respondMsg.trim()) {
      setRespondError("Please write a response message.");
      return;
    }
    setRespondError("");
    setResponding(true);
    try {
      await respondApplication(selected.application_id, {
        status,
        response_message: respondMsg,
      });
      const updated = await getNotifications();
      setNotifications(updated.data);
      setSelected(
        updated.data.find(
          (n) => n.application_id === selected.application_id,
        ) || null,
      );
      setRespondMsg("");
    } catch (err) {
      setRespondError(err.response?.data?.detail || "Failed to send response.");
    } finally {
      setResponding(false);
    }
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.panel} onClick={(e) => e.stopPropagation()}>
        {/* ── Header ── */}
        <div style={styles.panelHeader}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontWeight: "700", fontSize: "16px" }}>
              Notifications
            </span>
            {unreadCount > 0 && (
              <span style={styles.headerBadge}>{unreadCount} new</span>
            )}
          </div>
          <button onClick={onClose} style={styles.closeBtn}>
            ✕
          </button>
        </div>

        {/* ── Tabs ── */}
        <div style={styles.tabBar}>
          {["all", "received", "mine"].map((t) => (
            <button
              key={t}
              style={tab === t ? styles.tabActive : styles.tab}
              onClick={() => setTab(t)}
            >
              {t === "all"
                ? "All"
                : t === "received"
                  ? "Received"
                  : "My requests"}
            </button>
          ))}
        </div>

        {/* ── Body ── */}
        <div style={styles.body}>
          {/* List */}
          <div style={styles.list}>
            {loading ? (
              <p style={styles.empty}>Loading...</p>
            ) : error ? (
              <p style={{ ...styles.empty, color: "#dc2626" }}>{error}</p>
            ) : filtered.length === 0 ? (
              <p style={styles.empty}>No notifications.</p>
            ) : (
              filtered.map((n) => {
                const isUnread = n.type !== "new_request" && !n.is_read;
                return (
                  <div
                    key={`${n.type}-${n.application_id}`}
                    onClick={() => {
                      setSelected(n);
                      setRespondMsg("");
                      setRespondError("");
                    }}
                    style={{
                      ...styles.notifItem,
                      background:
                        selected?.application_id === n.application_id
                          ? "#eff6ff"
                          : n.type === "new_request" && n.status === "pending"
                            ? "#f0f9ff"
                            : isUnread
                              ? "#fefce8"
                              : "#fff",
                      borderLeft:
                        selected?.application_id === n.application_id
                          ? "3px solid #1a56db"
                          : isUnread
                            ? "3px solid #f59e0b"
                            : "3px solid transparent",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginBottom: "4px",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "13px",
                          fontWeight: isUnread ? "700" : "600",
                          color: "#111",
                        }}
                      >
                        {TYPE_LABEL[n.type]}
                        {isUnread && <span style={styles.newDot}>NEW</span>}
                      </span>
                      <StatusBadge status={n.status} />
                    </div>
                    <p
                      style={{
                        fontSize: "12px",
                        color: "#374151",
                        margin: "0 0 2px",
                      }}
                    >
                      {n.product_name} · {n.departure_city} → {n.arrival_city}
                    </p>
                    {n.type === "new_request" && (
                      <p
                        style={{
                          fontSize: "11px",
                          color: "#6b7280",
                          margin: 0,
                        }}
                      >
                        From: {n.applicant_name}
                      </p>
                    )}
                    <p
                      style={{
                        fontSize: "11px",
                        color: "#9ca3af",
                        marginTop: "4px",
                      }}
                    >
                      {new Date(n.created_at).toLocaleDateString()}
                    </p>
                  </div>
                );
              })
            )}
          </div>

          {/* Detail */}
          <div style={styles.detail}>
            {!selected ? (
              <p style={styles.empty}>Select a notification to see details.</p>
            ) : (
              <>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: "16px",
                  }}
                >
                  <span style={{ fontWeight: "700", fontSize: "15px" }}>
                    Request details
                  </span>
                  <StatusBadge status={selected.status} />
                </div>

                <Section title="Product">
                  <Row label="Name" value={selected.product_name} />
                  <Row label="Category" value={selected.product_category} />
                  {selected.product_url && (
                    <Row
                      label="URL"
                      value={
                        <a
                          href={selected.product_url}
                          target="_blank"
                          rel="noreferrer"
                          style={{ color: "#1a56db" }}
                        >
                          {selected.product_url}
                        </a>
                      }
                    />
                  )}
                  <Row label="Description" value={selected.product_desc} />
                </Section>

                <Section title="Trip">
                  <Row
                    label="Route"
                    value={`${selected.departure_city} → ${selected.arrival_city}`}
                  />
                  <Row label="Departure" value={selected.departure_date} />
                  <Row label="Arrival" value={selected.arrival_date} />
                  <Row label="Applicant" value={selected.applicant_name} />
                </Section>

                {/* Traveler response (applicant view) */}
                {selected.response_message && (
                  <div
                    style={{
                      marginTop: "12px",
                      padding: "12px",
                      background:
                        selected.status === "accepted" ? "#f0fdf4" : "#fef2f2",
                      borderRadius: "8px",
                    }}
                  >
                    <p
                      style={{
                        fontSize: "12px",
                        fontWeight: "600",
                        marginBottom: "4px",
                        color:
                          selected.status === "accepted"
                            ? "#16a34a"
                            : "#dc2626",
                      }}
                    >
                      Traveler's response:
                    </p>
                    <p
                      style={{
                        fontSize: "13px",
                        color: "#374151",
                        fontStyle: "italic",
                      }}
                    >
                      "{selected.response_message}"
                    </p>
                  </div>
                )}

                {/* Respond form (traveler only, pending) */}
                {selected.type === "new_request" &&
                  selected.status === "pending" && (
                    <div
                      style={{
                        marginTop: "16px",
                        background: "#f9fafb",
                        borderRadius: "8px",
                        padding: "14px",
                      }}
                    >
                      <p
                        style={{
                          fontSize: "13px",
                          fontWeight: "600",
                          marginBottom: "8px",
                          color: "#374151",
                        }}
                      >
                        Respond to this request
                      </p>
                      <textarea
                        style={styles.textarea}
                        placeholder="Write a message for the applicant..."
                        value={respondMsg}
                        onChange={(e) => setRespondMsg(e.target.value)}
                        rows={3}
                      />
                      {respondError && (
                        <p
                          style={{
                            color: "#dc2626",
                            fontSize: "12px",
                            marginBottom: "8px",
                          }}
                        >
                          {respondError}
                        </p>
                      )}
                      <div style={{ display: "flex", gap: "8px" }}>
                        <button
                          disabled={responding}
                          onClick={() => handleRespond("accepted")}
                          style={styles.acceptBtn}
                        >
                          {responding ? "..." : "✅ Accept"}
                        </button>
                        <button
                          disabled={responding}
                          onClick={() => handleRespond("rejected")}
                          style={styles.rejectBtn}
                        >
                          {responding ? "..." : "❌ Reject"}
                        </button>
                      </div>
                    </div>
                  )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: "14px" }}>
      <p
        style={{
          fontSize: "11px",
          fontWeight: "700",
          color: "#9ca3af",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          marginBottom: "6px",
        }}
      >
        {title}
      </p>
      <div
        style={{
          background: "#f9fafb",
          borderRadius: "8px",
          padding: "2px 12px",
        }}
      >
        {children}
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        padding: "7px 0",
        borderBottom: "0.5px solid #e5e7eb",
        gap: "12px",
      }}
    >
      <span style={{ fontSize: "13px", color: "#6b7280", minWidth: "100px" }}>
        {label}
      </span>
      <span style={{ fontSize: "13px", color: "#111", textAlign: "right" }}>
        {value}
      </span>
    </div>
  );
}

const styles = {
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.3)",
    zIndex: 1000,
    display: "flex",
    justifyContent: "flex-end",
  },
  panel: {
    width: "min(820px, 95vw)",
    height: "100vh",
    background: "#fff",
    boxShadow: "-4px 0 24px rgba(0,0,0,0.12)",
    display: "flex",
    flexDirection: "column",
    fontFamily: "'Segoe UI', sans-serif",
  },
  panelHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "16px 20px",
    borderBottom: "1px solid #e5e7eb",
  },
  headerBadge: {
    padding: "2px 8px",
    background: "#f59e0b",
    color: "#fff",
    borderRadius: "20px",
    fontSize: "11px",
    fontWeight: "700",
  },
  closeBtn: {
    background: "none",
    border: "none",
    fontSize: "18px",
    cursor: "pointer",
    color: "#6b7280",
  },
  tabBar: {
    display: "flex",
    gap: "8px",
    padding: "12px 20px",
    borderBottom: "1px solid #e5e7eb",
  },
  tab: {
    padding: "6px 14px",
    background: "#fff",
    border: "1.5px solid #e5e7eb",
    borderRadius: "8px",
    cursor: "pointer",
    fontWeight: "600",
    color: "#6b7280",
    fontSize: "13px",
  },
  tabActive: {
    padding: "6px 14px",
    background: "#1a56db",
    border: "1.5px solid #1a56db",
    borderRadius: "8px",
    cursor: "pointer",
    fontWeight: "600",
    color: "#fff",
    fontSize: "13px",
  },
  body: { display: "flex", flex: 1, overflow: "hidden" },
  list: {
    width: "280px",
    borderRight: "1px solid #e5e7eb",
    overflowY: "auto",
    flexShrink: 0,
  },
  notifItem: {
    padding: "14px 16px",
    borderBottom: "1px solid #f3f4f6",
    cursor: "pointer",
    transition: "background 0.15s",
  },
  newDot: {
    marginLeft: "6px",
    padding: "1px 5px",
    background: "#f59e0b",
    color: "#fff",
    borderRadius: "4px",
    fontSize: "9px",
    fontWeight: "700",
    verticalAlign: "middle",
  },
  detail: { flex: 1, overflowY: "auto", padding: "20px" },
  empty: {
    textAlign: "center",
    color: "#9ca3af",
    padding: "40px 20px",
    fontSize: "14px",
  },
  textarea: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: "8px",
    border: "1.5px solid #e5e7eb",
    fontSize: "14px",
    fontFamily: "'Segoe UI', sans-serif",
    resize: "vertical",
    marginBottom: "10px",
    outline: "none",
    boxSizing: "border-box",
  },
  acceptBtn: {
    padding: "8px 18px",
    background: "#16a34a",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    fontWeight: "600",
    fontSize: "13px",
  },
  rejectBtn: {
    padding: "8px 18px",
    background: "#dc2626",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    fontWeight: "600",
    fontSize: "13px",
  },
};
