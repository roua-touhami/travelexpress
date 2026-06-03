import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { getProfile, updateProfile } from "../api/auth";

export default function Profile() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ full_name: "", email: "", password: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login");
      return;
    }

    getProfile()
      .then((res) => {
        setForm((f) => ({
          ...f,
          full_name: res.data.full_name,
          email: res.data.email,
        }));
      })
      .catch(() => {
        localStorage.removeItem("token");
        navigate("/login");
      })
      .finally(() => setLoading(false));
  }, [navigate]);

  const handleChange = (e) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSaving(true);

    const payload = {
      full_name: form.full_name,
      email: form.email,
    };
    if (form.password) payload.password = form.password;

    try {
      await updateProfile(payload);
      setSuccess("Profile updated successfully!");
      setForm((f) => ({ ...f, password: "" }));
    } catch (err) {
      setError(err.response?.data?.detail || "Error updating profile");
    } finally {
      setSaving(false);
    }
  };

  if (loading)
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <p style={{ color: "#6b7280", textAlign: "center" }}>Loading...</p>
        </div>
      </div>
    );

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.logo}>✈ TravelExpress</div>
        <h2 style={styles.title}>My Profile</h2>
        <p style={styles.subtitle}>Update your personal information</p>

        {error && <div style={styles.error}>{error}</div>}
        {success && <div style={styles.success}>✅ {success}</div>}

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.field}>
            <label style={styles.label}>Full Name</label>
            <input
              style={styles.input}
              name="full_name"
              value={form.full_name}
              onChange={handleChange}
              required
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Email</label>
            <input
              style={styles.input}
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              required
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>
              New Password{" "}
              <span style={{ color: "#9ca3af", fontWeight: 400 }}>
                (leave empty to keep current)
              </span>
            </label>
            <input
              style={styles.input}
              name="password"
              type="password"
              placeholder="••••••••"
              value={form.password}
              onChange={handleChange}
            />
          </div>

          <button
            style={saving ? styles.btnDisabled : styles.btn}
            disabled={saving}
          >
            {saving ? "Saving..." : "Save changes"}
          </button>
        </form>

        <p style={styles.footer}>
          <Link to="/dashboard" style={styles.link}>
            ← Back to dashboard
          </Link>
        </p>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#f0f4f8",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "'Segoe UI', sans-serif",
  },
  card: {
    background: "#fff",
    borderRadius: "16px",
    padding: "40px",
    width: "100%",
    maxWidth: "420px",
    boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
  },
  logo: {
    fontSize: "22px",
    fontWeight: "700",
    color: "#1a56db",
    marginBottom: "24px",
  },
  title: {
    fontSize: "24px",
    fontWeight: "700",
    color: "#111",
    margin: "0 0 6px",
  },
  subtitle: { fontSize: "14px", color: "#6b7280", margin: "0 0 28px" },
  error: {
    background: "#fef2f2",
    border: "1px solid #fca5a5",
    color: "#dc2626",
    borderRadius: "8px",
    padding: "12px",
    fontSize: "14px",
    marginBottom: "16px",
  },
  success: {
    background: "#f0fdf4",
    border: "1px solid #86efac",
    color: "#16a34a",
    borderRadius: "8px",
    padding: "12px",
    fontSize: "14px",
    marginBottom: "16px",
  },
  form: { display: "flex", flexDirection: "column", gap: "18px" },
  field: { display: "flex", flexDirection: "column", gap: "6px" },
  label: { fontSize: "14px", fontWeight: "600", color: "#374151" },
  input: {
    padding: "12px 14px",
    borderRadius: "8px",
    border: "1.5px solid #e5e7eb",
    fontSize: "15px",
    outline: "none",
  },
  btn: {
    padding: "13px",
    background: "#1a56db",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    fontSize: "15px",
    fontWeight: "600",
    cursor: "pointer",
    marginTop: "4px",
  },
  btnDisabled: {
    padding: "13px",
    background: "#93c5fd",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    fontSize: "15px",
    fontWeight: "600",
    cursor: "not-allowed",
    marginTop: "4px",
  },
  footer: {
    textAlign: "center",
    fontSize: "14px",
    color: "#6b7280",
    marginTop: "24px",
  },
  link: { color: "#1a56db", fontWeight: "600", textDecoration: "none" },
};
