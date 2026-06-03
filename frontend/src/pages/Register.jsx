import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { register, verifyRegistration } from "../api/auth";

export default function Register() {
  const navigate = useNavigate();

  // "form" = step 1 | "verify" = step 2
  const [step, setStep] = useState("form");

  // Step 1 state
  const [form, setForm] = useState({ full_name: "", email: "", password: "" });
  const [formError, setFormError] = useState("");
  const [formLoading, setFormLoading] = useState(false);

  // Step 2 state
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState("");
  const [codeLoading, setCodeLoading] = useState(false);
  const [resendMsg, setResendMsg] = useState("");
  const [resendLoading, setResendLoading] = useState(false);

  const handleChange = (e) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  // ── Step 1: submit form → send verification code ──────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");
    setFormLoading(true);
    try {
      await register(form);
      setStep("verify");
    } catch (err) {
      setFormError(err.response?.data?.detail || "Error during registration");
    } finally {
      setFormLoading(false);
    }
  };

  // ── Step 2: submit code → create account ─────────────────────────────────
  const handleVerify = async (e) => {
    e.preventDefault();
    setCodeError("");
    setCodeLoading(true);
    try {
      await verifyRegistration({ email: form.email, code });
      navigate("/login");
    } catch (err) {
      setCodeError(
        err.response?.data?.detail || "Invalid code. Please try again.",
      );
    } finally {
      setCodeLoading(false);
    }
  };

  // ── Resend code ───────────────────────────────────────────────────────────
  const handleResend = async () => {
    setResendMsg("");
    setCodeError("");
    setResendLoading(true);
    try {
      await register(form);
      setResendMsg("✅ A new code has been sent to your email.");
      setCode("");
    } catch {
      setResendMsg("Failed to resend. Please go back and try again.");
    } finally {
      setResendLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // STEP 1 — Registration form
  // ─────────────────────────────────────────────────────────────────────────
  if (step === "form") {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={styles.logo}>✈ TravelExpress</div>

          {/* Progress */}
          <div style={styles.progress}>
            <Step num="1" label="Account info" active />
            <div style={styles.progressLine} />
            <Step num="2" label="Verify email" active={false} />
          </div>

          <h2 style={styles.title}>Create an account</h2>
          <p style={styles.subtitle}>Join us and start traveling</p>

          {formError && <div style={styles.error}>{formError}</div>}

          <form onSubmit={handleSubmit} style={styles.form}>
            <div style={styles.field}>
              <label style={styles.label}>Full Name</label>
              <input
                style={styles.input}
                name="full_name"
                placeholder="John Doe"
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
                placeholder="you@example.com"
                value={form.email}
                onChange={handleChange}
                required
              />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Password</label>
              <input
                style={styles.input}
                name="password"
                type="password"
                placeholder="Min. 8 chars, 1 uppercase, 1 digit"
                value={form.password}
                onChange={handleChange}
                required
              />
            </div>
            <button
              style={formLoading ? styles.btnDisabled : styles.btn}
              disabled={formLoading}
            >
              {formLoading ? "Sending code..." : "Continue →"}
            </button>
          </form>

          <p style={styles.footer}>
            Already have an account?{" "}
            <Link to="/login" style={styles.link}>
              Log in
            </Link>
          </p>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // STEP 2 — Enter verification code
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.logo}>✈ TravelExpress</div>

        {/* Progress */}
        <div style={styles.progress}>
          <Step num="✓" label="Account info" done />
          <div style={{ ...styles.progressLine, background: "#1a56db" }} />
          <Step num="2" label="Verify email" active />
        </div>

        <h2 style={styles.title}>Check your inbox</h2>
        <p style={styles.subtitle}>
          We sent a 6-digit code to{" "}
          <strong style={{ color: "#1a56db" }}>{form.email}</strong>
        </p>

        {codeError && <div style={styles.error}>{codeError}</div>}
        {resendMsg && (
          <div
            style={resendMsg.startsWith("✅") ? styles.success : styles.error}
          >
            {resendMsg}
          </div>
        )}

        <form onSubmit={handleVerify} style={styles.form}>
          <div style={styles.field}>
            <label style={styles.label}>Verification Code *</label>
            <input
              style={{ ...styles.input, ...styles.codeInput }}
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder="000000"
              value={code}
              onChange={(e) =>
                setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
              required
              autoFocus
            />
            <span style={styles.codeHint}>{code.length}/6 digits</span>
          </div>

          <button
            style={
              codeLoading || code.length !== 6 ? styles.btnDisabled : styles.btn
            }
            disabled={codeLoading || code.length !== 6}
          >
            {codeLoading ? "Verifying..." : "Confirm & Create Account"}
          </button>
        </form>

        {/* Resend */}
        <div style={styles.resendRow}>
          <span style={styles.resendText}>Didn't receive the code?</span>
          <button
            onClick={handleResend}
            style={styles.resendBtn}
            disabled={resendLoading}
          >
            {resendLoading ? "Sending..." : "Resend"}
          </button>
        </div>

        {/* Back */}
        <button
          onClick={() => {
            setStep("form");
            setCode("");
            setCodeError("");
          }}
          style={styles.backBtn}
        >
          ← Back to registration
        </button>
      </div>
    </div>
  );
}

// ── Small progress step component ─────────────────────────────────────────────
function Step({ num, label, active, done }) {
  const bg = done ? "#16a34a" : active ? "#1a56db" : "#e5e7eb";
  const color = done || active ? "#fff" : "#9ca3af";
  const labelColor = done ? "#16a34a" : active ? "#1a56db" : "#9ca3af";
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "4px",
      }}
    >
      <div
        style={{
          width: "28px",
          height: "28px",
          borderRadius: "50%",
          background: bg,
          color,
          fontSize: "13px",
          fontWeight: "700",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {num}
      </div>
      <span style={{ fontSize: "11px", fontWeight: "600", color: labelColor }}>
        {label}
      </span>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = {
  page: {
    minHeight: "100vh",
    background: "#f0f4f8",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "'Segoe UI', sans-serif",
    padding: "24px",
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
    marginBottom: "20px",
  },
  progress: { display: "flex", alignItems: "flex-start", marginBottom: "24px" },
  progressLine: {
    flex: 1,
    height: "2px",
    background: "#e5e7eb",
    margin: "13px 8px 0",
  },
  title: {
    fontSize: "22px",
    fontWeight: "700",
    color: "#111",
    margin: "0 0 6px",
  },
  subtitle: {
    fontSize: "14px",
    color: "#6b7280",
    margin: "0 0 24px",
    lineHeight: 1.5,
  },
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
    fontFamily: "'Segoe UI', sans-serif",
  },
  codeInput: {
    textAlign: "center",
    fontSize: "32px",
    fontWeight: "700",
    letterSpacing: "12px",
    color: "#1a56db",
    padding: "16px 14px",
    border: "2px solid #bfdbfe",
  },
  codeHint: {
    fontSize: "12px",
    color: "#9ca3af",
    textAlign: "right",
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
  resendRow: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    marginTop: "16px",
    justifyContent: "center",
  },
  resendText: { fontSize: "13px", color: "#6b7280" },
  resendBtn: {
    background: "none",
    border: "none",
    color: "#1a56db",
    fontWeight: "600",
    fontSize: "13px",
    cursor: "pointer",
    padding: 0,
  },
  backBtn: {
    display: "block",
    width: "100%",
    marginTop: "12px",
    background: "none",
    border: "none",
    color: "#9ca3af",
    fontSize: "13px",
    cursor: "pointer",
    textAlign: "center",
  },
};
