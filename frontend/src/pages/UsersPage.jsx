import { useEffect, useState } from "react";
import {
  Edit3,
  Eye,
  EyeOff,
  ShieldCheck,
  Trash2,
  UserPlus,
  UserRound,
  Users as UsersIcon,
  ChevronLeft,
  ChevronRight,
  XCircle,
} from "lucide-react";
import { usersApi } from "../api";
import ProfileDropdown from "../components/ProfileDropdown";


const initialForm = {
  full_name: "",
  email: "",
  password: "",
  role: "user",
};

const initialEditForm = {
  role: "user",
  is_active: true,
};

export default function UsersPage({ account, onLogout }) {
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rowActionId, setRowActionId] = useState(null);
  const [page, setPage] = useState(1);
  const itemsPerPage = 5;
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState(initialEditForm);

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
      setShowForm(false);
      await loadUsers();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  function openEditUser(user) {
    setEditingUser(user);
    setEditForm({
      role: user.role,
      is_active: user.is_active,
    });
    setError("");
    setMessage("");
  }

  async function handleEditSubmit(event) {
    event.preventDefault();
    if (!editingUser) return;

    setRowActionId(editingUser.id);
    setError("");
    setMessage("");

    try {
      await usersApi.update(editingUser.id, editForm);
      setMessage(`User "${editingUser.full_name}" updated successfully.`);
      setEditingUser(null);
      await loadUsers();
    } catch (err) {
      setError(err.message);
    } finally {
      setRowActionId(null);
    }
  }

  async function handleDelete(user) {
    const confirmed = window.confirm(`Delete user "${user.full_name}"? This cannot be undone.`);
    if (!confirmed) return;

    setRowActionId(user.id);
    setError("");

    try {
      await usersApi.remove(user.id);
      await loadUsers();
    } catch (err) {
      setError(err.message);
    } finally {
      setRowActionId(null);
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [users]);

  const totalPages = Math.ceil(users.length / itemsPerPage) || 1;
  const startIndex = (page - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, users.length);
  const paginatedUsers = users.slice(startIndex, startIndex + itemsPerPage);

  return (
    <section className="contentPage">
      <div className="pageTitleRow">
        <div>
          <p className="eyebrow">Access control</p>
          <h1>Users</h1>
        </div>
        <ProfileDropdown account={account} onLogout={onLogout} />
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

      {showForm && (
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
      )}

      <section className="panel">
        <div className="panelHeader" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2>All Users</h2>
          <button
            className="primaryAction"
            onClick={() => setShowForm((curr) => !curr)}
            type="button"
            style={{ minHeight: "34px", padding: "0 12px", fontSize: "13px" }}
          >
            <UserPlus size={14} />
            {showForm ? "Cancel" : "Add User"}
          </button>
        </div>
        {error && <div className="errorBanner">{error}</div>}
        <div className="comparisonTableWrap">
          <table className="comparisonTable">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedUsers.map((user) => {
                const isSelf = user.id === account?.id;
                const rowBusy = rowActionId === user.id;

                return (
                  <tr key={user.id}>
                    <td>
                      <UserRound size={14} style={{ marginRight: 6, verticalAlign: "text-bottom" }} />
                      {user.full_name}
                    </td>
                    <td>{user.email}</td>
                    <td>
                      <span className={user.role === "admin" ? "badge badgeMatch" : "badge badgeToggle"}>
                        {user.role === "admin" ? "Admin" : "User"}
                      </span>
                    </td>
                    <td>
                      <span className={user.is_active ? "badge badgeMatch" : "badge badgeMismatch"}>
                        {user.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td>
                      <div className="tableActionGroup">
                        <button
                          aria-label="Edit user"
                          className="iconAction"
                          disabled={isSelf || rowBusy}
                          onClick={() => openEditUser(user)}
                          title={isSelf ? "You can't edit your own role or status" : "Edit user"}
                          type="button"
                        >
                          <Edit3 size={15} />
                        </button>
                        <button
                          aria-label="Delete user"
                          className="iconAction danger"
                          disabled={isSelf || rowBusy}
                          onClick={() => handleDelete(user)}
                          title={isSelf ? "You can't delete your own account" : "Delete user"}
                          type="button"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {users.length > 0 && (
          <div className="paginationRow">
            <span className="paginationInfo">
              Showing {startIndex + 1}–{endIndex} of {users.length}
            </span>
            <div className="paginationButtons">
              <button
                className="paginationBtn"
                onClick={() => setPage((current) => Math.max(current - 1, 1))}
                disabled={page === 1}
                type="button"
              >
                <ChevronLeft size={14} />
                Prev
              </button>
              <button
                className="paginationBtn"
                onClick={() => setPage((current) => Math.min(current + 1, totalPages))}
                disabled={page === totalPages}
                type="button"
              >
                Next
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
        {!loading && !users.length && <p className="emptyText">No users found.</p>}
      </section>

      {editingUser && (
        <div className="logModal" role="dialog" aria-modal="true">
          <form className="logModalPanel userEditModalPanel" onSubmit={handleEditSubmit}>
            <header className="logModalHeader">
              <div>
                <span className="badge badgeToggle">Edit User</span>
                <h2>{editingUser.full_name}</h2>
              </div>
              <button
                aria-label="Close edit user"
                className="iconAction"
                onClick={() => setEditingUser(null)}
                title="Close"
                type="button"
              >
                <XCircle size={17} />
              </button>
            </header>

            <div className="userFormGrid singleColumnForm">
              <label>
                Role
                <select
                  name="role"
                  onChange={(event) => setEditForm((current) => ({ ...current, role: event.target.value }))}
                  value={editForm.role}
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </label>
              <label>
                Status
                <select
                  name="is_active"
                  onChange={(event) =>
                    setEditForm((current) => ({ ...current, is_active: event.target.value === "true" }))
                  }
                  value={String(editForm.is_active)}
                >
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </select>
              </label>
            </div>

            <div className="actionRow">
              <button className="primaryAction" disabled={rowActionId === editingUser.id} type="submit">
                <Edit3 size={16} />
                {rowActionId === editingUser.id ? "Saving..." : "Save Changes"}
              </button>
              <button className="secondaryAction" onClick={() => setEditingUser(null)} type="button">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
