import React from 'react';
import { NavLink } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import { LayoutDashboard, Users, UserSquare2, BarChart3, LogOut, UserCog, CalendarClock, FileText } from 'lucide-react';
import { cn } from '../lib/utils';

const navItems = [
  { name: 'Leads',     href: '/leads',     icon: Users },
  { name: 'Pipeline',  href: '/pipeline',  icon: LayoutDashboard },
  { name: 'Tasks',     href: '/tasks',     icon: CalendarClock },
  { name: 'Contacts',  href: '/contacts',  icon: UserSquare2 },
  { name: 'Contracts', href: '/contracts', icon: FileText },
  { name: 'Reports',   href: '/reports',   icon: BarChart3 },
];

export default function Layout({ children }) {
  const { user, logout } = useAuthStore();

  const activeNavItems = [...navItems];
  if (user?.role === 'admin') {
    activeNavItems.push({ name: 'Sales Team', href: '/reps', icon: UserCog });
  }

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-900">
      {/* Sidebar */}
      <aside className="w-64 bg-white dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 flex flex-col">
        <div className="h-16 flex items-center px-6 border-b border-slate-200 dark:border-slate-800">
          <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            Teamgrid CRM
          </span>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-2">
          {activeNavItems.map((item) => (
            <NavLink
              key={item.name}
              to={item.href}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200'
                )
              }
            >
              <item.icon className="w-5 h-5" />
              {item.name}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3 mb-4 px-2">
            <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-700 dark:text-blue-300 font-bold">
              {user?.name?.charAt(0) || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                {user?.name}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {user?.role}
              </p>
            </div>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm font-medium text-slate-600 hover:text-red-600 hover:bg-red-50 dark:text-slate-400 dark:hover:text-red-400 dark:hover:bg-red-900/50 rounded-md transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="h-full p-8">{children}</div>
      </main>
    </div>
  );
}
