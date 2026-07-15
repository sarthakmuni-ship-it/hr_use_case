import { Inbox, ListChecks, LogOut, Settings, Users } from "lucide-react";

export default function Sidebar({ account, activeView, onLogout, onNavigate }) {
  // The sidebar is the only navigation surface; page content changes on the right.
  const navItems = [
    { id: "mails", label: "Mails", icon: Inbox },
    { id: "settings", label: "Settings", icon: Settings },
    { id: "logs", label: "Logs", icon: ListChecks },
    ...(account?.role === "admin"
      ? [{ id: "users", label: "Users", icon: Users }]
      : []),
  ];

  const initials = account?.full_name
    ?.split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "HR";

  return (
    <aside className="sidebar">
      <div className="sidebarLogo">
        <span>JADE HR Agent</span>
        <small>Background Verification</small>
      </div>
      <nav className="navList" aria-label="Dashboard navigation">
        {navItems.map((item) => {
          const Icon = item.icon;

          return (
            <button
              className={activeView === item.id ? "navItem active" : "navItem"}
              key={item.id}
              onClick={() => onNavigate(item.id)}
              type="button"
            >
              <Icon size={18} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
      <div className="sidebarFooter">
        <div className="sidebarUser" title={account?.email || "Signed in"}>
          <span className="avatar">{initials}</span>
          <span>
            <strong>{account?.full_name || "HR User"}</strong>
            <small>{account?.role === "admin" ? "Administrator" : "Standard user"}</small>
          </span>
        </div>
        <button className="sidebarLogout" onClick={onLogout} type="button">
          <LogOut size={16} />
          Logout
        </button>
      </div>
    </aside>
  );
}
