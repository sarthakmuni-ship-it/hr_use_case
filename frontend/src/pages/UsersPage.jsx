import { useEffect, useState } from "react";
import { Eye, EyeOff, ShieldCheck, UserPlus, UserRound, Users as UsersIcon } from "lucide-react";
import { usersApi } from "../api";

const initialForm = {
  full_name: "",
  email: "",
  password: "",
  role: "user",
};

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const adminCount = users.filter((user) => user.role === "admin").length;

  function updateField(event) {
    setForm((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
  }

  async function loadUsers() {
    setLoading(true);
    setError("");

    try {
      setUsers(await usersApi.list());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    setSubmitting(true);

    try {
      await usersApi.create(form);
      setMessage(`User "${form.full_name}" created successfully.`);
      setForm(initialForm);
      await loadUsers();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  return (
    <section className="contentPage">
      <div className="pageTitleRow">
        <div>
          <p className="eyebrow">Access control</p>
          <h1>Users</h1>
        </div>
      </div>

      <section className="metricGrid">
        <article className="metricCard">
          <span className="metricIcon">
            <UsersIcon size={18} />
          </span>
          <div>
            <small>Total Users</small>
            <strong>{users.length}</strong>
          </div>
        </article>
        <article className="metricCard">
          <span className="metricIcon success">
            <ShieldCheck size={18} />
          </span>
          <div>
            <small>Admins</small>
            <strong>{adminCount}</strong>
          </div>
        </article>
      </section>

      <section className="panel settingsPanel">
        <div className="panelHeader">
          <h2>Add User</h2>
        </div>
        <form className="authForm" onSubmit={handleSubmit}>
          <div className="userFormGrid">
            <label>
              Full name
              <input
                name="full_name"
                onChange={updateField}
                placeholder="e.g. Priya Sharma"
                required
                type="text"
                value={form.full_name}
              />
            </label>
            <label>
              Email
              <input
                name="email"
                onChange={updateField}
                placeholder="name@company.com"
                required
                type="email"
                value={form.email}
              />
            </label>
            <label className="fullSpan passwordField">
              Password
              <input
                name="password"
                onChange={updateField}
                placeholder="Minimum 8 characters"
                required
                type={showPassword ? "text" : "password"}
                value={form.password}
              />
              <button
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="passwordToggle"
                onClick={() => setShowPassword((current) => !current)}
                type="button"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </label>
            <div className="fullSpan">
              <span style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
                Role
              </span>
              <div className="roleCardGroup">
                <button
                  className={form.role === "user" ? "roleCard selected" : "roleCard"}
                  onClick={() => setForm((current) => ({ ...current, role: "user" }))}
                  type="button"
                >
                  <span className="roleCardHeader">
                    <UserRound size={16} />
                    User
                  </span>
                  <small>Standard access — Mails, Logs, Settings</small>
                </button>
                <button
                  className={form.role === "admin" ? "roleCard selected" : "roleCard"}
                  onClick={() => setForm((current) => ({ ...current, role: "admin" }))}
                  type="button"
                >
                  <span className="roleCardHeader">
                    <ShieldCheck size={16} />
                    Admin
                  </span>
                  <small>Full access, plus user management</small>
                </button>
              </div>
            </div>
          </div>
          {error && <div className="errorBanner">{error}</div>}
          {message && <div className="successBanner">{message}</div>}
          <button className="primaryAction authSubmit" disabled={submitting} type="submit">
            <UserPlus size={16} />
            {submitting ? "Creating..." : "Create User"}
          </button>
        </form>
      </section>

      <section className="panel">
        <div className="panelHeader">
          <h2>All Users</h2>
        </div>
        <div className="comparisonTableWrap">
          <table className="comparisonTable">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>
                    <UserRound size={14} style={{ marginRight: 6, verticalAlign: "text-bottom" }} />
                    {user.full_name}
                  </td>
                  <td>{user.email}</td>
                  <td>
                    <span className={user.role === "admin" ? "badge badgeMatch" : "badge"}>
                      {user.role === "admin" ? "Admin" : "User"}
                    </span>
                  </td>
                  <td>
                    <span className={user.is_active ? "badge badgeMatch" : "badge badgeMismatch"}>
                      {user.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!loading && !users.length && <p className="emptyText">No users found.</p>}
      </section>
    </section>
  );
}