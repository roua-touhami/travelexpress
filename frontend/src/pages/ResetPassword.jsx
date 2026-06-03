import { useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import axios from "axios";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirm) return setError("Passwords do not match");
    if (password.length < 6)
      return setError("Password must be at least 6 characters");

    setLoading(true);
    setError("");
    try {
      await axios.post("http://localhost:8000/auth/reset-password", {
        token,
        new_password: password,
      });
      navigate("/login?reset=success");
    } catch (err) {
      setError(err.response?.data?.detail || "Invalid or expired token");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.logo}>✈ TravelExpress</div>
        <h2 style={styles.title}>Reset your password</h2>
        <p style={styles.subtitle}>Enter your new password below</p>

        {error && <div style={styles.error}>{error}</div>}

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.field}>
            <label style={styles.label}>New password</label>
            <input
              style={styles.input}
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Confirm password</label>
            <input
              style={styles.input}
              type="password"
              placeholder="••••••••"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />
          </div>
          <button
            style={loading ? styles.btnDisabled : styles.btn}
            disabled={loading}
          >
            {loading ? "Resetting..." : "Reset password"}
          </button>
        </form>

        <p style={styles.footer}>
          <Link to="/login" style={styles.link}>
            ← Back to login
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
  },
  footer: {
    textAlign: "center",
    fontSize: "14px",
    color: "#6b7280",
    marginTop: "24px",
  },
  link: { color: "#1a56db", fontWeight: "600", textDecoration: "none" },
};
