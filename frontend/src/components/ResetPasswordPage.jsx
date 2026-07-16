import { useState } from "react";
import { apiRequest } from "../api";

export default function ResetPasswordPage() {
  const [isRequestMode, setIsRequestMode] = useState(true);
  const [form, setForm] = useState({ email: "", pin: "", new_password: "" });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function updateField(event) {
    setForm((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
  }

  async function handleRequest(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    setSubmitting(true);

    try {
      const data = await apiRequest("/auth/password-reset-request", {
        method: "POST",
        body: JSON.stringify({ email: form.email }),
      });
      setMessage(data.message);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReset(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    setSubmitting(true);

    try {
      const data = await apiRequest("/auth/password-reset", {
        method: "POST",
        body: JSON.stringify({
          email: form.email,
          pin: form.pin,
          new_password: form.new_password,
        }),
      });
      setMessage(data.message);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="authPage">
      <section className="authPanel">
        <p className="eyebrow">JADE background verification</p>
        <h1>{isRequestMode ? "Reset Password" : "Enter New Password"}</h1>

        <div className="authToggleRow">
          <button
            className={`secondaryAction ${isRequestMode ? "active" : ""}`}
            onClick={() => setIsRequestMode(true)}
            type="button"
          >
            Request Reset
          </button>
          <button
            className={`secondaryAction ${!isRequestMode ? "active" : ""}`}
            onClick={() => setIsRequestMode(false)}
            type="button"
          >
            Confirm Reset
          </button>
        </div>

        <form className="authForm" onSubmit={isRequestMode ? handleRequest : handleReset}>
          {isRequestMode ? (
            <label>
              Email
              <input
                name="email"
                onChange={updateField}
                required
                type="email"
                value={form.email}
              />
            </label>
          ) : (
            <>
              <label>
                Email
                <input
                  name="email"
                  onChange={updateField}
                  required
                  type="email"
                  value={form.email}
                />
              </label>
              <label>
                Reset PIN
                <input
                  name="pin"
                  onChange={updateField}
                  required
                  type="text"
                  value={form.pin}
                />
              </label>
              <label>
                New Password
                <input
                  name="new_password"
                  onChange={updateField}
                  required
                  type="password"
                  value={form.new_password}
                />
              </label>
            </>
          )}

          {error && <div className="errorBanner">{error}</div>}
          {message && <div className="successBanner">{message}</div>}

          <button className="primaryAction authSubmit" disabled={submitting} type="submit">
            {submitting ? "Please wait" : isRequestMode ? "Send Reset Email" : "Reset Password"}
          </button>
          {!isRequestMode && message && !error && (
            <button
              className="secondaryAction authSubmit"
              type="button"
              onClick={() => (window.location.hash = "#/ ".trim())}
            >
              Back to Login
            </button>
          )}
        </form>
      </section>
    </main>
  );
}
