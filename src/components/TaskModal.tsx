import React, { useState, useEffect } from 'react';
import { Task, User } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { X, GitBranch, Loader2, Edit2, Calendar, Clock, CheckCircle2, Trash } from 'lucide-react';
import Markdown from 'react-markdown';
import { format } from 'date-fns';
import { cn } from '../lib/utils';

interface TaskModalProps {
  task: Task | null;
  users: User[];
  tasks?: Task[]; // passed for parsing subtasks
  onClose: () => void;
  onSave: (task: Partial<Task>) => void;
  onUpdateTask?: (taskId: string, currentTask: Task, updates: Partial<Task>) => void;
  onDeleteTask?: (taskId: string) => void;
  parentId?: string | null;
  projectId?: string | null;
}

export default function TaskModal({ task, users, tasks = [], onClose, onSave, onUpdateTask, onDeleteTask, parentId, projectId }: TaskModalProps) {
  const { token, user } = useAuth();
  const isEdit = !!task;
  const [isViewMode, setIsViewMode] = useState(isEdit);
  
  const [formData, setFormData] = useState<Partial<Task>>({
    title: task?.title || '',
    description: task?.description || '',
    status: task?.status || 'todo',
    priority: task?.priority || 'medium',
    deadline: task?.deadline ? task.deadline.split('T')[0] : new Date().toISOString().split('T')[0],
    assigneeId: task?.assigneeId || '',
    branchName: task?.branchName || '',
    parentId: task?.parentId || parentId || null,
    projectId: task?.projectId || projectId || null
  });
  const [generatingBranch, setGeneratingBranch] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...formData,
      assigneeId: formData.assigneeId === '' ? null : formData.assigneeId
    });
  };

  const handleGenerateBranch = async () => {
    if (!formData.title) return;
    setGeneratingBranch(true);
    try {
      const res = await fetch('/api/tasks/branch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ title: formData.title, type: 'feat' })
      });
      const data = await res.json();
      if (data.branchName) {
        setFormData(prev => ({ ...prev, branchName: data.branchName }));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setGeneratingBranch(false);
    }
  };

  if (isViewMode && task) {
    const subtasks = tasks.filter(t => t.parentId === task.id);
    const assignee = users.find(u => u.id === task.assigneeId);
    
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
        <div className="bg-[#1a1d23] border border-[#2d3139] rounded-lg shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col font-sans overflow-hidden">
          <div className="px-6 py-4 border-b border-[#2d3139] flex justify-between items-start bg-[#0f1115]">
            <div className="flex-1 pr-4">
              <h2 className="text-xl font-bold text-white mb-2">{task.title}</h2>
              <div className="flex flex-wrap items-center gap-3 text-xs">
                <span className={cn(
                  "px-2 py-0.5 rounded font-bold uppercase tracking-wider",
                  task.priority === 'urgent' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                  task.priority === 'high' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                  task.priority === 'medium' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                  'bg-slate-800 text-slate-400 border border-slate-700'
                )}>
                  {task.priority} Priority
                </span>
                <span className="px-2 py-0.5 rounded font-bold uppercase tracking-wider bg-[#2d3139] text-white">
                  {task.status.replace('_', ' ')}
                </span>
                {task.branchName && (
                  <span className="flex items-center space-x-1 text-slate-400 bg-[#0a0c10] px-2 py-0.5 rounded border border-[#2d3139] font-mono">
                    <GitBranch size={12} />
                    <span>{task.branchName}</span>
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center space-x-2 shrink-0">
              {onDeleteTask && (user?.role === 'admin' || user?.role === 'manager' || user?.id === task.creatorId) && (
                <button
                  onClick={() => {
                    onDeleteTask(task.id);
                    onClose();
                  }}
                  className="flex items-center space-x-1.5 px-3 py-1.5 bg-red-600/10 text-red-400 hover:bg-red-600/20 rounded border border-red-500/20 transition-colors uppercase text-[10px] font-bold tracking-widest"
                  title="Delete Task"
                >
                  <Trash size={12} />
                  <span>Delete</span>
                </button>
              )}
              {(user?.role === 'admin' || user?.role === 'manager' || user?.id === task.creatorId || user?.id === task.assigneeId) && (
                <button 
                  onClick={() => setIsViewMode(false)} 
                  className="flex items-center space-x-1.5 px-3 py-1.5 bg-blue-600/10 text-blue-400 hover:bg-blue-600/20 rounded border border-blue-500/20 transition-colors uppercase text-[10px] font-bold tracking-widest"
                >
                  <Edit2 size={12} />
                  <span>Edit</span>
                </button>
              )}
              <button onClick={onClose} className="text-slate-500 hover:text-red-400 p-1 rounded hover:bg-red-500/10 transition-colors">
                <X size={20} />
              </button>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-[#0a0c10]">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="col-span-2 space-y-6">
                <div>
                  <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 border-b border-[#2d3139] pb-1">Description</h3>
                  <div className="prose prose-invert prose-sm max-w-none text-slate-300">
                    {task.description ? (
                      <Markdown>{task.description}</Markdown>
                    ) : (
                      <span className="italic text-slate-600">No description provided.</span>
                    )}
                  </div>
                </div>

                {subtasks.length > 0 && (
                  <div>
                    <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 border-b border-[#2d3139] pb-1">Subtasks ({subtasks.length})</h3>
                    <div className="space-y-2">
                      {subtasks.map(st => (
                        <div key={st.id} className="flex items-center justify-between bg-[#1a1d23] p-3 rounded border border-[#2d3139]">
                          <div className="flex items-center space-x-3">
                            <button 
                              onClick={() => {
                                if (onUpdateTask) {
                                  onUpdateTask(st.id, st, { status: st.status === 'done' ? 'todo' : 'done' });
                                }
                              }}
                              className="focus:outline-none shrink-0 cursor-pointer"
                              title={st.status === 'done' ? 'Mark as to do' : 'Mark as done'}
                            >
                              <CheckCircle2 size={16} className={cn("transition-colors hover:text-green-400", st.status === 'done' ? 'text-green-500' : 'text-slate-600')} />
                            </button>
                            <span className={cn("text-sm text-white", st.status === 'done' && 'line-through text-slate-500')}>{st.title}</span>
                          </div>
                          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 bg-[#0a0c10] px-2 py-1 rounded">
                            {st.status.replace('_', ' ')}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              
              <div className="space-y-6">
                <div className="bg-[#1a1d23] border border-[#2d3139] rounded-lg p-4 space-y-4">
                  <div>
                    <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Assignee</label>
                    {assignee ? (
                      <div className="flex items-center space-x-2 text-sm text-white bg-[#0a0c10] p-2 rounded border border-[#2d3139]">
                        <div className="w-6 h-6 rounded bg-blue-600 flex items-center justify-center font-bold text-xs">{assignee.name.charAt(0).toUpperCase()}</div>
                        <span>{assignee.name}</span>
                      </div>
                    ) : (
                      <span className="text-sm text-slate-500 italic">Unassigned</span>
                    )}
                  </div>
                  <div>
                    <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Deadline</label>
                    <div className="flex items-center space-x-2 text-sm text-white bg-[#0a0c10] p-2 rounded border border-[#2d3139]">
                      <Calendar size={14} className="text-slate-400" />
                      <span>{format(new Date(task.deadline), 'PP')}</span>
                    </div>
                  </div>
                  <div>
                    <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Created</label>
                    <div className="flex items-center space-x-2 text-sm text-white bg-[#0a0c10] p-2 rounded border border-[#2d3139]">
                      <Clock size={14} className="text-slate-400" />
                      <span>{format(new Date(task.createdAt), 'PP')}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-[#1a1d23] border border-[#2d3139] rounded-lg shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col font-sans">
        <div className="px-6 py-4 border-b border-[#2d3139] flex justify-between items-center bg-[#0f1115] rounded-t-lg">
          <h2 className="text-sm font-bold text-white uppercase tracking-widest">{isEdit ? 'Edit Task' : 'Create Task'}</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-red-400 transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="space-y-1">
            <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block">Task Title</label>
            <input
              required
              type="text"
              className="w-full rounded bg-[#0a0c10] border border-[#2d3139] px-3 py-2 text-xs text-white placeholder-slate-600 focus:border-blue-500 focus:outline-none"
              value={formData.title}
              onChange={e => setFormData(p => ({ ...p, title: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block">Status</label>
              <select
                className="w-full rounded bg-[#0a0c10] border border-[#2d3139] px-3 py-2 text-xs text-white uppercase focus:border-blue-500 focus:outline-none appearance-none"
                value={formData.status}
                onChange={e => setFormData(p => ({ ...p, status: e.target.value as any }))}
              >
                <option value="todo">To Do</option>
                <option value="in_progress">In Progress</option>
                <option value="review">Review</option>
                <option value="done">Done</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block">Priority</label>
              <select
                className="w-full rounded bg-[#0a0c10] border border-[#2d3139] px-3 py-2 text-xs text-white uppercase focus:border-blue-500 focus:outline-none appearance-none"
                value={formData.priority}
                onChange={e => setFormData(p => ({ ...p, priority: e.target.value as any }))}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block">Assignee</label>
              <select
                className="w-full rounded bg-[#0a0c10] border border-[#2d3139] px-3 py-2 text-xs text-white uppercase focus:border-blue-500 focus:outline-none appearance-none"
                value={formData.assigneeId || ''}
                onChange={e => setFormData(p => ({ ...p, assigneeId: e.target.value }))}
              >
                <option value="">UNASSIGNED</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.name} ({u.role.replace('_', ' ')})</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block">Deadline</label>
              <input
                type="date"
                required
                className="w-full rounded bg-[#0a0c10] border border-[#2d3139] px-3 py-2 text-xs text-white font-mono focus:border-blue-500 focus:outline-none"
                value={formData.deadline}
                onChange={e => setFormData(p => ({ ...p, deadline: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-1">
             <div className="flex justify-between items-center mb-1">
                <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest flex items-center space-x-2">
                  <GitBranch size={12} /> <span>Git Branch Name</span>
                </label>
                <button
                  type="button"
                  onClick={handleGenerateBranch}
                  disabled={!formData.title || generatingBranch}
                  className="text-[9px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-1 rounded hover:bg-blue-500/20 disabled:opacity-50 flex items-center space-x-1 font-bold tracking-wider uppercase transition-colors"
                >
                  {generatingBranch ? <Loader2 size={10} className="animate-spin" /> : null}
                  <span>Generate AI Branch</span>
                </button>
             </div>
             <input
              type="text"
              placeholder="e.g., feat/add-login-page"
              className="w-full rounded bg-[#0a0c10] border border-[#2d3139] px-3 py-2 focus:border-blue-500 focus:outline-none font-mono text-xs text-blue-400 placeholder-slate-700"
              value={formData.branchName || ''}
              onChange={e => setFormData(p => ({ ...p, branchName: e.target.value }))}
            />
          </div>

          <div className="space-y-2 flex-1 flex flex-col min-h-[250px]">
            <div className="flex justify-between items-center border-b border-[#2d3139] pb-2 shrink-0">
              <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block">Description (Markdown)</label>
              <div className="flex space-x-1 bg-[#0a0c10] border border-[#2d3139] rounded p-0.5">
                <button
                  type="button"
                  onClick={() => setPreviewMode(false)}
                  className={`px-3 py-1 text-[9px] font-bold rounded-sm uppercase tracking-wider ${!previewMode ? 'bg-[#2d3139] text-white' : 'text-slate-500 hover:text-white'}`}
                >
                  Edit View
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewMode(true)}
                  className={`px-3 py-1 text-[9px] font-bold rounded-sm uppercase tracking-wider ${previewMode ? 'bg-[#2d3139] text-white' : 'text-slate-500 hover:text-white'}`}
                >
                  Split View
                </button>
              </div>
            </div>

            <div className={`flex-1 flex gap-4 min-h-0 ${previewMode ? 'h-64' : 'h-48'}`}>
              <div className={`flex flex-col h-full ${previewMode ? 'w-1/2' : 'w-full'}`}>
                <textarea
                  className="w-full h-full rounded bg-[#0a0c10] border border-[#2d3139] px-3 py-3 focus:border-blue-500 focus:outline-none resize-none font-mono text-xs text-slate-300 placeholder-slate-700"
                  value={formData.description}
                  onChange={e => setFormData(p => ({ ...p, description: e.target.value }))}
                  placeholder="Describe the task... Supports markdown format."
                />
              </div>
              {previewMode && (
                <div className="w-1/2 h-full overflow-y-auto prose prose-invert prose-sm max-w-none p-4 rounded border border-[#2d3139] bg-[#0a0c10] text-slate-300 font-sans text-sm">
                  {formData.description ? (
                    <Markdown>{formData.description}</Markdown>
                  ) : (
                    <span className="text-slate-600 italic">No description provided.</span>
                  )}
                </div>
              )}
            </div>
          </div>
        </form>

        <div className="px-6 py-4 border-t border-[#2d3139] flex justify-end space-x-3 bg-[#0f1115] rounded-b-lg shrink-0">
          <button
            type="button"
            onClick={isEdit ? () => setIsViewMode(true) : onClose}
            className="px-4 py-2 text-[10px] font-bold text-slate-400 bg-transparent border border-[#2d3139] hover:bg-[#2d3139] hover:text-white rounded uppercase tracking-wider transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 text-[10px] font-bold text-white bg-blue-600 hover:bg-blue-500 rounded uppercase tracking-wider shadow-lg transition-colors"
          >
            Save Task
          </button>
        </div>
      </div>
    </div>
  );
}
