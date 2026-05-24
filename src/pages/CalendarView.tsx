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
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, CheckCircle2, Plus } from 'lucide-react';
import { cn } from '../lib/utils';
import TaskModal from '../components/TaskModal';

export default function CalendarView() {
  const { token } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDateForNewTask, setSelectedDateForNewTask] = useState<Date | null>(null);

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
    const isEdit = !!selectedTask;
    const url = isEdit ? `/api/tasks/${selectedTask!.id}` : '/api/tasks';
    const method = isEdit ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(taskData)
      });
      if (res.ok) {
        setIsModalOpen(false);
        setSelectedTask(null);
        setSelectedDateForNewTask(null);
        fetchData();
      } else {
        const errData = await res.text();
        alert(`Failed to save task: ${errData}`);
      }
    } catch (err: any) {
      console.error(err);
      alert(`Error saving task: ${err.message}`);
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

  const handleCreateTask = (e: React.MouseEvent, date: Date) => {
    e.stopPropagation();
    setSelectedDateForNewTask(date);
    setSelectedTask(null);
    setIsModalOpen(true);
  };

  if (loading) return <div className="p-8">Loading calendar...</div>;

  return (
    <div className="flex-1 flex flex-col p-6 min-h-0 bg-page-bg">
      {/* Header */}
      <header className="flex justify-between items-center mb-6 shrink-0">
        <div className="flex items-center space-x-4">
          <div className="bg-blue-500/10 p-2 rounded-lg">
            <CalendarIcon className="text-blue-500" size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-strong tracking-tight">Calendar</h1>
            <p className="text-xs text-muted uppercase tracking-widest mt-1">Schedule and manage deadlines</p>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <button 
            onClick={today}
            className="px-4 py-2 bg-surface border border-border-subtle hover:bg-surface-accent text-strong text-xs font-bold rounded transition-colors uppercase tracking-widest"
          >
            Today
          </button>
          <div className="flex items-center bg-surface border border-border-subtle rounded">
            <button 
              onClick={prevMonth}
              className="p-2 hover:bg-surface-accent text-muted hover:text-strong transition-colors"
            >
              <ChevronLeft size={20} />
            </button>
            <div className="px-4 py-2 font-bold text-strong w-40 text-center uppercase tracking-widest text-sm">
              {format(currentDate, 'MMMM yyyy')}
            </div>
            <button 
              onClick={nextMonth}
              className="p-2 hover:bg-surface-accent text-muted hover:text-strong transition-colors"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>
      </header>

      {/* Calendar Grid */}
      <div className="flex-1 bg-surface border border-border-subtle rounded-lg flex flex-col overflow-hidden shadow-2xl">
        {/* Days of week */}
        <div className="grid grid-cols-7 border-b border-border-subtle shrink-0 bg-surface-dim">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
            <div key={day} className="px-4 py-3 text-center text-[10px] font-bold text-subtle uppercase tracking-widest">
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
            const dayTasks = tasks.filter(t => {
              if (t.parentId || !t.deadline) return false;
              const date = parseISO(t.deadline);
              return !isNaN(date.getTime()) && isSameDay(date, day);
            });

            return (
              <div 
                key={day.toISOString()}
                className={cn(
                  "border-border-subtle py-2 px-2 flex flex-col gap-2 transition-colors group",
                  idx > 6 && "border-t",
                  idx % 7 !== 6 && "border-r",
                  !isCurrentMonth ? "bg-surface-dim/50" : "bg-surface",
                  "hover:bg-surface-accent/30"
                )}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, day)}
              >
                <div className="flex items-center justify-between px-1">
                   <div className="flex items-center gap-1.5">
                     <div className={cn(
                       "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
                       isToday 
                         ? "bg-blue-600 text-strong" 
                         : isCurrentMonth 
                           ? "text-primary" 
                           : "text-subtle opacity-50"
                     )}>
                       {format(day, 'd')}
                     </div>
                     <button
                       onClick={(e) => handleCreateTask(e, day)}
                       className="p-1 text-muted hover:text-strong hover:bg-surface-accent/50 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                       title="Add Task"
                     >
                       <Plus size={12} />
                     </button>
                   </div>
                   {dayTasks.length > 0 && (
                     <div className="text-[10px] text-subtle font-medium">
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
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedTask(task);
                            setIsModalOpen(true);
                          }}
                          className={cn(
                            "text-xs px-2 py-1.5 rounded cursor-pointer truncate transition-all border",
                            isDone ? "bg-surface-dim text-subtle border-border-strong opacity-60" : "bg-surface hover:bg-surface-dim text-strong shadow-[0_1px_2px_rgba(0,0,0,0.05)]",
                            !isDone && task.priority === 'urgent' ? "border-red-500/40 hover:border-red-500/60" :
                            !isDone && task.priority === 'high' ? "border-amber-500/40 hover:border-amber-500/60" :
                            !isDone && task.priority === 'medium' ? "border-blue-500/40 hover:border-blue-500/60" :
                            !isDone ? "border-border-subtle hover:border-blue-500/50" : ""
                          )}
                          title={task.title}
                        >
                          <div className="flex items-center space-x-1.5 truncate">
                            {isDone ? (
                               <CheckCircle2 size={12} className="shrink-0" />
                            ) : (
                               <Clock size={12} className="shrink-0 text-muted" />
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

      {isModalOpen && (
        <TaskModal
          task={selectedTask}
          users={users}
          tasks={tasks}
          initialDeadline={selectedDateForNewTask ? (() => { 
            const d = new Date(selectedDateForNewTask); 
            d.setHours(12,0,0,0); 
            return d.toISOString(); 
          })() : undefined}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedTask(null);
            setSelectedDateForNewTask(null);
          }}
          onSave={handleSaveTask}
          onUpdateTask={handleUpdateTask}
          onDeleteTask={handleDeleteTask}
        />
      )}
    </div>
  );
}
