import React, { useState, useEffect, useRef } from 'react';
import { Bell, Clock, AlertTriangle, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Task } from '../types';
import { differenceInHours, isPast, parseISO, formatDistanceToNow } from 'date-fns';
import { Link } from 'react-router';
import { cn } from '../lib/utils';

interface Notification {
  id: string;
  taskId: string;
  title: string;
  message: string;
  type: 'approaching' | 'overdue';
  isRead: boolean;
  timestamp: string;
}

export default function NotificationsDropdown() {
  const { user, token } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Close dropdown on outside click
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchTasks = async () => {
    if (!token || !user) return;
    try {
      const res = await fetch('/api/tasks', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) return;
      const allTasks: Task[] = await res.json();
      
      // Filter tasks assigned to current user, not done, and deadline is approaching or passed
      const userTasks = allTasks.filter(t => t.assigneeId === user.id && t.status !== 'done');
      
      const newNotifications: Notification[] = [];
      const readStateStr = localStorage.getItem(`notifications_${user.id}`);
      const readState = readStateStr ? JSON.parse(readStateStr) : {};

      userTasks.forEach(task => {
        const deadline = parseISO(task.deadline);
        const hoursLeft = differenceInHours(deadline, new Date());
        
        let type: 'approaching' | 'overdue' | null = null;
        let message = '';
        
        if (isPast(deadline)) {
          type = 'overdue';
          message = `Overdue by ${formatDistanceToNow(deadline)}`;
        } else if (hoursLeft <= 24) {
          type = 'approaching';
          message = `Due in ${hoursLeft} hours`;
        }

        if (type) {
          const notifId = `${task.id}_${type}`; // Unique ID per state
          newNotifications.push({
            id: notifId,
            taskId: task.id,
            title: task.title,
            message,
            type,
            isRead: readState[notifId] || false,
            timestamp: task.deadline
          });
        }
      });
      
      // Sort: overdue first, then approaching. If same, closest deadline first.
      newNotifications.sort((a, b) => {
        if (a.type !== b.type) return a.type === 'overdue' ? -1 : 1;
        return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
      });
      
      setNotifications(newNotifications);
      setUnreadCount(newNotifications.filter(n => !n.isRead).length);
    } catch (err) {
      console.error('Failed to fetch tasks for notifications', err);
    }
  };

  useEffect(() => {
    fetchTasks();
    const interval = setInterval(fetchTasks, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [token, user]);

  const markAsRead = (notifId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!user) return;
    
    setNotifications(prev => prev.map(n => n.id === notifId ? { ...n, isRead: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
    
    // Save to local storage
    const readStateStr = localStorage.getItem(`notifications_${user.id}`);
    const readState = readStateStr ? JSON.parse(readStateStr) : {};
    readState[notifId] = true;
    localStorage.setItem(`notifications_${user.id}`, JSON.stringify(readState));
  };

  const markAllAsRead = () => {
    if (!user) return;
    
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    setUnreadCount(0);
    
    const readStateStr = localStorage.getItem(`notifications_${user.id}`);
    const readState = readStateStr ? JSON.parse(readStateStr) : {};
    notifications.forEach(n => readState[n.id] = true);
    localStorage.setItem(`notifications_${user.id}`, JSON.stringify(readState));
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 text-slate-500 hover:text-white rounded-md transition-colors relative"
        title="Notifications"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-[#0a0c10]"></span>
        )}
      </button>

      {isOpen && (
        <div className="absolute bottom-0 left-full ml-4 w-80 bg-[#1a1d23] border border-[#2d3139] rounded-lg shadow-xl z-50 overflow-hidden flex flex-col max-h-[400px]">
          <div className="p-3 border-b border-[#2d3139] flex items-center justify-between bg-[#0a0c10]">
            <h3 className="text-white font-bold text-sm tracking-tight">Notifications</h3>
            {unreadCount > 0 && (
              <button 
                onClick={markAllAsRead}
                className="text-[10px] uppercase font-bold tracking-widest text-blue-400 hover:text-blue-300 transition-colors bg-blue-500/10 px-2 py-1 rounded"
              >
                Mark all read
              </button>
            )}
          </div>
          
          <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
            {notifications.length === 0 ? (
              <div className="text-center py-6 text-slate-500 text-xs">
                No new notifications
              </div>
            ) : (
              notifications.map((notif) => (
                <Link
                  key={notif.id}
                  to={`/board`} 
                  // In a real app we might open the task directly or navigate to it 
                  onClick={() => setIsOpen(false)}
                  className={cn(
                    "block p-3 rounded border border-transparent hover:border-[#2d3139] hover:bg-[#2d3139]/30 transition-colors cursor-pointer group relative",
                    !notif.isRead && "bg-blue-500/5 hover:bg-blue-500/10"
                  )}
                >
                  <div className="flex items-start space-x-3">
                    <div className={cn(
                      "mt-0.5 p-1.5 rounded shrink-0",
                      notif.type === 'overdue' ? "bg-red-500/10 text-red-500" : "bg-amber-500/10 text-amber-500"
                    )}>
                      {notif.type === 'overdue' ? <AlertTriangle size={14} /> : <Clock size={14} />}
                    </div>
                    <div className="flex-1 min-w-0 pr-6">
                      <div className="flex items-center space-x-2">
                        <span className={cn(
                          "text-xs font-bold truncate",
                          notif.type === 'overdue' ? "text-red-400" : "text-amber-400"
                        )}>
                          {notif.message}
                        </span>
                      </div>
                      <p className={cn(
                        "text-sm truncate mt-0.5",
                        notif.isRead ? "text-slate-400" : "text-slate-200 font-medium"
                      )}>
                        {notif.title}
                      </p>
                    </div>
                  </div>
                  
                  {!notif.isRead && (
                    <button 
                      onClick={(e) => markAsRead(notif.id, e)}
                      className="absolute top-3 right-3 text-slate-500 hover:text-white p-1 rounded-full hover:bg-[#2d3139] opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Mark as read"
                    >
                      <X size={14} />
                    </button>
                  )}
                </Link>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
