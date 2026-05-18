import React from 'react';
import { Outlet, Link, useLocation } from 'react-router';
import { useAuth } from '../contexts/AuthContext';
import { LayoutDashboard, KanbanSquare, LogOut, Users, Calendar, FolderKanban } from 'lucide-react';
import { cn } from '../lib/utils';

import NotificationsDropdown from './NotificationsDropdown';

export default function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();

  const navItems = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Projects', href: '/projects', icon: FolderKanban },
    { name: 'Task Board', href: '/board', icon: KanbanSquare },
    { name: 'Calendar', href: '/calendar', icon: Calendar },
    { name: 'Teams', href: '/teams', icon: Users },
  ];

  return (
    <div className="flex h-screen bg-[#0f1115] text-slate-300 font-sans overflow-hidden">
      {/* Sidebar */}
      <aside className="w-16 flex flex-col items-center py-6 border-r border-[#2d3139] bg-[#0a0c10]">
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
                    : 'text-slate-500 hover:text-slate-300'
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
             <NotificationsDropdown />
             <button
               onClick={logout}
               className="p-2 text-slate-500 hover:text-red-500 rounded-md transition-colors"
               title="Logout"
             >
               <LogOut size={20} />
             </button>
             <Link 
               to="/profile"
               className="w-8 h-8 rounded-full bg-slate-700 hover:bg-slate-600 transition-colors flex items-center justify-center text-xs font-medium cursor-pointer text-white" 
               title={`${user?.name} (Profile)`}
             >
               {user?.name?.charAt(0).toUpperCase()}
             </Link>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        <Outlet />
      </main>
    </div>
  );
}
