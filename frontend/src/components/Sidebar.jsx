import { FileCheck2, Inbox, LayoutDashboard, Layers, ListChecks, LogOut, Settings, Users } from "lucide-react";

export default function Sidebar({ account, activeView, onLogout, onNavigate }) {
  // The sidebar is the only navigation surface; page content changes on the right.
  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "mails", label: "Background Verification", icon: Inbox },
    { id: "verification", label: "Document Verification", icon: FileCheck2 },
    { id: "settings", label: "Settings", icon: Settings },
    { id: "logs", label: "History", icon: ListChecks },
    ...(account?.role === "admin"
      ? [{ id: "users", label: "Users", icon: Users }]
      : []),
  ];

  return (
    <aside className="sidebar">
      <div className="sidebarLogo">
        <Layers className="logoIcon" size={22} />
        <div>
          <span className="logoText">Jade Astra</span>
          <small className="logoTagline">HR Task Automation</small>
        </div>
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
        <button className="sidebarLogout" onClick={onLogout} type="button">
          <LogOut size={16} />
          Logout
        </button>
      </div>
    </aside>
  );
}
