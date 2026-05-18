import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Task, User, Project } from '../types';
import TaskModal from '../components/TaskModal';
import WorkloadModal from '../components/WorkloadModal';
import { Plus, MoreVertical, Calendar, ArrowUpDown, CornerDownRight, Search, Filter, AlertCircle, ChevronUp, Minus, ChevronDown, X, FolderKanban, Activity } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '../lib/utils';
import { useSearchParams, Link } from 'react-router';

const COLUMNS = [
  { id: 'todo', title: 'To Do' },
  { id: 'in_progress', title: 'In Progress' },
  { id: 'review', title: 'Review' },
  { id: 'done', title: 'Done' }
] as const;

type SortOption = 'priority' | 'deadline' | 'createdAt';
type SortDirection = 'asc' | 'desc';

const priorityWeight = {
  urgent: 4,
  high: 3,
  medium: 2,
  low: 1
};

export default function Board() {
  const { token, user } = useAuth();
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get('projectId');
  
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [project, setProject] = useState<Project | null>(null);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isWorkloadModalOpen, setIsWorkloadModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<SortOption>('priority');
  const [sortDir, setSortDir] = useState<SortDirection>('desc');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterAssignee, setFilterAssignee] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());

  const fetchData = async () => {
    try {
      const fetches = [
        fetch('/api/tasks', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/users', { headers: { Authorization: `Bearer ${token}` } })
      ];
      
      if (projectId) {
        fetches.push(fetch('/api/projects', { headers: { Authorization: `Bearer ${token}` } }));
      }
      
      const results = await Promise.all(fetches);
      const tasksData: Task[] = await results[0].json();
      const usersData = await results[1].json();
      
      if (projectId) {
        const projectsData: Project[] = await results[2].json();
        const found = projectsData.find(p => p.id === projectId);
        setProject(found || null);
        // Filter tasks by this project
        setTasks(tasksData.filter(t => t.projectId === projectId));
      } else {
        setProject(null);
        setTasks(tasksData);
      }
      
      setUsers(usersData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [token, projectId]);

  const sortedTasks = useMemo(() => {
    return [...tasks].sort((a, b) => {
      let comparison = 0;
      
      if (sortBy === 'priority') {
        comparison = priorityWeight[a.priority] - priorityWeight[b.priority];
      } else if (sortBy === 'deadline') {
        comparison = new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
      } else if (sortBy === 'createdAt') {
        comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }

      return sortDir === 'asc' ? comparison : -comparison;
    });
  }, [tasks, sortBy, sortDir]);

  const filteredTasks = useMemo(() => {
    let result = sortedTasks;

    if (filterAssignee !== 'all') {
      result = result.filter(t => t.assigneeId === filterAssignee);
    }
    
    if (filterPriority !== 'all') {
      result = result.filter(t => t.priority === filterPriority);
    }

    if (filterStatus !== 'all') {
      result = result.filter(t => t.status === filterStatus);
    }

    if (!searchQuery.trim()) return result;
    const lowerQuery = searchQuery.toLowerCase();
    
    const matchingTasks = new Set<string>();
    
    result.forEach(t => {
      if (t.title.toLowerCase().includes(lowerQuery) || (t.description && t.description.toLowerCase().includes(lowerQuery))) {
        matchingTasks.add(t.id);
        if (t.parentId) matchingTasks.add(t.parentId); // Include parent if subtask matches
      }
    });
    
    // Include all subtasks if parent matches
    result.forEach(t => {
      if (t.parentId && matchingTasks.has(t.parentId)) {
        matchingTasks.add(t.id);
      }
    });

    return result.filter(t => matchingTasks.has(t.id));
  }, [sortedTasks, searchQuery, filterAssignee, filterPriority, filterStatus]);

  const handleCreateTask = () => {
    setEditingTask(null);
    setSelectedParentId(null);
    setIsModalOpen(true);
  };

  const handleCreateSubtask = (e: React.MouseEvent, parentId: string) => {
    e.stopPropagation();
    setEditingTask(null);
    setSelectedParentId(parentId);
    setIsModalOpen(true);
  };

  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setSelectedParentId(null);
    setIsModalOpen(true);
  };

  const handleSaveTask = async (taskData: Partial<Task>) => {
    const isEdit = !!editingTask;
    const url = isEdit ? `/api/tasks/${editingTask!.id}` : '/api/tasks';
    const method = isEdit ? 'PUT' : 'POST';

    await fetch(url, {
      method,
      headers: { 
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}` 
      },
      body: JSON.stringify(taskData)
    });

    setIsModalOpen(false);
    fetchData();
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

  const toggleSelection = (taskId: string) => {
    setSelectedTaskIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(taskId)) {
        newSet.delete(taskId);
      } else {
        newSet.add(taskId);
      }
      return newSet;
    });
  };

  const handleBulkUpdate = async (updates: Partial<Task>) => {
    if (selectedTaskIds.size === 0) return;
    try {
      const selectedTasks = tasks.filter(t => selectedTaskIds.has(t.id));
      await Promise.all(selectedTasks.map(t => 
        fetch(`/api/tasks/${t.id}`, {
          method: 'PUT',
          headers: { 
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}` 
          },
          body: JSON.stringify({ ...t, ...updates })
        })
      ));
      setSelectedTaskIds(new Set());
      fetchData();
    } catch (err) {
      console.error('Bulk update failed', err);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('Are you sure you want to delete this task?')) return;
    await fetch(`/api/tasks/${taskId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
    fetchData();
  };

  if (loading) return <div className="p-8 text-slate-300">Loading board...</div>;

  return (
    <div className="flex-1 flex flex-col p-6 min-h-0 bg-[#0f1115]">
      <div className="flex justify-between items-start lg:items-center mb-6 shrink-0 flex-col lg:flex-row gap-4">
        <div>
          {project ? (
            <>
              <h1 className="text-xl font-semibold text-white tracking-tight flex items-center gap-2">
                <FolderKanban size={20} className="text-blue-500" />
                {project.name} <span className="text-sm font-normal text-slate-500">Board</span>
              </h1>
              <p className="text-xs text-slate-500 mt-1">{project.description || 'Project Task Board'}</p>
            </>
          ) : (
            <>
              <h1 className="text-sm font-semibold text-white tracking-tight uppercase">Task Board</h1>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-1">Manage all tasks</p>
            </>
          )}
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {project && (
            <button
              onClick={() => setIsWorkloadModalOpen(true)}
              className="flex items-center space-x-2 bg-[#1a1d23] border border-[#2d3139] hover:border-blue-500/50 text-slate-300 hover:text-white px-3 py-1.5 rounded transition-all text-sm font-medium"
            >
              <Activity size={14} className="text-blue-500" />
              <span>Team Workload</span>
            </button>
          )}
          <div className="flex items-center space-x-2 bg-[#1a1d23] border border-[#2d3139] rounded px-3 py-1.5 text-[10px]">
            <Search size={14} className="text-slate-500 shrink-0" />
            <input 
              type="text" 
              placeholder="SEARCH TASKS..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent text-white uppercase font-bold tracking-widest outline-none w-32 md:w-48 placeholder-slate-600"
            />
          </div>
          <div className="flex items-center space-x-2 bg-[#1a1d23] border border-[#2d3139] rounded px-3 py-1.5 text-[10px] flex-wrap">
            <Filter size={12} className="text-slate-500 shrink-0" />
            <select 
              className="bg-transparent text-white uppercase outline-none cursor-pointer font-bold tracking-wider appearance-none focus:outline-none"
              value={filterAssignee}
              onChange={(e) => setFilterAssignee(e.target.value)}
            >
              <option value="all" className="bg-[#1a1d23]">ALL USERS</option>
              {users.map(u => <option key={u.id} value={u.id} className="bg-[#1a1d23]">{u.name}</option>)}
            </select>
            <span className="text-[#2d3139] px-1">|</span>
            <select 
              className="bg-transparent text-white uppercase outline-none cursor-pointer font-bold tracking-wider appearance-none focus:outline-none"
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
            >
              <option value="all" className="bg-[#1a1d23]">ALL PRIORITIES</option>
              <option value="urgent" className="bg-[#1a1d23]">URGENT</option>
              <option value="high" className="bg-[#1a1d23]">HIGH</option>
              <option value="medium" className="bg-[#1a1d23]">MEDIUM</option>
              <option value="low" className="bg-[#1a1d23]">LOW</option>
            </select>
            <span className="text-[#2d3139] px-1">|</span>
            <select 
              className="bg-transparent text-white uppercase outline-none cursor-pointer font-bold tracking-wider appearance-none focus:outline-none"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="all" className="bg-[#1a1d23]">ALL STATUSES</option>
              <option value="todo" className="bg-[#1a1d23]">TO DO</option>
              <option value="in_progress" className="bg-[#1a1d23]">IN PROGRESS</option>
              <option value="review" className="bg-[#1a1d23]">REVIEW</option>
              <option value="done" className="bg-[#1a1d23]">DONE</option>
            </select>
          </div>
          <div className="flex items-center space-x-2 bg-[#1a1d23] border border-[#2d3139] rounded px-3 py-1.5 text-[10px]">
             <ArrowUpDown size={12} className="text-slate-500" />
             <span className="text-slate-500 font-bold uppercase tracking-widest border-r border-[#2d3139] pr-2">SORT BY</span>
             <select 
               className="bg-transparent text-white uppercase outline-none cursor-pointer font-bold tracking-wider appearance-none pl-1"
               value={`${sortBy}-${sortDir}`}
               onChange={(e) => {
                 const [by, dir] = e.target.value.split('-');
                 setSortBy(by as SortOption);
                 setSortDir(dir as SortDirection);
               }}
             >
               <option value="priority-desc" className="bg-[#1a1d23]">Highest Priority</option>
               <option value="priority-asc" className="bg-[#1a1d23]">Lowest Priority</option>
               <option value="deadline-asc" className="bg-[#1a1d23]">Nearest Deadline</option>
               <option value="deadline-desc" className="bg-[#1a1d23]">Furthest Deadline</option>
               <option value="createdAt-desc" className="bg-[#1a1d23]">Newest First</option>
               <option value="createdAt-asc" className="bg-[#1a1d23]">Oldest First</option>
             </select>
          </div>
          <button
            onClick={handleCreateTask}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded shadow-lg transition-colors flex items-center space-x-2"
          >
            <Plus size={14} />
            <span>NEW TASK</span>
          </button>
        </div>
      </div>

      <div className="flex-1 flex space-x-6 overflow-x-auto overflow-y-hidden pb-4">
        {COLUMNS.map(column => {
          const parentTasks = filteredTasks.filter(t => !t.parentId);
          const columnTasks = parentTasks.filter(t => t.status === column.id);
          return (
            <div 
              key={column.id} 
              className="w-80 flex-shrink-0 flex flex-col bg-[#1a1d23] border border-[#2d3139] rounded-lg transition-colors"
              onDragOver={(e) => {
                e.preventDefault();
                e.currentTarget.classList.add('border-blue-500/50');
              }}
              onDragLeave={(e) => {
                e.currentTarget.classList.remove('border-blue-500/50');
              }}
              onDrop={async (e) => {
                e.preventDefault();
                e.currentTarget.classList.remove('border-blue-500/50');
                const taskId = e.dataTransfer.getData('taskId');
                if (!taskId) return;
                
                const task = tasks.find(t => t.id === taskId);
                if (task && task.status !== column.id) {
                  // Optimistic update
                  setTasks(tasks.map(t => t.id === taskId ? { ...t, status: column.id } : t));
                  try {
                    await fetch(`/api/tasks/${taskId}`, {
                      method: 'PUT',
                      headers: { 
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}` 
                      },
                      body: JSON.stringify({ ...task, status: column.id })
                    });
                  } catch (err) {
                    console.error('Failed to update status', err);
                  } finally {
                    fetchData();
                  }
                }
              }}
            >
              <div className="px-4 py-3 flex justify-between items-center border-b border-[#2d3139]">
                <h3 className="text-xs font-bold text-white uppercase tracking-widest">{column.title}</h3>
                <span className="bg-[#2d3139] text-white px-2 py-0.5 rounded text-[10px] font-medium">
                  {columnTasks.length}
                </span>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {columnTasks.map(task => {
                  const assignee = users.find(u => u.id === task.assigneeId);
                  const subtasks = filteredTasks.filter(t => t.parentId === task.id);
                  const completedSubtasks = subtasks.filter(t => t.status === 'done').length;

                  return (
                    <div
                      key={task.id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('taskId', task.id);
                      }}
                      onClick={() => handleEditTask(task)}
                      className={cn(
                        "p-3 bg-[#0a0c10] border border-[#2d3139] border-l-[3px] rounded cursor-pointer hover:border-r-blue-500 hover:border-y-blue-500 hover:border-b-blue-500 hover:border-t-blue-500 transition-colors group flex flex-col",
                        task.priority === 'urgent' ? 'border-l-red-500' :
                        task.priority === 'high' ? 'border-l-amber-500' :
                        task.priority === 'medium' ? 'border-l-blue-500' :
                        'border-l-slate-600'
                      )}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center space-x-2">
                          <div 
                            className={cn(
                              "opacity-0 transition-opacity flex items-center justify-center cursor-pointer p-0.5 lg:group-hover:opacity-100",
                              (selectedTaskIds.has(task.id) || selectedTaskIds.size > 0) && "opacity-100"
                            )}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleSelection(task.id);
                            }}
                          >
                            <input 
                              type="checkbox" 
                              readOnly 
                              checked={selectedTaskIds.has(task.id)} 
                              className="w-3 h-3 cursor-pointer accent-blue-500" 
                            />
                          </div>
                          <div className={cn(
                            "flex items-center space-x-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase shrink-0",
                            task.priority === 'urgent' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                            task.priority === 'high' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                            task.priority === 'medium' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                            'bg-slate-800 text-slate-400 border border-slate-700'
                          )}>
                            {task.priority === 'urgent' && <AlertCircle size={10} />}
                            {task.priority === 'high' && <ChevronUp size={10} />}
                            {task.priority === 'medium' && <Minus size={10} />}
                            {task.priority === 'low' && <ChevronDown size={10} />}
                            <span>{task.priority}</span>
                          </div>
                        </div>
                        <div className="flex items-center space-x-1 opacity-0 lg:opacity-50 lg:group-hover:opacity-100 transition-opacity">
                          <button 
                            className="text-slate-500 hover:text-blue-400 p-1 rounded hover:bg-blue-500/10"
                            title="Add Subtask"
                            onClick={(e) => handleCreateSubtask(e, task.id)}
                          >
                            <Plus size={14} />
                          </button>
                          <button 
                            className="text-slate-500 hover:text-red-400 p-1 rounded hover:bg-red-500/10"
                            onClick={(e) => { e.stopPropagation(); handleDeleteTask(task.id); }}
                          >
                            <MoreVertical size={14} />
                          </button>
                        </div>
                      </div>

                      <h4 className="text-xs font-bold text-slate-100 mb-1 leading-snug">{task.title}</h4>
                      {task.branchName && (
                        <div className="text-[10px] text-slate-500 font-mono italic mb-2 truncate">{task.branchName}</div>
                      )}

                      {subtasks.length > 0 && (
                        <div className="mb-2 mt-1">
                          <div className="flex items-center justify-between text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                            <span>Subtasks</span>
                            <span>{completedSubtasks}/{subtasks.length}</span>
                          </div>
                          <div className="w-full h-1 bg-[#2d3139] rounded-full overflow-hidden">
                            <div 
                              className={cn(
                                "h-full transition-all duration-300",
                                completedSubtasks === subtasks.length ? "bg-green-500" : "bg-blue-500"
                              )} 
                              style={{ width: `${(completedSubtasks / subtasks.length) * 100}%` }}
                            />
                          </div>
                          <div className="flex flex-col mt-2 space-y-1 pl-1 border-l-2 border-[#2d3139]/50 ml-1">
                            {subtasks.map(st => (
                              <div 
                                key={st.id} 
                                draggable
                                onDragStart={(e) => {
                                  e.stopPropagation();
                                  e.dataTransfer.setData('taskId', st.id);
                                }}
                                className="flex justify-between items-center bg-[#1a1d23] p-1.5 rounded cursor-pointer hover:bg-white/5 border border-transparent hover:border-[#2d3139]"
                                onClick={(e) => { e.stopPropagation(); handleEditTask(st); }}
                              >
                                <div className="flex items-center space-x-1.5 overflow-hidden">
                                  <CornerDownRight size={10} className="text-[#2d3139] shrink-0" />
                                  <span className={cn(
                                    "text-[10px] truncate max-w-[150px]", 
                                    st.status === 'done' ? "line-through text-slate-600" : "text-slate-400"
                                  )}>
                                    {st.title}
                                  </span>
                                </div>
                                <span className={cn(
                                  "w-2 h-2 rounded-full",
                                  st.status === 'done' ? 'bg-green-500' :
                                  st.status === 'in_progress' ? 'bg-blue-500' :
                                  st.status === 'review' ? 'bg-amber-500' :
                                  'bg-slate-700'
                                )} />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      <div className="mt-auto pt-2 flex items-center justify-between text-[10px] text-slate-400 border-t border-[#2d3139]">
                        <div className="flex items-center space-x-1 font-mono">
                          <Calendar size={12} />
                          <span>{format(new Date(task.deadline), 'MMM dd').toUpperCase()}</span>
                        </div>
                        {assignee && (
                          <div className="flex items-center space-x-2" title={assignee.name}>
                            <div className="w-5 h-5 rounded bg-blue-600 flex items-center justify-center text-white font-bold text-[9px]">
                              {assignee.name.charAt(0).toUpperCase()}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {isModalOpen && (
        <TaskModal
          task={editingTask}
          users={users}
          tasks={tasks}
          parentId={selectedParentId}
          projectId={projectId}
          onClose={() => setIsModalOpen(false)}
          onSave={handleSaveTask}
          onUpdateTask={handleUpdateTask}
          onDeleteTask={handleDeleteTask}
        />
      )}

      {selectedTaskIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-[#1a1d23] border border-[#2d3139] shadow-2xl rounded-full px-6 py-3 flex items-center space-x-6 text-sm">
          <div className="text-white font-bold">
            {selectedTaskIds.size} task{selectedTaskIds.size > 1 ? 's' : ''} selected
          </div>
          <div className="w-px h-6 bg-[#2d3139]" />
          
          <div className="flex items-center space-x-3">
             <select 
               className="bg-[#0a0c10] border border-[#2d3139] rounded px-3 py-1.5 text-xs text-white uppercase font-medium hover:border-[#3d424e] focus:outline-none cursor-pointer transition-colors"
               onChange={(e) => handleBulkUpdate({ status: e.target.value as any })}
               value=""
             >
               <option value="" disabled hidden>Change Status...</option>
               <option value="todo">To Do</option>
               <option value="in_progress">In Progress</option>
               <option value="review">Review</option>
               <option value="done">Done</option>
             </select>

             <select 
               className="bg-[#0a0c10] border border-[#2d3139] rounded px-3 py-1.5 text-xs text-white uppercase font-medium hover:border-[#3d424e] focus:outline-none cursor-pointer transition-colors"
               onChange={(e) => handleBulkUpdate({ priority: e.target.value as any })}
               value=""
             >
               <option value="" disabled hidden>Change Priority...</option>
               <option value="urgent">Urgent</option>
               <option value="high">High</option>
               <option value="medium">Medium</option>
               <option value="low">Low</option>
             </select>

             <select 
               className="bg-[#0a0c10] border border-[#2d3139] rounded px-3 py-1.5 text-xs text-white uppercase font-medium hover:border-[#3d424e] focus:outline-none cursor-pointer transition-colors"
               onChange={(e) => handleBulkUpdate({ assigneeId: e.target.value || null })}
               value=""
             >
               <option value="" disabled hidden>Assign To...</option>
               <option value="">Unassigned</option>
               {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
             </select>
          </div>

          <div className="w-px h-6 bg-[#2d3139]" />
          
          <button 
            className="text-slate-400 hover:text-white hover:bg-white/10 p-1.5 rounded-full transition-colors"
            onClick={() => setSelectedTaskIds(new Set())}
            title="Clear Selection"
          >
            <X size={16} />
          </button>
        </div>
      )}
      {isWorkloadModalOpen && project && (
        <WorkloadModal
          projectId={project.id}
          projectName={project.name}
          onClose={() => setIsWorkloadModalOpen(false)}
        />
      )}
    </div>
  );
}
