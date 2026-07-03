import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { authApi } from "../api/auth";
import { clearSession, getUser } from "../lib/auth";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: "▚" },
  { to: "/projects", label: "Projects", icon: "▤" },
  { to: "/queues", label: "Queues", icon: "▦" },
  { to: "/jobs", label: "Jobs", icon: "◷" },
  { to: "/workers", label: "Workers", icon: "⚙" },
];

export default function Layout() {
  const navigate = useNavigate();
  const user = getUser();

  const logout = async () => {
    try {
      await authApi.logout();
    } catch {
      /* ignore network errors on logout */
    }
    clearSession();
    navigate("/login");
  };

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      <aside className="flex w-60 flex-col border-r border-slate-200 bg-white">
        <div className="flex h-16 items-center gap-2 border-b border-slate-200 px-6">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-sm font-bold text-white">
            JS
          </div>
          <span className="text-sm font-semibold leading-tight">
            Job Scheduler
          </span>
        </div>

        <nav className="flex-1 space-y-1 p-3">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  isActive
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`
              }
            >
              <span className="w-4 text-center opacity-70">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-slate-200 p-3">
          <div className="px-3 py-2">
            <p className="truncate text-sm font-medium text-slate-800">
              {user ? `${user.firstName} ${user.lastName}` : "Signed in"}
            </p>
            <p className="truncate text-xs text-slate-400">{user?.email}</p>
          </div>
          <button
            onClick={logout}
            className="mt-1 w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-x-hidden">
        <Outlet />
      </main>
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 bg-white px-8 py-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">
          {title}
        </h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
