import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Task, User } from '../types';
import { format, isPast, isToday } from 'date-fns';
import { CheckCircle2, Clock, AlertCircle, FileText } from 'lucide-react';
import { Link } from 'react-router';
import { cn } from '../lib/utils';
import TaskModal from '../components/TaskModal';

export default function Dashboard() {
  const { user, token } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const fetchData = async () => {
    try {
      const [tasksRes, usersRes] = await Promise.all([
        fetch('/api/tasks', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/users', { headers: { Authorization: `Bearer ${token}` } })
      ]);
      const [tasksData, usersData] = await Promise.all([
        tasksRes.json(),
        usersRes.json()
      ]);
      setTasks(tasksData);
      setUsers(usersData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [token]);

  const handleSaveTask = async (taskData: Partial<Task>) => {
    if (!selectedTask) return;
    try {
      const res = await fetch(`/api/tasks/${selectedTask.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(taskData)
      });
      if (res.ok) {
        setSelectedTask(null);
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateTask = async (taskId: string, currentTask: Task, updates: Partial<Task>) => {
    try {
      await fetch(`/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ ...currentTask, ...updates })
      });
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('Are you sure you want to delete this task?')) return;
    try {
      await fetch(`/api/tasks/${taskId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <div className="p-8">Loading...</div>;

  const myTasks = tasks.filter(t => t.assigneeId === user?.id);
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.status === 'done').length;
  const inProgress = tasks.filter(t => t.status === 'in_progress').length;
  const urgentTasks = tasks.filter(t => t.priority === 'urgent' && t.status !== 'done').length;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header */}
      <header className="h-14 border-b border-[#2d3139] flex items-center justify-between px-6 bg-[#0f1115] shrink-0">
        <div className="flex items-center space-x-4">
          <h1 className="text-sm font-semibold text-white tracking-tight uppercase">Dashboard</h1>
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-green-500/10 text-green-500 border border-green-500/20">ACTIVE</span>
        </div>
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-2 text-xs">
            <span className="text-slate-500">User:</span>
            <span className="text-slate-200 font-mono">{user?.name}</span>
          </div>
          <Link to="/board" className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded shadow-lg transition-colors">
            GO TO BOARD
          </Link>
        </div>
      </header>

      {/* Dashboard View */}
      <div className="flex-1 p-6 flex flex-col space-y-6 overflow-y-auto">
        {/* Top Row: Stats */}
        <div className="grid grid-cols-4 gap-4 shrink-0">
          <div className="bg-[#1a1d23] border border-[#2d3139] p-4 rounded-lg">
            <div className="text-[10px] text-slate-500 font-bold uppercase mb-1 tracking-wider flex items-center gap-2">
              <FileText size={14} /> Total Tasks
            </div>
            <div className="flex items-end space-x-2">
              <div className="text-2xl font-mono text-white">{totalTasks}</div>
            </div>
          </div>
          
          <div className="bg-[#1a1d23] border border-[#2d3139] p-4 rounded-lg">
            <div className="text-[10px] text-slate-500 font-bold uppercase mb-1 tracking-wider flex items-center gap-2">
              <CheckCircle2 size={14} /> Completed
            </div>
            <div className="text-2xl font-mono text-white">{completedTasks}</div>
            {totalTasks > 0 && (
              <div className="w-full h-1 bg-[#2d3139] mt-3 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500" style={{ width: `${(completedTasks/totalTasks)*100}%` }}></div>
              </div>
            )}
          </div>

          <div className="bg-[#1a1d23] border border-[#2d3139] p-4 rounded-lg">
            <div className="text-[10px] text-slate-500 font-bold uppercase mb-1 tracking-wider flex items-center gap-2">
              <Clock size={14} /> In Progress
            </div>
            <div className="text-2xl font-mono text-white">{inProgress}</div>
          </div>

          <div className="bg-[#1a1d23] border border-[#2d3139] p-4 rounded-lg">
            <div className="text-[10px] text-slate-500 font-bold uppercase mb-1 tracking-wider flex items-center gap-2">
              <AlertCircle size={14} /> Urgent Pending
            </div>
            <div className="text-2xl font-mono text-white">{urgentTasks}</div>
            {urgentTasks > 0 && (
              <div className="flex mt-2 space-x-1">
                <span className="text-[10px] text-red-400 font-bold">{urgentTasks} CRITICAL</span>
              </div>
            )}
          </div>
        </div>

        {/* Main Grid */}
        <div className="flex-1 grid grid-cols-12 gap-6 min-h-0">
          {/* Task List */}
          <div className="col-span-8 bg-[#1a1d23] border border-[#2d3139] rounded-lg flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b border-[#2d3139] flex items-center justify-between">
              <h2 className="text-xs font-bold text-white uppercase tracking-widest">My Assigned Tasks</h2>
            </div>
            <div className="overflow-y-auto divide-y divide-[#2d3139]">
              {myTasks.length === 0 ? (
                <div className="p-6 text-center text-slate-500 text-sm">No tasks assigned to you.</div>
              ) : (
                myTasks.map(task => (
                  <div 
                    key={task.id} 
                    className="p-3 hover:bg-white/5 cursor-pointer group flex flex-col gap-2 transition-colors"
                    onClick={() => setSelectedTask(task)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-3">
                        <div className={cn(
                          "mt-1 w-2 h-2 rounded-full shadow-[0_0_8px_currentColor]",
                          task.priority === 'urgent' ? 'bg-red-500 text-red-500' :
                          task.priority === 'high' ? 'bg-amber-500 text-amber-500' :
                          task.priority === 'medium' ? 'bg-blue-500 text-blue-500' :
                          'bg-slate-500 text-slate-500'
                        )}></div>
                        <div>
                          <div className="text-xs font-bold text-slate-100">{task.title}</div>
                          {task.branchName && (
                            <div className="text-[10px] text-slate-500 mt-0.5 font-mono italic">{task.branchName}</div>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] font-mono text-slate-400">{format(new Date(task.deadline), 'MMM dd').toUpperCase()}</div>
                        <div className="text-[9px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded mt-1 uppercase">
                          {task.status.replace('_', ' ')}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
          
          <div className="col-span-4 flex flex-col space-y-6 overflow-hidden">
            <div className="bg-[#1a1d23] border border-[#2d3139] p-4 rounded-lg flex-1 flex flex-col min-h-0">
               <h2 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Live Activity</h2>
               <div className="space-y-4 overflow-y-auto">
                 <div className="flex space-x-3">
                   <div className="w-1 h-6 bg-green-500 rounded-full"></div>
                   <div>
                     <div className="text-[11px] text-white">System Online</div>
                     <div className="text-[9px] text-slate-500">Just now • core</div>
                   </div>
                 </div>
               </div>
               
               <div className="mt-auto pt-4 border-t border-[#2d3139]">
                 <div className="flex items-center justify-between text-[10px]">
                   <span className="text-slate-500">Role: {user?.role.replace('_', ' ').toUpperCase()}</span>
                 </div>
               </div>
             </div>
          </div>
        </div>
      </div>
      
      {/* Status Bar */}
      <footer className="h-8 border-t border-[#2d3139] px-4 flex items-center justify-between bg-[#0a0c10] text-[9px] font-mono tracking-tighter shrink-0">
        <div className="flex space-x-4">
          <div className="flex items-center space-x-1 text-green-500">
            <span className="block w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
            <span>DB: CONNECTED</span>
          </div>
          <div className="text-slate-500">TASKS: {totalTasks}</div>
        </div>
      </footer>

      {selectedTask && (
        <TaskModal
          task={selectedTask}
          users={users}
          tasks={tasks}
          onClose={() => setSelectedTask(null)}
          onSave={handleSaveTask}
          onUpdateTask={handleUpdateTask}
          onDeleteTask={handleDeleteTask}
        />
      )}
    </div>
  );
}
