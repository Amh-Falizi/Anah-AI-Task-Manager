import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Task, User } from '../types';
import { format, isPast, isToday } from 'date-fns';
import { CheckCircle2, Clock, AlertCircle, FileText, PieChart as PieChartIcon } from 'lucide-react';
import { Link } from 'react-router';
import { cn } from '../lib/utils';
import TaskModal from '../components/TaskModal';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

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

  const [columns, setColumns] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('board-columns-all');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  if (loading) return <div className="p-8 text-strong text-sm">Loading...</div>;

  const myTasks = tasks.filter(t => t.assigneeId === user?.id);
  const totalTasks = tasks.length;

  const defaultColumns = [
    { id: 'todo', title: 'To Do', color: '#94a3b8' },
    { id: 'in_progress', title: 'In Progress', color: '#3b82f6' },
    { id: 'review', title: 'Review', color: '#eab308' },
    { id: 'done', title: 'Done', color: '#10b981' }
  ];

  const activeColumns = columns || defaultColumns;

  const statusData = activeColumns.map((col, index) => {
    const value = tasks.filter(t => t.status === col.id).length;
    // give generic stable colors for custom columns
    const fallbackColors = ['#94a3b8', '#3b82f6', '#eab308', '#10b981', '#a855f7', '#ec4899', '#f97316', '#14b8a6'];
    return {
      name: col.title,
      value,
      color: col.color || fallbackColors[index % fallbackColors.length]
    };
  }).filter(d => d.value > 0);

  const completedTasks = tasks.filter(t => t.status === 'done' || t.status === (activeColumns[activeColumns.length - 1]?.id)).length;
  const inProgress = tasks.filter(t => t.status !== 'todo' && t.status !== activeColumns[0]?.id && t.status !== 'done' && t.status !== activeColumns[activeColumns.length - 1]?.id).length;
  const urgentTasks = tasks.filter(t => t.priority === 'urgent' && t.status !== 'done' && t.status !== activeColumns[activeColumns.length - 1]?.id).length;


  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-surface-dim border border-border-subtle p-2 rounded text-xs text-strong shadow-xl">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: payload[0].payload.color }} />
            <span>{payload[0].name}: {payload[0].value}</span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header */}
      <header className="h-14 border-b border-border-subtle flex items-center justify-between px-6 bg-page-bg shrink-0">
        <div className="flex items-center space-x-4">
          <h1 className="text-sm font-semibold text-strong tracking-tight uppercase">Dashboard</h1>
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-green-500/10 text-green-500 border border-green-500/20">ACTIVE</span>
        </div>
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-2 text-xs">
            <span className="text-subtle">User:</span>
            <span className="text-strong font-mono">{user?.name}</span>
          </div>
          <Link to="/board" className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-strong text-xs font-bold rounded shadow-lg transition-colors">
            GO TO BOARD
          </Link>
        </div>
      </header>

      {/* Dashboard View */}
      <div className="flex-1 p-6 flex flex-col space-y-6 overflow-y-auto">
        {/* Top Row: Stats */}
        <div className="grid grid-cols-4 gap-4 shrink-0">
          <div className="bg-surface border border-border-subtle p-4 rounded-lg">
            <div className="text-[10px] text-subtle font-bold uppercase mb-1 tracking-wider flex items-center gap-2">
              <FileText size={14} /> Total Tasks
            </div>
            <div className="flex items-end space-x-2">
              <div className="text-2xl font-mono text-strong">{totalTasks}</div>
            </div>
          </div>
          
          <div className="bg-surface border border-border-subtle p-4 rounded-lg">
            <div className="text-[10px] text-subtle font-bold uppercase mb-1 tracking-wider flex items-center gap-2">
              <CheckCircle2 size={14} /> Completed
            </div>
            <div className="text-2xl font-mono text-strong">{completedTasks}</div>
            {totalTasks > 0 && (
              <div className="w-full h-1 bg-surface-accent mt-3 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500" style={{ width: `${(completedTasks/totalTasks)*100}%` }}></div>
              </div>
            )}
          </div>

          <div className="bg-surface border border-border-subtle p-4 rounded-lg">
            <div className="text-[10px] text-subtle font-bold uppercase mb-1 tracking-wider flex items-center gap-2">
              <Clock size={14} /> In Progress
            </div>
            <div className="text-2xl font-mono text-strong">{inProgress}</div>
          </div>

          <div className="bg-surface border border-border-subtle p-4 rounded-lg">
            <div className="text-[10px] text-subtle font-bold uppercase mb-1 tracking-wider flex items-center gap-2">
              <AlertCircle size={14} /> Urgent Pending
            </div>
            <div className="text-2xl font-mono text-strong">{urgentTasks}</div>
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
          <div className="col-span-8 bg-surface border border-border-subtle rounded-lg flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b border-border-subtle flex items-center justify-between">
              <h2 className="text-xs font-bold text-strong uppercase tracking-widest">My Assigned Tasks</h2>
            </div>
            <div className="overflow-y-auto divide-y divide-border-subtle">
              {myTasks.length === 0 ? (
                <div className="p-6 text-center text-subtle text-sm">No tasks assigned to you.</div>
              ) : (
                myTasks.map(task => (
                  <div 
                    key={task.id} 
                    className="p-3 hover:bg-surface-dim cursor-pointer group flex flex-col gap-2 transition-colors"
                    onClick={() => setSelectedTask(task)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-3">
                        <div className={cn(
                          "mt-1 w-2 h-2 rounded-full shadow-[0_0_8px_currentColor]",
                          task.priority === 'urgent' ? 'bg-red-500 text-red-500' :
                          task.priority === 'high' ? 'bg-amber-500 text-amber-500' :
                          task.priority === 'medium' ? 'bg-blue-500 text-blue-500' :
                          'bg-surface-accent text-subtle'
                        )}></div>
                        <div>
                          <div className="text-xs font-bold text-strong">{task.title}</div>
                          {task.branchName && (
                            <div className="text-[10px] text-subtle mt-0.5 font-mono italic">{task.branchName}</div>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] font-mono text-muted">{format(new Date(task.deadline), 'MMM dd').toUpperCase()}</div>
                        <div className="text-[9px] bg-surface-accent text-muted px-1.5 py-0.5 rounded mt-1 uppercase">
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
            <div className="bg-surface border border-border-subtle p-4 rounded-lg flex-1 flex flex-col min-h-0">
               <div className="flex items-center space-x-2 mb-4">
                 <PieChartIcon size={14} className="text-muted" />
                 <h2 className="text-[10px] font-bold text-subtle uppercase tracking-widest">Task Distribution</h2>
               </div>
               
               <div className="flex-1 min-h-[200px] flex items-center justify-center relative">
                 {statusData.length > 0 ? (
                   <ResponsiveContainer width="100%" height="100%">
                     <PieChart>
                       <Pie
                         data={statusData}
                         cx="50%"
                         cy="50%"
                         innerRadius={60}
                         outerRadius={80}
                         paddingAngle={2}
                         dataKey="value"
                         stroke="none"
                       >
                         {statusData.map((entry, index) => (
                           <Cell key={`cell-${index}`} fill={entry.color} />
                         ))}
                       </Pie>
                       <Tooltip content={<CustomTooltip />} />
                       <Legend 
                         verticalAlign="bottom" 
                         height={36}
                         iconType="circle"
                         formatter={(value, entry: any) => (
                           <span className="text-xs text-muted">{value}</span>
                         )}
                       />
                     </PieChart>
                   </ResponsiveContainer>
                 ) : (
                   <div className="text-center text-subtle text-sm">No tasks available to visualize.</div>
                 )}
                 {statusData.length > 0 && (
                   <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none mb-8">
                     <span className="text-2xl font-bold text-strong leading-none">{totalTasks}</span>
                     <span className="text-[9px] uppercase tracking-widest text-subtle mt-1">Total</span>
                   </div>
                 )}
                 
               </div>
               
               <div className="mt-auto pt-4 border-t border-border-subtle">
                 <div className="flex items-center justify-between text-[10px]">
                   <span className="text-subtle">Role: {user?.role.replace('_', ' ').toUpperCase()}</span>
                 </div>
               </div>
             </div>
          </div>
        </div>
      </div>
      
      {/* Status Bar */}
      <footer className="h-8 border-t border-border-subtle px-4 flex items-center justify-between bg-surface-dim text-[9px] font-mono tracking-tighter shrink-0">
        <div className="flex space-x-4">
          <div className="flex items-center space-x-1 text-green-500">
            <span className="block w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
            <span>DB: CONNECTED</span>
          </div>
          <div className="text-subtle">TASKS: {totalTasks}</div>
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
