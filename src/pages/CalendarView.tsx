import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Task, User } from '../types';
import { 
  format, 
  startOfWeek, 
  endOfWeek, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay, 
  addMonths, 
  subMonths,
  parseISO
} from 'date-fns';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, CheckCircle2 } from 'lucide-react';
import { cn } from '../lib/utils';
import TaskModal from '../components/TaskModal';

export default function CalendarView() {
  const { token } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const [tasksRes, usersRes] = await Promise.all([
        fetch('/api/tasks', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/users', { headers: { Authorization: `Bearer ${token}` } })
      ]);
      const tasksData = await tasksRes.json();
      const usersData = await usersRes.json();
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

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('Are you sure you want to delete this task?')) return;
    try {
      await fetch(`/api/tasks/${taskId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      setSelectedTask(null);
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const today = () => setCurrentDate(new Date());

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);

  const days = eachDayOfInterval({ start: startDate, end: endDate });

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData('taskId', taskId);
  };

  const handleDrop = async (e: React.DragEvent, date: Date) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('taskId');
    if (!taskId) return;

    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    // Create a new Date at noon on the dropped date to avoid timezone weirdness
    const newDate = new Date(date);
    newDate.setHours(12, 0, 0, 0);
    const newDeadline = newDate.toISOString();
    
    // Optimistic update
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, deadline: newDeadline } : t));
    
    await handleUpdateTask(taskId, task, { deadline: newDeadline });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  if (loading) return <div className="p-8">Loading calendar...</div>;

  return (
    <div className="flex-1 flex flex-col p-6 min-h-0 bg-[#0f1115]">
      {/* Header */}
      <header className="flex justify-between items-center mb-6 shrink-0">
        <div className="flex items-center space-x-4">
          <div className="bg-blue-500/10 p-2 rounded-lg">
            <CalendarIcon className="text-blue-500" size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Calendar</h1>
            <p className="text-xs text-slate-400 uppercase tracking-widest mt-1">Schedule and manage deadlines</p>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <button 
            onClick={today}
            className="px-4 py-2 bg-[#1a1d23] border border-[#2d3139] hover:bg-[#2d3139] text-white text-xs font-bold rounded transition-colors uppercase tracking-widest"
          >
            Today
          </button>
          <div className="flex items-center bg-[#1a1d23] border border-[#2d3139] rounded">
            <button 
              onClick={prevMonth}
              className="p-2 hover:bg-[#2d3139] text-slate-400 hover:text-white transition-colors"
            >
              <ChevronLeft size={20} />
            </button>
            <div className="px-4 py-2 font-bold text-white w-40 text-center uppercase tracking-widest text-sm">
              {format(currentDate, 'MMMM yyyy')}
            </div>
            <button 
              onClick={nextMonth}
              className="p-2 hover:bg-[#2d3139] text-slate-400 hover:text-white transition-colors"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>
      </header>

      {/* Calendar Grid */}
      <div className="flex-1 bg-[#1a1d23] border border-[#2d3139] rounded-lg flex flex-col overflow-hidden shadow-2xl">
        {/* Days of week */}
        <div className="grid grid-cols-7 border-b border-[#2d3139] shrink-0 bg-[#0a0c10]">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
            <div key={day} className="px-4 py-3 text-center text-[10px] font-bold text-slate-500 uppercase tracking-widest">
              {day}
            </div>
          ))}
        </div>

        {/* Days grid */}
        <div className="flex-1 grid grid-cols-7 auto-rows-fr">
          {days.map((day, idx) => {
            const isCurrentMonth = isSameMonth(day, currentDate);
            const isToday = isSameDay(day, new Date());
            
            // Get root tasks to display them by deadline
            const dayTasks = tasks.filter(t => !t.parentId && isSameDay(parseISO(t.deadline), day));

            return (
              <div 
                key={day.toISOString()}
                className={cn(
                  "border-[#2d3139] py-2 px-2 flex flex-col gap-2 transition-colors",
                  idx > 6 && "border-t",
                  idx % 7 !== 6 && "border-r",
                  !isCurrentMonth ? "bg-[#0a0c10]/50" : "bg-[#1a1d23]",
                  "hover:bg-[#2d3139]/30"
                )}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, day)}
              >
                <div className="flex items-center justify-between px-1">
                   <div className={cn(
                     "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
                     isToday 
                       ? "bg-blue-600 text-white" 
                       : isCurrentMonth 
                         ? "text-slate-300" 
                         : "text-slate-600"
                   )}>
                     {format(day, 'd')}
                   </div>
                   {dayTasks.length > 0 && (
                     <div className="text-[10px] text-slate-500 font-medium">
                       {dayTasks.length} task{dayTasks.length > 1 ? 's' : ''}
                     </div>
                   )}
                </div>

                <div className="flex-1 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                  {dayTasks.map(task => {
                     const isDone = task.status === 'done';
                     return (
                        <div
                          key={task.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, task.id)}
                          onClick={() => setSelectedTask(task)}
                          className={cn(
                            "text-xs px-2 py-1.5 rounded cursor-pointer truncate transition-colors border-l-[3px]",
                            isDone ? "bg-[#0a0c10] text-slate-500 border-l-slate-700 opacity-60" : "bg-[#2d3139] text-white hover:bg-slate-700",
                            !isDone && task.priority === 'urgent' && "border-l-red-500",
                            !isDone && task.priority === 'high' && "border-l-amber-500",
                            !isDone && task.priority === 'medium' && "border-l-blue-500",
                            !isDone && task.priority === 'low' && "border-l-slate-400"
                          )}
                          title={task.title}
                        >
                          <div className="flex items-center space-x-1.5 truncate">
                            {isDone ? (
                               <CheckCircle2 size={12} className="shrink-0" />
                            ) : (
                               <Clock size={12} className="shrink-0 text-slate-400" />
                            )}
                            <span className={cn("truncate", isDone && "line-through")}>{task.title}</span>
                          </div>
                        </div>
                     );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

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
