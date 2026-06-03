import { useState, useEffect, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  getMyPosts,
  getAllPosts,
  createPost,
  deletePost,
  updatePost,
  applyToPost,
  getPostApplications,
  respondApplication,
  getNotifications,
  getNotificationCount,
  getProfile,
  getMyChats,
} from "../api/auth";

// ─── Constants ───────────────────────────────────────────────────────────────
const CATEGORIES = ["Electronics", "Clothes", "Cosmetics", "pharmacy", "Other"];

const NOTIF_TYPE_LABEL = {
  new_request: "New request",
  request_accepted: "Request accepted",
  request_rejected: "Request rejected",
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const map = {
    pending: { color: "#d97706", bg: "#fffbeb", border: "#fcd34d" },
    accepted: { color: "#16a34a", bg: "#f0fdf4", border: "#86efac" },
    rejected: { color: "#dc2626", bg: "#fef2f2", border: "#fca5a5" },
  };
  const s = map[status] || map.pending;
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
        whiteSpace: "nowrap",
      }}
    >
      {status.toUpperCase()}
    </span>
  );
}

function SectionTitle({ children }) {
  return (
    <p
      style={{
        fontSize: "11px",
        fontWeight: "700",
        color: "#9ca3af",
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        margin: "0 0 6px",
      }}
    >
      {children}
    </p>
  );
}

function FieldRow({ label, children }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        padding: "7px 0",
        borderBottom: "0.5px solid #f3f4f6",
        gap: "12px",
      }}
    >
      <span
        style={{
          fontSize: "13px",
          color: "#6b7280",
          minWidth: "90px",
          flexShrink: 0,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: "13px",
          color: "#111",
          textAlign: "right",
          wordBreak: "break-word",
        }}
      >
        {children}
      </span>
    </div>
  );
}

// ─── Notification Inbox ───────────────────────────────────────────────────────

function NotificationInbox({ onClose, onResponded }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [tab, setTab] = useState("all");
  const [respondMsg, setRespondMsg] = useState("");
  const [responding, setResponding] = useState(false);
  const [respondError, setRespondError] = useState("");

  const load = async () => {
    try {
      const res = await getNotifications();
      const data = res?.data;
      setNotifications(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to load notifications:", err);
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = notifications.filter((n) => {
    if (tab === "received") return n.type === "new_request";
    if (tab === "mine") return n.type !== "new_request";
    return true;
  });

  const handleSelect = (n) => {
    setSelected(n);
    setRespondMsg("");
    setRespondError("");
  };

  // textarea is optional — fallback to "—" if empty
  const handleRespond = async (status) => {
    setResponding(true);
    setRespondError("");
    try {
      await respondApplication(selected.application_id, {
        status,
        response_message: respondMsg.trim() || "—",
      });
      const freshRes = await getNotifications();
      const fresh = Array.isArray(freshRes?.data) ? freshRes.data : [];
      setNotifications(fresh);
      const updated = fresh.find(
        (n) => n.application_id === selected.application_id,
      );
      setSelected(updated || null);
      setRespondMsg("");
      onResponded();
    } catch (err) {
      setRespondError(err.response?.data?.detail || "Error sending response.");
    } finally {
      setResponding(false);
    }
  };

  return (
    <div style={inboxStyles.overlay} onClick={onClose}>
      <div style={inboxStyles.panel} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={inboxStyles.header}>
          <span style={{ fontWeight: "700", fontSize: "16px", color: "#111" }}>
            Notifications
          </span>
          <button onClick={onClose} style={inboxStyles.closeBtn}>
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div style={inboxStyles.tabBar}>
          {[
            { key: "all", label: "All" },
            { key: "received", label: "Received" },
            { key: "mine", label: "My requests" },
          ].map(({ key, label }) => (
            <button
              key={key}
              style={tab === key ? inboxStyles.tabActive : inboxStyles.tab}
              onClick={() => setTab(key)}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div style={inboxStyles.body}>
          {/* List */}
          <div style={inboxStyles.list}>
            {loading ? (
              <p style={inboxStyles.empty}>Loading...</p>
            ) : filtered.length === 0 ? (
              <p style={inboxStyles.empty}>No notifications.</p>
            ) : (
              filtered.map((n) => {
                const isSelected =
                  selected?.application_id === n.application_id &&
                  selected?.type === n.type;
                const isUnread =
                  n.type === "new_request" && n.status === "pending";
                return (
                  <div
                    key={`${n.type}-${n.application_id}`}
                    onClick={() => handleSelect(n)}
                    style={{
                      ...inboxStyles.notifItem,
                      background: isSelected
                        ? "#eff6ff"
                        : isUnread
                          ? "#f0f9ff"
                          : "#fff",
                      borderLeft: isSelected
                        ? "3px solid #1a56db"
                        : "3px solid transparent",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        marginBottom: "4px",
                        gap: "6px",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "13px",
                          fontWeight: "600",
                          color: "#111",
                          lineHeight: 1.3,
                        }}
                      >
                        {NOTIF_TYPE_LABEL[n.type]}
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
                          margin: "0 0 2px",
                        }}
                      >
                        From: {n.applicant_name}
                      </p>
                    )}
                    <p
                      style={{ fontSize: "11px", color: "#9ca3af", margin: 0 }}
                    >
                      {new Date(n.created_at).toLocaleDateString()}
                    </p>
                  </div>
                );
              })
            )}
          </div>

          {/* Detail panel */}
          <div style={inboxStyles.detail}>
            {!selected ? (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  height: "100%",
                  color: "#9ca3af",
                }}
              >
                <span style={{ fontSize: "32px", marginBottom: "14px" }}>
                  📬
                </span>
                <p style={{ fontSize: "14px" }}>
                  Select a notification to see details
                </p>
              </div>
            ) : (
              <>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "20px",
                  }}
                >
                  <span
                    style={{
                      fontWeight: "700",
                      fontSize: "15px",
                      color: "#111",
                    }}
                  >
                    Request details
                  </span>
                  <StatusBadge status={selected.status} />
                </div>

                <SectionTitle>Product</SectionTitle>
                <div style={inboxStyles.sectionBox}>
                  <FieldRow label="Name">{selected.product_name}</FieldRow>
                  <FieldRow label="Category">
                    {selected.product_category}
                  </FieldRow>
                  {selected.product_url && (
                    <FieldRow label="URL">
                      <a
                        href={selected.product_url}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: "#1a56db", wordBreak: "break-all" }}
                      >
                        {selected.product_url}
                      </a>
                    </FieldRow>
                  )}
                  {selected.product_desc && selected.product_desc !== "—" && (
                    <FieldRow label="Description">
                      {selected.product_desc}
                    </FieldRow>
                  )}
                </div>

                <SectionTitle>Trip</SectionTitle>
                <div
                  style={{ ...inboxStyles.sectionBox, marginBottom: "16px" }}
                >
                  <FieldRow label="Route">
                    {selected.departure_city} → {selected.arrival_city}
                  </FieldRow>
                  <FieldRow label="Departure">
                    {selected.departure_date}
                  </FieldRow>
                  <FieldRow label="Arrival">{selected.arrival_date}</FieldRow>
                  <FieldRow label="Applicant">
                    {selected.applicant_name}
                  </FieldRow>
                </div>

                {/* Response message (only if not placeholder) */}
                {selected.response_message &&
                  selected.response_message !== "—" && (
                    <div
                      style={{
                        padding: "14px",
                        borderRadius: "10px",
                        marginBottom: "16px",
                        background:
                          selected.status === "accepted"
                            ? "#f0fdf4"
                            : "#fef2f2",
                        border: `1px solid ${selected.status === "accepted" ? "#86efac" : "#fca5a5"}`,
                      }}
                    >
                      <p
                        style={{
                          fontSize: "12px",
                          fontWeight: "700",
                          marginBottom: "6px",
                          color:
                            selected.status === "accepted"
                              ? "#16a34a"
                              : "#dc2626",
                        }}
                      >
                        {selected.type === "new_request"
                          ? "Your response:"
                          : "Traveler's response:"}
                      </p>
                      <p
                        style={{
                          fontSize: "13px",
                          color: "#374151",
                          fontStyle: "italic",
                          margin: 0,
                        }}
                      >
                        "{selected.response_message}"
                      </p>
                    </div>
                  )}

                {/* Respond form — textarea optional */}
                {selected.type === "new_request" &&
                  selected.status === "pending" && (
                    <div style={inboxStyles.respondBox}>
                      <p
                        style={{
                          fontSize: "13px",
                          fontWeight: "700",
                          color: "#374151",
                          marginBottom: "10px",
                        }}
                      >
                        Respond to this request
                      </p>
                      {respondError && (
                        <div style={inboxStyles.errorBanner}>
                          {respondError}
                        </div>
                      )}
                      <textarea
                        style={inboxStyles.textarea}
                        placeholder="Write a message for the applicant (optional)..."
                        value={respondMsg}
                        onChange={(e) => setRespondMsg(e.target.value)}
                        rows={3}
                      />
                      <div style={{ display: "flex", gap: "8px" }}>
                        <button
                          disabled={responding}
                          onClick={() => handleRespond("accepted")}
                          style={{
                            ...inboxStyles.respondBtn,
                            background: "#16a34a",
                          }}
                        >
                          ✅ Accept
                        </button>
                        <button
                          disabled={responding}
                          onClick={() => handleRespond("rejected")}
                          style={{
                            ...inboxStyles.respondBtn,
                            background: "#dc2626",
                          }}
                        >
                          ❌ Reject
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

const inboxStyles = {
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.35)",
    zIndex: 1000,
    display: "flex",
    justifyContent: "flex-end",
  },
  panel: {
    width: "min(840px, 96vw)",
    height: "100vh",
    background: "#fff",
    boxShadow: "-6px 0 30px rgba(0,0,0,0.12)",
    display: "flex",
    flexDirection: "column",
    fontFamily: "'Segoe UI', sans-serif",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "16px 20px",
    borderBottom: "1px solid #e5e7eb",
    flexShrink: 0,
  },
  closeBtn: {
    background: "none",
    border: "none",
    fontSize: "18px",
    cursor: "pointer",
    color: "#6b7280",
    lineHeight: 1,
  },
  tabBar: {
    display: "flex",
    gap: "8px",
    padding: "12px 20px",
    borderBottom: "1px solid #e5e7eb",
    flexShrink: 0,
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
    width: "290px",
    borderRight: "1px solid #e5e7eb",
    overflowY: "auto",
    flexShrink: 0,
  },
  notifItem: {
    padding: "14px 16px",
    borderBottom: "1px solid #f3f4f6",
    cursor: "pointer",
    transition: "background 0.12s",
  },
  detail: { flex: 1, overflowY: "auto", padding: "20px 24px" },
  empty: {
    textAlign: "center",
    color: "#9ca3af",
    padding: "40px 16px",
    fontSize: "13px",
  },
  sectionBox: {
    background: "#f9fafb",
    borderRadius: "8px",
    padding: "2px 12px",
    marginBottom: "16px",
  },
  respondBox: {
    background: "#f9fafb",
    borderRadius: "10px",
    padding: "16px",
    border: "1px solid #e5e7eb",
  },
  textarea: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: "8px",
    border: "1.5px solid #e5e7eb",
    fontSize: "13px",
    fontFamily: "'Segoe UI', sans-serif",
    resize: "vertical",
    marginBottom: "10px",
    outline: "none",
    background: "#fff",
    color: "#111",
  },
  respondBtn: {
    padding: "8px 18px",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    fontWeight: "600",
    fontSize: "13px",
  },
  errorBanner: {
    background: "#fef2f2",
    border: "1px solid #fca5a5",
    color: "#dc2626",
    borderRadius: "8px",
    padding: "10px 12px",
    fontSize: "13px",
    marginBottom: "10px",
  },
};

// ─── Main Dashboard ────────────────────────────────────────────────────────────

export default function Dashboard() {
  const navigate = useNavigate();

  // Decode current user ID from JWT token
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

  // Data
  const [myPosts, setMyPosts] = useState([]);
  const [allPosts, setAllPosts] = useState([]);
  const [notifCount, setNotifCount] = useState(0);
  const [chatUnreadCount, setChatUnreadCount] = useState(0);
  const [currentUser, setCurrentUser] = useState(null);

  // UI state
  const [tab, setTab] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showInbox, setShowInbox] = useState(false);

  // Create / edit post
  const [showForm, setShowForm] = useState(false);
  const [editPost, setEditPost] = useState(null);
  const [form, setForm] = useState({
    departure_city: "",
    arrival_city: "",
    departure_date: "",
    arrival_date: "",
  });

  // Filters
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    departure_city: "",
    arrival_city: "",
    departure_date: "",
    arrival_date: "",
  });

  // Apply form
  const [applyPostId, setApplyPostId] = useState(null);
  const [applyForm, setApplyForm] = useState({
    product_name: "",
    product_url: "",
    product_category: "Electronics",
    product_desc: "",
  });
  const [applyError, setApplyError] = useState("");
  const [applySuccess, setApplySuccess] = useState("");

  // Applications viewer (creator)
  const [viewAppsPostId, setViewAppsPostId] = useState(null);
  const [postApplications, setPostApplications] = useState([]);
  const [respondForm, setRespondForm] = useState({});

  // ── Poll badges every 10s (notifications + chat unread) ───────────────────
  const fetchBadges = useCallback(async () => {
    try {
      const [countRes, chatsRes] = await Promise.all([
        getNotificationCount(),
        getMyChats(),
      ]);
      setNotifCount(countRes.data.count);
      const totalUnread = chatsRes.data.reduce(
        (sum, c) => sum + (c.unread_count || 0),
        0,
      );
      setChatUnreadCount(totalUnread);
    } catch {
      /* ignore polling errors */
    }
  }, []);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchAll = useCallback(
    async (params = {}) => {
      setLoading(true);
      try {
        const [myRes, allRes, countRes, profileRes] = await Promise.all([
          getMyPosts(),
          getAllPosts(params),
          getNotificationCount(),
          getProfile(),
        ]);
        setMyPosts(myRes.data);
        setAllPosts(allRes.data);
        setNotifCount(countRes.data.count);
        setCurrentUser(profileRes.data);
      } catch {
        navigate("/login");
      } finally {
        setLoading(false);
      }
    },
    [navigate],
  );

  useEffect(() => {
    if (!localStorage.getItem("token")) {
      navigate("/login");
      return;
    }
    fetchAll();
  }, [fetchAll, navigate]);

  // ── Start badge polling ────────────────────────────────────────────────────
  useEffect(() => {
    if (!localStorage.getItem("token")) return;
    fetchBadges(); // immediate first call
    const interval = setInterval(fetchBadges, 10000); // every 10s
    return () => clearInterval(interval);
  }, [fetchBadges]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleFilter = (e) => {
    e.preventDefault();
    const params = {};
    if (filters.departure_city) params.departure_city = filters.departure_city;
    if (filters.arrival_city) params.arrival_city = filters.arrival_city;
    if (filters.departure_date) params.departure_date = filters.departure_date;
    if (filters.arrival_date) params.arrival_date = filters.arrival_date;
    fetchAll(params);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await createPost(form);
      setShowForm(false);
      setForm({
        departure_city: "",
        arrival_city: "",
        departure_date: "",
        arrival_date: "",
      });
      fetchAll();
    } catch (err) {
      setError(err.response?.data?.detail || "Error creating post");
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await updatePost(editPost.id, editPost);
      setEditPost(null);
      fetchAll();
    } catch (err) {
      setError(err.response?.data?.detail || "Error updating post");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this post?")) return;
    await deletePost(id);
    fetchAll();
  };

  // product_desc is optional
  const handleApply = async (e) => {
    e.preventDefault();
    setApplyError("");
    setApplySuccess("");
    try {
      await applyToPost(applyPostId, {
        ...applyForm,
        product_desc: applyForm.product_desc.trim() || "—",
      });
      setApplySuccess("✅ Application sent successfully!");
      setApplyForm({
        product_name: "",
        product_url: "",
        product_category: "Electronics",
        product_desc: "",
      });
      setTimeout(() => {
        setApplyPostId(null);
        setApplySuccess("");
        fetchAll();
      }, 2000);
    } catch (err) {
      setApplyError(err.response?.data?.detail || "Error sending application");
    }
  };

  const handleViewApps = async (postId) => {
    setViewAppsPostId(postId);
    const res = await getPostApplications(postId);
    setPostApplications(res.data);
  };

  // respond — textarea optional
  const handleRespond = async (appId, status) => {
    const response_message =
      respondForm[appId]?.response_message?.trim() || "—";
    await respondApplication(appId, { status, response_message });
    handleViewApps(viewAppsPostId);
    fetchAll();
  };

  const posts = tab === "all" ? allPosts : myPosts;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={styles.page}>
      <div style={styles.container}>
        {/* ── Header ── */}
        <div style={styles.header}>
          <div style={styles.logo}>✈ TravelExpress</div>
          <div style={styles.headerRight}>
            {/* Inbox button with red badge */}
            <button onClick={() => setShowInbox(true)} style={styles.inboxBtn}>
              📬 Inbox
              {notifCount > 0 && (
                <span style={styles.redBadge}>{notifCount}</span>
              )}
            </button>

            {/* Chats button with red badge */}
            <Link to="/chats" style={styles.chatBtn}>
              💬 Chats
              {chatUnreadCount > 0 && (
                <span style={styles.redBadge}>{chatUnreadCount}</span>
              )}
            </Link>

            {/* Profile — full name */}
            <Link to={`/users/${currentUserId}`} style={styles.profileBtn}>
              👤 {currentUser ? currentUser.full_name : "…"}
            </Link>

            <button
              onClick={() => {
                localStorage.removeItem("token");
                navigate("/login");
              }}
              style={styles.logoutBtn}
            >
              Sign out
            </button>
          </div>
        </div>

        {/* ── Filters ── */}
        <div style={styles.filterCard}>
          <div
            style={styles.filterToggle}
            onClick={() => setShowFilters(!showFilters)}
          >
            <h4 style={styles.filterTitle}>🔍 Filter Trips</h4>
            <span style={styles.filterChevron}>{showFilters ? "▲" : "▼"}</span>
          </div>
          {showFilters && (
            <form
              onSubmit={handleFilter}
              style={{ ...styles.filterForm, marginTop: "14px" }}
            >
              <div style={styles.filterRow}>
                <input
                  style={styles.filterInput}
                  placeholder="Departure city..."
                  value={filters.departure_city}
                  onChange={(e) =>
                    setFilters({ ...filters, departure_city: e.target.value })
                  }
                />
                <input
                  style={styles.filterInput}
                  placeholder="Arrival city..."
                  value={filters.arrival_city}
                  onChange={(e) =>
                    setFilters({ ...filters, arrival_city: e.target.value })
                  }
                />
                <input
                  style={styles.filterInput}
                  type="date"
                  value={filters.departure_date}
                  onChange={(e) =>
                    setFilters({ ...filters, departure_date: e.target.value })
                  }
                />
                <input
                  style={styles.filterInput}
                  type="date"
                  value={filters.arrival_date}
                  onChange={(e) =>
                    setFilters({ ...filters, arrival_date: e.target.value })
                  }
                />
              </div>
              <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
                <button type="submit" style={styles.filterBtn}>
                  Apply Filters
                </button>
                <button
                  type="button"
                  style={styles.resetBtn}
                  onClick={() => {
                    setFilters({
                      departure_city: "",
                      arrival_city: "",
                      departure_date: "",
                      arrival_date: "",
                    });
                    fetchAll();
                  }}
                >
                  Reset
                </button>
              </div>
            </form>
          )}
        </div>

        {/* ── Tabs ── */}
        <div style={styles.tabs}>
          {[
            { key: "all", label: `🌍 All Trips (${allPosts.length})` },
            { key: "mine", label: `📋 My Trips (${myPosts.length})` },
          ].map(({ key, label }) => (
            <button
              key={key}
              style={tab === key ? styles.tabActive : styles.tab}
              onClick={() => setTab(key)}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── Create Button ── */}
        {tab === "mine" && (
          <button
            style={styles.createBtn}
            onClick={() => {
              setShowForm(!showForm);
              setEditPost(null);
            }}
          >
            {showForm ? "✕ Cancel" : "+ New Trip"}
          </button>
        )}

        {/* ── Create Form ── */}
        {showForm && tab === "mine" && (
          <div style={styles.formCard}>
            <h3 style={styles.formTitle}>🌍 New Trip Announcement</h3>
            {error && <div style={styles.errorBox}>{error}</div>}
            <form onSubmit={handleCreate} style={styles.form}>
              <div style={styles.row}>
                <div style={styles.field}>
                  <label style={styles.label}>Departure City</label>
                  <input
                    style={styles.input}
                    placeholder="Paris, France"
                    value={form.departure_city}
                    onChange={(e) =>
                      setForm({ ...form, departure_city: e.target.value })
                    }
                    required
                  />
                </div>
                <div style={styles.field}>
                  <label style={styles.label}>Arrival City</label>
                  <input
                    style={styles.input}
                    placeholder="Tunis, Tunisia"
                    value={form.arrival_city}
                    onChange={(e) =>
                      setForm({ ...form, arrival_city: e.target.value })
                    }
                    required
                  />
                </div>
              </div>
              <div style={styles.row}>
                <div style={styles.field}>
                  <label style={styles.label}>Departure Date</label>
                  <input
                    style={styles.input}
                    type="date"
                    value={form.departure_date}
                    onChange={(e) =>
                      setForm({ ...form, departure_date: e.target.value })
                    }
                    required
                  />
                </div>
                <div style={styles.field}>
                  <label style={styles.label}>Arrival Date</label>
                  <input
                    style={styles.input}
                    type="date"
                    value={form.arrival_date}
                    onChange={(e) =>
                      setForm({ ...form, arrival_date: e.target.value })
                    }
                    required
                  />
                </div>
              </div>
              <button style={styles.submitBtn}>Publish Trip</button>
            </form>
          </div>
        )}

        {/* ── Edit Form ── */}
        {editPost && (
          <div style={{ ...styles.formCard, borderLeft: "4px solid #f59e0b" }}>
            <h3 style={styles.formTitle}>✏️ Edit Trip</h3>
            {error && <div style={styles.errorBox}>{error}</div>}
            <form onSubmit={handleUpdate} style={styles.form}>
              <div style={styles.row}>
                <div style={styles.field}>
                  <label style={styles.label}>Departure City</label>
                  <input
                    style={styles.input}
                    value={editPost.departure_city}
                    onChange={(e) =>
                      setEditPost({
                        ...editPost,
                        departure_city: e.target.value,
                      })
                    }
                    required
                  />
                </div>
                <div style={styles.field}>
                  <label style={styles.label}>Arrival City</label>
                  <input
                    style={styles.input}
                    value={editPost.arrival_city}
                    onChange={(e) =>
                      setEditPost({ ...editPost, arrival_city: e.target.value })
                    }
                    required
                  />
                </div>
              </div>
              <div style={styles.row}>
                <div style={styles.field}>
                  <label style={styles.label}>Departure Date</label>
                  <input
                    style={styles.input}
                    type="date"
                    value={editPost.departure_date}
                    onChange={(e) =>
                      setEditPost({
                        ...editPost,
                        departure_date: e.target.value,
                      })
                    }
                    required
                  />
                </div>
                <div style={styles.field}>
                  <label style={styles.label}>Arrival Date</label>
                  <input
                    style={styles.input}
                    type="date"
                    value={editPost.arrival_date}
                    onChange={(e) =>
                      setEditPost({ ...editPost, arrival_date: e.target.value })
                    }
                    required
                  />
                </div>
              </div>
              <div style={{ display: "flex", gap: "10px" }}>
                <button style={styles.submitBtn}>Save Changes</button>
                <button
                  type="button"
                  onClick={() => setEditPost(null)}
                  style={styles.cancelBtn}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ── Apply Form ── */}
        {applyPostId && (
          <div style={{ ...styles.formCard, borderLeft: "4px solid #1a56db" }}>
            <h3 style={styles.formTitle}>📦 Apply to Trip</h3>
            {applyError && <div style={styles.errorBox}>{applyError}</div>}
            {applySuccess && (
              <div style={styles.successBox}>{applySuccess}</div>
            )}
            <form onSubmit={handleApply} style={styles.form}>
              <div style={styles.field}>
                <label style={styles.label}>Product Name *</label>
                <input
                  style={styles.input}
                  placeholder="iPhone 15 Pro"
                  value={applyForm.product_name}
                  onChange={(e) =>
                    setApplyForm({ ...applyForm, product_name: e.target.value })
                  }
                  required
                />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Product URL (optional)</label>
                <input
                  style={styles.input}
                  placeholder="https://amazon.com/..."
                  value={applyForm.product_url}
                  onChange={(e) =>
                    setApplyForm({ ...applyForm, product_url: e.target.value })
                  }
                />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Product Category *</label>
                <select
                  style={styles.input}
                  value={applyForm.product_category}
                  onChange={(e) =>
                    setApplyForm({
                      ...applyForm,
                      product_category: e.target.value,
                    })
                  }
                >
                  {CATEGORIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div style={styles.field}>
                {/* Description is optional */}
                <label style={styles.label}>
                  Product Description (optional)
                </label>
                <textarea
                  style={{
                    ...styles.input,
                    minHeight: "100px",
                    resize: "vertical",
                  }}
                  placeholder="Describe your product..."
                  value={applyForm.product_desc}
                  onChange={(e) =>
                    setApplyForm({ ...applyForm, product_desc: e.target.value })
                  }
                />
              </div>
              <div style={{ display: "flex", gap: "10px" }}>
                <button style={styles.submitBtn}>Send Application</button>
                <button
                  type="button"
                  onClick={() => setApplyPostId(null)}
                  style={styles.cancelBtn}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ── Applications Viewer (creator) ── */}
        {viewAppsPostId && (
          <div style={{ ...styles.formCard, borderLeft: "4px solid #16a34a" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "16px",
              }}
            >
              <h3 style={styles.formTitle}>📬 Applications for this Trip</h3>
              <button
                onClick={() => setViewAppsPostId(null)}
                style={styles.cancelBtn}
              >
                ✕ Close
              </button>
            </div>
            {postApplications.length === 0 ? (
              <p style={{ color: "#6b7280" }}>No applications yet.</p>
            ) : (
              postApplications.map((app) => (
                <div key={app.id} style={styles.appCard}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: "8px",
                    }}
                  >
                    <strong style={{ color: "#111" }}>
                      👤 {app.applicant_name}
                    </strong>
                    <StatusBadge status={app.status} />
                  </div>
                  <p style={styles.appInfo}>
                    📦 <b>{app.product_name}</b> — {app.product_category}
                  </p>
                  {app.product_url && (
                    <p style={styles.appInfo}>
                      🔗{" "}
                      <a
                        href={app.product_url}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: "#1a56db" }}
                      >
                        {app.product_url}
                      </a>
                    </p>
                  )}
                  {app.product_desc && app.product_desc !== "—" && (
                    <p style={styles.appInfo}>📝 {app.product_desc}</p>
                  )}
                  {app.status === "pending" && (
                    <div
                      style={{
                        marginTop: "12px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "8px",
                      }}
                    >
                      {/* textarea optional */}
                      <textarea
                        style={{ ...styles.input, minHeight: "70px" }}
                        placeholder="Write a response message (optional)..."
                        value={respondForm[app.id]?.response_message || ""}
                        onChange={(e) =>
                          setRespondForm({
                            ...respondForm,
                            [app.id]: {
                              ...respondForm[app.id],
                              response_message: e.target.value,
                            },
                          })
                        }
                      />
                      <div style={{ display: "flex", gap: "8px" }}>
                        <button
                          style={styles.acceptBtn}
                          onClick={() => handleRespond(app.id, "accepted")}
                        >
                          ✅ Accept
                        </button>
                        <button
                          style={styles.rejectBtn}
                          onClick={() => handleRespond(app.id, "rejected")}
                        >
                          ❌ Reject
                        </button>
                      </div>
                    </div>
                  )}
                  {app.response_message && app.response_message !== "—" && (
                    <p
                      style={{
                        marginTop: "8px",
                        fontSize: "13px",
                        color: "#6b7280",
                        fontStyle: "italic",
                      }}
                    >
                      💬 Response: {app.response_message}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* ── Posts Grid ── */}
        {(tab === "all" || tab === "mine") &&
          (loading ? (
            <p style={{ textAlign: "center", color: "#6b7280" }}>Loading...</p>
          ) : posts.length === 0 ? (
            <p
              style={{
                textAlign: "center",
                color: "#6b7280",
                marginTop: "40px",
              }}
            >
              No trips found. ✈
            </p>
          ) : (
            <div style={styles.grid}>
              {posts.map((post) => {
                const isOwnPost = post.user_id === currentUserId;
                return (
                  <div key={post.id} style={styles.card}>
                    <div style={styles.cardHeader}>
                      <span style={styles.route}>
                        {post.departure_city} → {post.arrival_city}
                      </span>
                      <Link
                        to={`/users/${post.user_id}`}
                        style={styles.authorLink}
                      >
                        👤 {post.user_full_name}
                      </Link>
                    </div>
                    <div style={styles.dates}>
                      <span>🛫 {post.departure_date}</span>
                      <span>🛬 {post.arrival_date}</span>
                    </div>
                    <div style={styles.cardFooter}>
                      <span style={styles.createdAt}>
                        {new Date(post.created_at).toLocaleDateString()}
                      </span>
                      <div
                        style={{
                          display: "flex",
                          gap: "8px",
                          alignItems: "center",
                        }}
                      >
                        {/* "All trips" tab: hide Apply on own posts */}
                        {tab === "all" && !isOwnPost && (
                          <button
                            style={styles.applyBtn}
                            onClick={() => {
                              setApplyPostId(post.id);
                              setEditPost(null);
                              setShowForm(false);
                            }}
                          >
                            📨 Apply
                          </button>
                        )}
                        {tab === "all" && isOwnPost && (
                          <span style={styles.ownPostTag}>Your trip</span>
                        )}

                        {tab === "mine" && (
                          <>
                            <button
                              style={styles.viewAppsBtn}
                              onClick={() => handleViewApps(post.id)}
                            >
                              📬 Applications
                            </button>
                            <button
                              style={styles.editBtn}
                              onClick={() => {
                                setEditPost(post);
                                setShowForm(false);
                              }}
                            >
                              ✏️ Edit
                            </button>
                            <button
                              style={styles.deleteBtn}
                              onClick={() => handleDelete(post.id)}
                            >
                              🗑 Delete
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
      </div>

      {/* ── Notification Inbox Overlay ── */}
      {showInbox && (
        <NotificationInbox
          onClose={() => setShowInbox(false)}
          onResponded={() => fetchAll()}
        />
      )}
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = {
  page: {
    minHeight: "100vh",
    background: "#f0f4f8",
    fontFamily: "'Segoe UI', sans-serif",
    padding: "24px",
  },
  container: { maxWidth: "900px", margin: "0 auto" },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "24px",
    flexWrap: "wrap",
    gap: "12px",
  },
  logo: { fontSize: "22px", fontWeight: "700", color: "#1a56db" },
  headerRight: {
    display: "flex",
    gap: "10px",
    alignItems: "center",
    flexWrap: "wrap",
  },
  inboxBtn: {
    padding: "8px 14px",
    background: "#fff",
    border: "1.5px solid #1a56db",
    color: "#1a56db",
    borderRadius: "8px",
    fontWeight: "600",
    cursor: "pointer",
    fontSize: "14px",
    display: "flex",
    alignItems: "center",
    gap: "6px",
    position: "relative",
  },
  chatBtn: {
    padding: "8px 14px",
    background: "#fff",
    border: "1.5px solid #6b7280",
    color: "#374151",
    borderRadius: "8px",
    fontWeight: "600",
    fontSize: "14px",
    display: "flex",
    alignItems: "center",
    gap: "6px",
    textDecoration: "none",
    position: "relative",
  },
  redBadge: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#ef4444",
    color: "#fff",
    borderRadius: "20px",
    fontSize: "11px",
    fontWeight: "700",
    padding: "1px 7px",
    minWidth: "18px",
    lineHeight: 1.4,
  },
  profileBtn: {
    padding: "8px 16px",
    background: "#fff",
    border: "1.5px solid #6b7280",
    color: "#374151",
    borderRadius: "8px",
    fontWeight: "600",
    textDecoration: "none",
    fontSize: "14px",
    whiteSpace: "nowrap",
  },
  logoutBtn: {
    padding: "8px 16px",
    background: "#ef4444",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    fontWeight: "600",
    cursor: "pointer",
    fontSize: "14px",
  },
  filterCard: {
    background: "#fff",
    borderRadius: "12px",
    padding: "20px",
    boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
    marginBottom: "20px",
  },
  filterTitle: {
    fontSize: "15px",
    fontWeight: "700",
    color: "#111",
    margin: 0,
  },
  filterToggle: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    cursor: "pointer",
    userSelect: "none",
  },
  filterChevron: { fontSize: "12px", color: "#6b7280" },
  filterForm: { display: "flex", flexDirection: "column" },
  filterRow: { display: "flex", gap: "12px", flexWrap: "wrap" },
  filterInput: {
    padding: "10px 14px",
    borderRadius: "8px",
    border: "1.5px solid #e5e7eb",
    fontSize: "14px",
    outline: "none",
    flex: 1,
    minWidth: "160px",
  },
  filterBtn: {
    padding: "10px 20px",
    background: "#1a56db",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    fontWeight: "600",
    cursor: "pointer",
    fontSize: "14px",
  },
  resetBtn: {
    padding: "10px 20px",
    background: "#fff",
    color: "#6b7280",
    border: "1.5px solid #e5e7eb",
    borderRadius: "8px",
    fontWeight: "600",
    cursor: "pointer",
    fontSize: "14px",
  },
  tabs: {
    display: "flex",
    gap: "12px",
    marginBottom: "16px",
    flexWrap: "wrap",
  },
  tab: {
    padding: "10px 20px",
    background: "#fff",
    border: "1.5px solid #e5e7eb",
    borderRadius: "8px",
    cursor: "pointer",
    fontWeight: "600",
    color: "#6b7280",
    fontSize: "14px",
  },
  tabActive: {
    padding: "10px 20px",
    background: "#1a56db",
    border: "1.5px solid #1a56db",
    borderRadius: "8px",
    cursor: "pointer",
    fontWeight: "600",
    color: "#fff",
    fontSize: "14px",
  },
  createBtn: {
    padding: "12px 24px",
    background: "#16a34a",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    fontWeight: "600",
    cursor: "pointer",
    fontSize: "15px",
    marginBottom: "16px",
  },
  formCard: {
    background: "#fff",
    borderRadius: "16px",
    padding: "28px",
    boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
    marginBottom: "20px",
  },
  formTitle: {
    fontSize: "18px",
    fontWeight: "700",
    color: "#111",
    margin: "0 0 20px",
  },
  form: { display: "flex", flexDirection: "column", gap: "16px" },
  row: { display: "flex", gap: "16px" },
  field: { display: "flex", flexDirection: "column", gap: "6px", flex: 1 },
  label: { fontSize: "14px", fontWeight: "600", color: "#374151" },
  input: {
    padding: "12px 14px",
    borderRadius: "8px",
    border: "1.5px solid #e5e7eb",
    fontSize: "15px",
    outline: "none",
    fontFamily: "'Segoe UI', sans-serif",
  },
  submitBtn: {
    padding: "13px",
    background: "#1a56db",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    fontSize: "15px",
    fontWeight: "600",
    cursor: "pointer",
  },
  cancelBtn: {
    padding: "10px 20px",
    background: "#fff",
    color: "#6b7280",
    border: "1.5px solid #e5e7eb",
    borderRadius: "8px",
    fontSize: "14px",
    fontWeight: "600",
    cursor: "pointer",
  },
  errorBox: {
    background: "#fef2f2",
    border: "1px solid #fca5a5",
    color: "#dc2626",
    borderRadius: "8px",
    padding: "12px",
    fontSize: "14px",
    marginBottom: "12px",
  },
  successBox: {
    background: "#f0fdf4",
    border: "1px solid #86efac",
    color: "#16a34a",
    borderRadius: "8px",
    padding: "12px",
    fontSize: "14px",
    marginBottom: "12px",
  },
  grid: { display: "flex", flexDirection: "column", gap: "16px" },
  card: {
    background: "#fff",
    borderRadius: "12px",
    padding: "20px",
    boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "12px",
  },
  route: { fontSize: "17px", fontWeight: "700", color: "#111" },
  authorLink: {
    fontSize: "13px",
    color: "#1a56db",
    fontWeight: "600",
    textDecoration: "none",
  },
  dates: {
    display: "flex",
    gap: "24px",
    color: "#374151",
    fontSize: "14px",
    marginBottom: "12px",
  },
  cardFooter: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "8px",
  },
  createdAt: { fontSize: "12px", color: "#9ca3af" },
  applyBtn: {
    padding: "6px 14px",
    background: "#eff6ff",
    color: "#1a56db",
    border: "1px solid #bfdbfe",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "13px",
    fontWeight: "600",
  },
  ownPostTag: {
    padding: "4px 10px",
    background: "#f3f4f6",
    color: "#6b7280",
    borderRadius: "6px",
    fontSize: "12px",
    fontWeight: "600",
  },
  viewAppsBtn: {
    padding: "6px 14px",
    background: "#f0fdf4",
    color: "#16a34a",
    border: "1px solid #86efac",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "13px",
    fontWeight: "600",
  },
  editBtn: {
    padding: "6px 14px",
    background: "#fffbeb",
    color: "#d97706",
    border: "1px solid #fcd34d",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "13px",
    fontWeight: "600",
  },
  deleteBtn: {
    padding: "6px 14px",
    background: "#fef2f2",
    color: "#dc2626",
    border: "1px solid #fca5a5",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "13px",
    fontWeight: "600",
  },
  appCard: {
    background: "#f9fafb",
    borderRadius: "10px",
    padding: "16px",
    marginBottom: "12px",
    border: "1px solid #e5e7eb",
  },
  appInfo: { fontSize: "14px", color: "#374151", margin: "4px 0" },
  acceptBtn: {
    padding: "8px 16px",
    background: "#16a34a",
    color: "#fff",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    fontWeight: "600",
    fontSize: "13px",
  },
  rejectBtn: {
    padding: "8px 16px",
    background: "#dc2626",
    color: "#fff",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    fontWeight: "600",
    fontSize: "13px",
  },
};
