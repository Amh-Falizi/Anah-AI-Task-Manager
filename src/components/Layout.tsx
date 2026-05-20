import React from 'react';
import { Outlet, Link, useLocation } from 'react-router';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { LayoutDashboard, KanbanSquare, LogOut, Users, Calendar, FolderKanban, Sun, Moon, Shield } from 'lucide-react';
import { cn } from '../lib/utils';

import NotificationsDropdown from './NotificationsDropdown';

import UserAvatar from './UserAvatar';

export default function Layout() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();

  const navItems = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Projects', href: '/projects', icon: FolderKanban },
    { name: 'Task Board', href: '/board', icon: KanbanSquare },
    { name: 'Calendar', href: '/calendar', icon: Calendar },
    { name: 'Teams', href: '/teams', icon: Users },
  ];

  if (user?.role === 'admin') {
    navItems.push({ name: 'Admin', href: '/admin/users', icon: Shield });
  }

  return (
    <div className="flex h-screen bg-page-bg text-primary font-sans overflow-hidden transition-colors duration-200">
      {/* Sidebar */}
      <aside className="w-16 flex flex-col items-center py-6 border-r border-border-subtle bg-surface-dim transition-colors duration-200">
        <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold mb-8">
          Σ
        </div>

        <nav className="flex flex-col space-y-6">
          {navItems.map((item) => {
            const isActive = location.pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                to={item.href}
                className={cn(
                  'p-2 rounded-md transition-colors cursor-pointer',
                  isActive
                    ? 'text-blue-500 bg-blue-500/10'
                    : 'text-subtle hover:text-primary hover:bg-surface-accent/30'
                )}
                title={item.name}
              >
                <Icon className="w-6 h-6" />
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto flex flex-col space-y-6 w-full">
          <div className="flex flex-col items-center gap-4 w-full">
             <button
               onClick={toggleTheme}
               className="p-2 text-subtle hover:text-primary rounded-md transition-colors hover:bg-surface-accent/30"
               title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
             >
               {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
             </button>
             <NotificationsDropdown />
             <button
               onClick={logout}
               className="p-2 text-subtle hover:text-red-500 rounded-md transition-colors hover:bg-surface-accent/30"
               title="Logout"
             >
               <LogOut size={20} />
             </button>
             <Link 
               to="/profile"
               className="hover:opacity-80 transition-opacity" 
               title="Profile"
             >
               <UserAvatar user={user} showTooltip={false} />
             </Link>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 bg-page-bg transition-colors duration-200">
        <Outlet />
      </main>
    </div>
  );
}
