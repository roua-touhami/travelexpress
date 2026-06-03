import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  getUserProfile,
  getPostApplications,
  respondApplication,
} from "../api/auth";

export default function UserProfile() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [viewAppsPostId, setViewAppsPostId] = useState(null);
  const [postApplications, setPostApplications] = useState([]);

  // Récupérer l'ID du user connecté depuis le token
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

  const isOwnProfile = currentUserId === parseInt(userId);

  useEffect(() => {
    getUserProfile(userId)
      .then((res) => setProfile(res.data))
      .catch(() => setError("User not found"))
      .finally(() => setLoading(false));
  }, [userId]);

  const handleViewApps = async (postId) => {
    if (viewAppsPostId === postId) {
      setViewAppsPostId(null);
      return;
    }
    setViewAppsPostId(postId);
    const res = await getPostApplications(postId);
    setPostApplications(res.data);
  };

  const handleRespond = async (appId, status) => {
    await respondApplication(appId, { status });
    const res = await getPostApplications(viewAppsPostId);
    setPostApplications(res.data);
  };

  const statusBadge = (status) => {
    const colors = {
      pending: "#f59e0b",
      accepted: "#16a34a",
      rejected: "#dc2626",
    };
    const bg = { pending: "#fffbeb", accepted: "#f0fdf4", rejected: "#fef2f2" };
    return (
      <span
        style={{
          padding: "3px 10px",
          borderRadius: "20px",
          fontSize: "12px",
          fontWeight: "700",
          color: colors[status],
          background: bg[status],
          border: `1px solid ${colors[status]}`,
        }}
      >
        {status.toUpperCase()}
      </span>
    );
  };

  if (loading)
    return (
      <div style={styles.page}>
        <p style={{ textAlign: "center" }}>Loading...</p>
      </div>
    );
  if (error)
    return (
      <div style={styles.page}>
        <p style={{ textAlign: "center", color: "#dc2626" }}>{error}</p>
      </div>
    );

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.logo}>✈ TravelExpress</div>
          <Link to="/dashboard" style={styles.backBtn}>
            ← Back to Dashboard
          </Link>
        </div>

        {/* Infos user */}
        <div style={styles.profileCard}>
          <div style={styles.avatar}>
            {profile.full_name.charAt(0).toUpperCase()}
          </div>
          <div style={{ flex: 1 }}>
            <h2 style={styles.name}>{profile.full_name}</h2>
            <p style={styles.email}>📧 {profile.email}</p>
            <p style={styles.postCount}>
              ✈ {profile.posts.length} trip
              {profile.posts.length !== 1 ? "s" : ""} published
            </p>

            {/* Bouton Update Profile uniquement si c'est son propre profil */}
            {isOwnProfile && (
              <button
                onClick={() => navigate("/profile")}
                style={styles.updateBtn}
              >
                ✏️ Update Profile
              </button>
            )}
          </div>
        </div>

        {/* Ses annonces */}
        <h3 style={styles.sectionTitle}>Trip Announcements</h3>

        {profile.posts.length === 0 ? (
          <p
            style={{ color: "#6b7280", textAlign: "center", marginTop: "24px" }}
          >
            No trips published yet.
          </p>
        ) : (
          <div style={styles.grid}>
            {profile.posts.map((post) => (
              <div key={post.id}>
                <div style={styles.card}>
                  <div style={styles.route}>
                    {post.departure_city} → {post.arrival_city}
                  </div>
                  <div style={styles.dates}>
                    <span>🛫 {post.departure_date}</span>
                    <span>🛬 {post.arrival_date}</span>
                  </div>
                  <div style={styles.cardFooter}>
                    <span style={styles.createdAt}>
                      Published on{" "}
                      {new Date(post.created_at).toLocaleDateString()}
                    </span>

                    {/* Bouton Applications uniquement si c'est son propre profil */}
                    {isOwnProfile && (
                      <button
                        style={styles.viewAppsBtn}
                        onClick={() => handleViewApps(post.id)}
                      >
                        📬 Applications {viewAppsPostId === post.id ? "▲" : "▼"}
                      </button>
                    )}
                  </div>
                </div>

                {/* Panel Applications */}
                {viewAppsPostId === post.id && (
                  <div style={styles.appsPanel}>
                    <h4 style={styles.appsPanelTitle}>📬 Applications</h4>
                    {postApplications.length === 0 ? (
                      <p style={{ color: "#6b7280", fontSize: "14px" }}>
                        No applications yet.
                      </p>
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
                            {statusBadge(app.status)}
                          </div>
                          <p style={styles.appInfo}>
                            📦 <b>{app.product_name}</b> —{" "}
                            {app.product_category}
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
                          <p style={styles.appInfo}>📝 {app.product_desc}</p>

                          {app.status === "pending" && (
                            <div
                              style={{
                                marginTop: "12px",
                                display: "flex",
                                gap: "8px",
                              }}
                            >
                              <button
                                style={styles.acceptBtn}
                                onClick={() =>
                                  handleRespond(app.id, "accepted")
                                }
                              >
                                ✅ Accept
                              </button>
                              <button
                                style={styles.rejectBtn}
                                onClick={() =>
                                  handleRespond(app.id, "rejected")
                                }
                              >
                                ❌ Reject
                              </button>
                            </div>
                          )}

                          {app.response_message && (
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
              </div>
            ))}
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
  container: { maxWidth: "800px", margin: "0 auto" },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "32px",
  },
  logo: { fontSize: "22px", fontWeight: "700", color: "#1a56db" },
  backBtn: {
    color: "#1a56db",
    fontWeight: "600",
    textDecoration: "none",
    fontSize: "14px",
  },
  profileCard: {
    background: "#fff",
    borderRadius: "16px",
    padding: "28px",
    boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
    display: "flex",
    alignItems: "flex-start",
    gap: "24px",
    marginBottom: "32px",
  },
  avatar: {
    width: "72px",
    height: "72px",
    borderRadius: "50%",
    background: "#1a56db",
    color: "#fff",
    fontSize: "32px",
    fontWeight: "700",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  name: {
    fontSize: "22px",
    fontWeight: "700",
    color: "#111",
    margin: "0 0 6px",
  },
  email: { fontSize: "14px", color: "#6b7280", margin: "0 0 4px" },
  postCount: {
    fontSize: "14px",
    color: "#1a56db",
    fontWeight: "600",
    margin: "0 0 12px",
  },
  updateBtn: {
    padding: "8px 18px",
    background: "#1a56db",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    fontWeight: "600",
    cursor: "pointer",
    fontSize: "14px",
  },
  sectionTitle: {
    fontSize: "18px",
    fontWeight: "700",
    color: "#111",
    marginBottom: "16px",
  },
  grid: { display: "flex", flexDirection: "column", gap: "8px" },
  card: {
    background: "#fff",
    borderRadius: "12px",
    padding: "20px",
    boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
  },
  route: {
    fontSize: "17px",
    fontWeight: "700",
    color: "#111",
    marginBottom: "12px",
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
  },
  createdAt: { fontSize: "12px", color: "#9ca3af" },
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
  appsPanel: {
    background: "#f9fafb",
    borderRadius: "0 0 12px 12px",
    padding: "20px",
    border: "1px solid #e5e7eb",
    borderTop: "none",
    marginTop: "-4px",
  },
  appsPanelTitle: {
    fontSize: "15px",
    fontWeight: "700",
    color: "#111",
    marginBottom: "12px",
  },
  appCard: {
    background: "#fff",
    borderRadius: "10px",
    padding: "16px",
    marginBottom: "12px",
    border: "1px solid #e5e7eb",
  },
  appInfo: { fontSize: "14px", color: "#374151", margin: "4px 0" },
  input: {
    padding: "10px 14px",
    borderRadius: "8px",
    border: "1.5px solid #e5e7eb",
    fontSize: "14px",
    outline: "none",
    fontFamily: "'Segoe UI', sans-serif",
    width: "100%",
    boxSizing: "border-box",
  },
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
