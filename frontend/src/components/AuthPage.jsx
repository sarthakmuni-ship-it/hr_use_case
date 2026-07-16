import { useState } from "react";
import { login } from "../api";

export default function AuthPage({ onAuthenticated }) {
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function updateField(event) {
    setForm((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      await login(form.email, form.password);
      onAuthenticated();
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
        <h1>JADE Login</h1>
        <form className="authForm" onSubmit={handleSubmit}>
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
            Password
            <input
              name="password"
              onChange={updateField}
              required
              type="password"
              value={form.password}
            />
          </label>
          {error && <div className="errorBanner">{error}</div>}
          <button className="primaryAction authSubmit" disabled={submitting} type="submit">
            {submitting ? "Please wait" : "Login"}
          </button>
          <button
            type="button"
            className="secondaryAction"
            onClick={() => (window.location.hash = "#/reset-password")}
          >
            Forgot password?
          </button>
        </form>
      </section>
    </main>
  );
}
