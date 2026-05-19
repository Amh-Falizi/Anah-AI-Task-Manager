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
  onCreateSubtask?: (parentId: string) => void;
  parentId?: string | null;
  projectId?: string | null;
}

export default function TaskModal({ task, users, tasks = [], onClose, onSave, onUpdateTask, onDeleteTask, onCreateSubtask, parentId, projectId }: TaskModalProps) {
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
    projectId: task?.projectId || projectId || null,
    dependencies: task?.dependencies || []
  });
  const [generatingBranch, setGeneratingBranch] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  
  const [activeTab, setActiveTab] = useState<'details' | 'comments' | 'activity'>('details');
  const [comments, setComments] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editCommentContent, setEditCommentContent] = useState('');
  const [newCommentPreviewMode, setNewCommentPreviewMode] = useState(false);
  const [editCommentPreviewMode, setEditCommentPreviewMode] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);

  useEffect(() => {
    if (isViewMode && task) {
      setLoadingDetails(true);
      fetch(`/api/tasks/${task.id}/details`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      .then(res => res.json())
      .then(data => {
        setComments(data.comments || []);
        setActivities(data.activities || []);
      })
      .catch(err => console.error("Error fetching details", err))
      .finally(() => setLoadingDetails(false));
    }
  }, [isViewMode, task, token]);

  const handleCreateComment = async () => {
    if (!newComment.trim() || !task) return;
    try {
      const res = await fetch(`/api/tasks/${task.id}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ content: newComment.trim() })
      });
      const comment = await res.json();
      setComments([...comments, comment]);
      setNewComment('');
      // Optionally reload activities since comment adds one
      fetch(`/api/tasks/${task.id}/details`, { headers: { Authorization: `Bearer ${token}` } })
        .then(res => res.json())
        .then(data => setActivities(data.activities || []));
    } catch (err) {
      console.error(err);
    }
  };

  const handleEditComment = async (commentId: string) => {
    if (!editCommentContent.trim() || !task) return;
    try {
      const res = await fetch(`/api/tasks/${task.id}/comments/${commentId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ content: editCommentContent.trim() })
      });
      const updatedComment = await res.json();
      setComments(comments.map(c => c.id === commentId ? updatedComment : c));
      setEditingCommentId(null);
      setEditCommentContent('');
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm('Delete this comment?') || !task) return;
    try {
      await fetch(`/api/tasks/${task.id}/comments/${commentId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      setComments(comments.filter(c => c.id !== commentId));
    } catch (err) {
      console.error(err);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.status === 'done') {
       const pendingDeps = (formData.dependencies || []).filter(depId => {
         const dep = tasks.find(t => t.id === depId);
         return dep && dep.status !== 'done';
       });
       if (pendingDeps.length > 0) {
         alert(`Cannot complete task. ${pendingDeps.length} dependencies are still pending.`);
         return;
       }
    }

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
              <div className="col-span-2 flex flex-col h-full min-h-0">
                <div className="flex border-b border-[#2d3139] mb-4 space-x-1 shrink-0">
                  <button 
                    onClick={() => setActiveTab('details')}
                    className={cn("px-4 py-2 text-[10px] font-bold uppercase tracking-widest border-b-2 transition-colors", activeTab === 'details' ? "border-blue-500 text-blue-400" : "border-transparent text-slate-500 hover:text-white")}
                  >
                    Details
                  </button>
                  <button 
                    onClick={() => setActiveTab('comments')}
                    className={cn("px-4 py-2 text-[10px] font-bold uppercase tracking-widest border-b-2 transition-colors", activeTab === 'comments' ? "border-blue-500 text-blue-400" : "border-transparent text-slate-500 hover:text-white")}
                  >
                    Comments {comments.length > 0 && `(${comments.length})`}
                  </button>
                  <button 
                    onClick={() => setActiveTab('activity')}
                    className={cn("px-4 py-2 text-[10px] font-bold uppercase tracking-widest border-b-2 transition-colors", activeTab === 'activity' ? "border-blue-500 text-blue-400" : "border-transparent text-slate-500 hover:text-white")}
                  >
                    Activity {activities.length > 0 && `(${activities.length})`}
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto space-y-6 pr-2">
                  {activeTab === 'details' && (
                    <div className="space-y-6">
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

                      {task.dependencies && task.dependencies.length > 0 && (
                        <div>
                          <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 border-b border-[#2d3139] pb-1">Dependencies</h3>
                          <div className="space-y-2">
                             {task.dependencies.map(depId => {
                               const depTask = tasks.find(t => t.id === depId);
                               if (!depTask) return null;
                               return (
                                  <div key={depId} className="flex items-center space-x-2 bg-[#1a1d23] p-2 rounded border border-[#2d3139]">
                                     <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider", depTask.status === 'done' ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400")}>{depTask.status === 'done' ? 'Met' : 'Pending'}</span>
                                     <span className="text-sm text-white">{depTask.title}</span>
                                  </div>
                               );
                             })}
                          </div>
                        </div>
                      )}

                      {true && (
                        <div>
                          <div className="flex justify-between items-center mb-3 border-b border-[#2d3139] pb-1">
                            <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Subtasks ({subtasks.length})</h3>
                            {onCreateSubtask && (
                               <button 
                                 onClick={() => onCreateSubtask(task.id)} 
                                 className="flex items-center space-x-1 text-[9px] font-bold bg-[#1a1d23] border border-[#2d3139] px-2 py-0.5 rounded text-slate-400 hover:text-white transition-colors uppercase tracking-wider"
                               >
                                 <Plus size={10} />
                                 <span>Add Subtask</span>
                               </button>
                            )}
                          </div>
                          {subtasks.length > 0 ? (
                            <div className="space-y-2">
                              {subtasks.map(st => (
                                <div key={st.id} className="flex items-center justify-between bg-[#1a1d23] p-3 rounded border border-[#2d3139]">
                                  <div className="flex items-center space-x-3">
                                    <button 
                                      onClick={() => {
                                        if (onUpdateTask) {
                                          if (st.status !== 'done') {
                                            const pendingDeps = (st.dependencies || []).filter(depId => {
                                              const dep = tasks.find(t => t.id === depId);
                                              return dep && dep.status !== 'done';
                                            });
                                            if (pendingDeps.length > 0) {
                                              alert(`Cannot complete task. ${pendingDeps.length} dependencies are still pending.`);
                                              return;
                                            }
                                          }
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
                          ) : (
                            <div className="text-xs text-slate-500 italic p-2 mt-2 border border-[#2d3139] border-dashed rounded text-center">No subtasks found.</div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === 'comments' && (
                    <div className="space-y-4 flex flex-col h-full bg-[#1a1d23] rounded p-4 border border-[#2d3139]">
                       <div className="flex-1 overflow-y-auto space-y-4 min-h-[200px]">
                         {loadingDetails ? (
                           <div className="flex items-center justify-center p-4"><Loader2 className="animate-spin text-slate-500" size={20} /></div>
                         ) : comments.length > 0 ? (
                            comments.map(c => {
                              const author = users.find(u => u.id === c.userId);
                              const isMe = c.userId === user?.id;
                              const canModify = isMe || user?.role === 'admin';
                              const isEditing = editingCommentId === c.id;

                              return (
                                <div key={c.id} className="bg-[#0a0c10] border border-[#2d3139] p-3 rounded group">
                                  <div className="flex items-center justify-between mb-2">
                                     <div className="flex items-center space-x-2">
                                       <span className="text-xs font-bold text-white">{author ? author.name : 'Unknown'}</span>
                                       <span className="text-[9px] text-slate-500 font-mono">{format(new Date(c.createdAt), 'MMM d, h:mm a')}</span>
                                     </div>
                                     {canModify && !isEditing && (
                                       <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity space-x-1">
                                          <button 
                                            onClick={() => { setEditingCommentId(c.id); setEditCommentContent(c.content); }}
                                            className="text-slate-500 hover:text-blue-400 p-0.5 rounded transition-colors"
                                            title="Edit comment"
                                          >
                                            <Edit2 size={12} />
                                          </button>
                                          <button 
                                            onClick={() => handleDeleteComment(c.id)}
                                            className="text-slate-500 hover:text-red-400 p-0.5 rounded transition-colors"
                                            title="Delete comment"
                                          >
                                            <Trash size={12} />
                                          </button>
                                       </div>
                                     )}
                                  </div>
                                  
                                  {isEditing ? (
                                    <div className="space-y-2 mt-2 border-t border-[#2d3139] pt-2">
                                      <div className="flex justify-between items-center mb-1">
                                        <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block">Edit Comment (Markdown)</label>
                                        <div className="flex space-x-1 bg-[#0a0c10] border border-[#2d3139] rounded p-0.5">
                                          <button
                                            type="button"
                                            onClick={() => setEditCommentPreviewMode(false)}
                                            className={`px-3 py-1 text-[9px] font-bold rounded-sm uppercase tracking-wider ${!editCommentPreviewMode ? 'bg-[#2d3139] text-white' : 'text-slate-500 hover:text-white'}`}
                                          >
                                            Edit View
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => setEditCommentPreviewMode(true)}
                                            className={`px-3 py-1 text-[9px] font-bold rounded-sm uppercase tracking-wider ${editCommentPreviewMode ? 'bg-[#2d3139] text-white' : 'text-slate-500 hover:text-white'}`}
                                          >
                                            Split View
                                          </button>
                                        </div>
                                      </div>
                                      <div className={`flex gap-2 ${editCommentPreviewMode ? 'h-32' : 'h-16'}`}>
                                        <textarea
                                          className={`bg-[#0a0c10] border border-[#2d3139] rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 font-mono resize-y min-h-[64px] h-full flex-1 ${editCommentPreviewMode ? 'w-1/2' : 'w-full'}`}
                                          value={editCommentContent}
                                          onChange={e => setEditCommentContent(e.target.value)}
                                        />
                                        {editCommentPreviewMode && (
                                          <div className="w-1/2 overflow-y-auto prose prose-invert prose-sm max-w-none p-2 rounded border border-[#2d3139] bg-[#0a0c10] text-slate-300 font-sans h-full">
                                            {editCommentContent ? (
                                              <Markdown>{editCommentContent}</Markdown>
                                            ) : (
                                              <span className="text-slate-600 italic">Preview...</span>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                      <div className="flex justify-end space-x-2 mt-2">
                                        <button 
                                          onClick={() => setEditingCommentId(null)}
                                          className="text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-white px-2 py-1"
                                        >
                                          Cancel
                                        </button>
                                        <button 
                                          onClick={() => handleEditComment(c.id)}
                                          disabled={!editCommentContent.trim()}
                                          className="text-[10px] font-bold uppercase tracking-widest bg-blue-600 hover:bg-blue-500 text-white px-3 py-1 rounded disabled:opacity-50"
                                        >
                                          Save
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="prose prose-invert prose-sm max-w-none text-slate-300">
                                      <Markdown>{c.content}</Markdown>
                                    </div>
                                  )}
                                </div>
                              )
                            })
                         ) : (
                           <div className="text-sm text-slate-500 italic p-4 text-center">No comments yet.</div>
                         )}
                       </div>
                       <div className="mt-auto shrink-0 flex flex-col space-y-2 pt-4 border-t border-[#2d3139]">
                         <div className="flex justify-between items-center mb-1">
                           <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block">New Comment (Markdown)</label>
                           <div className="flex space-x-1 bg-[#0a0c10] border border-[#2d3139] rounded p-0.5">
                             <button
                               type="button"
                               onClick={() => setNewCommentPreviewMode(false)}
                               className={`px-3 py-1 text-[9px] font-bold rounded-sm uppercase tracking-wider ${!newCommentPreviewMode ? 'bg-[#2d3139] text-white' : 'text-slate-500 hover:text-white'}`}
                             >
                               Edit View
                             </button>
                             <button
                               type="button"
                               onClick={() => setNewCommentPreviewMode(true)}
                               className={`px-3 py-1 text-[9px] font-bold rounded-sm uppercase tracking-wider ${newCommentPreviewMode ? 'bg-[#2d3139] text-white' : 'text-slate-500 hover:text-white'}`}
                             >
                               Split View
                             </button>
                           </div>
                         </div>
                         <div className={`flex gap-2 ${newCommentPreviewMode ? 'h-32' : 'h-16'}`}>
                           <textarea 
                             className={`bg-[#0a0c10] border border-[#2d3139] rounded px-3 py-2 text-sm text-white resize-y min-h-[64px] focus:outline-none focus:border-blue-500 font-mono h-full flex-1 ${newCommentPreviewMode ? 'w-1/2' : 'w-full'}`}
                             placeholder="Write a comment... Supports markdown."
                             value={newComment}
                             onChange={e => setNewComment(e.target.value)}
                           />
                           {newCommentPreviewMode && (
                             <div className="w-1/2 overflow-y-auto prose prose-invert prose-sm max-w-none p-2 rounded border border-[#2d3139] bg-[#0a0c10] text-slate-300 font-sans h-full">
                               {newComment ? (
                                 <Markdown>{newComment}</Markdown>
                               ) : (
                                 <span className="text-slate-600 italic">Preview...</span>
                               )}
                             </div>
                           )}
                         </div>
                         <div className="flex justify-end mt-2">
                           <button 
                             onClick={() => { handleCreateComment(); setNewCommentPreviewMode(false); }}
                             disabled={!newComment.trim()}
                             className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-[10px] uppercase tracking-widest rounded px-4 py-2 disabled:opacity-50 transition-colors"
                           >
                             Post Comment
                           </button>
                         </div>
                       </div>
                    </div>
                  )}

                  {activeTab === 'activity' && (
                    <div className="space-y-4 bg-[#1a1d23] rounded p-4 border border-[#2d3139] min-h-[200px]">
                      {loadingDetails ? (
                        <div className="flex items-center justify-center p-4"><Loader2 className="animate-spin text-slate-500" size={20} /></div>
                      ) : activities.length > 0 ? (
                        <div className="space-y-4 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-700 before:to-transparent">
                          {activities.map(a => {
                            const author = users.find(u => u.id === a.userId);
                            return (
                              <div key={a.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                                 <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white bg-slate-200 text-slate-500 shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow">
                                    <Clock size={14} className="text-slate-500" />
                                 </div>
                                 <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-3 rounded border border-slate-700 bg-slate-800 shadow">
                                   <div className="flex items-center justify-between mb-1">
                                      <div className="font-bold text-slate-200 text-xs">{author ? author.name : 'Unknown User'}</div>
                                      <time className="font-mono text-[9px] text-slate-400">{format(new Date(a.createdAt), 'MMM d, h:mm a')}</time>
                                   </div>
                                   <div className="text-xs text-slate-300">{a.action}</div>
                                 </div>
                              </div>
                            )
                          })}
                        </div>
                      ) : (
                         <div className="text-sm text-slate-500 italic p-4 text-center">No activity recorded.</div>
                      )}
                    </div>
                  )}
                </div>
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
             <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block">Dependencies (Blocks this task)</label>
             <div className="max-h-32 overflow-y-auto bg-[#0a0c10] border border-[#2d3139] rounded p-2 space-y-1">
                {tasks.filter(t => t.id !== task?.id && (!formData.projectId || t.projectId === formData.projectId)).map(t => (
                  <label key={t.id} className="flex items-center space-x-2 text-xs text-white p-1 hover:bg-[#1a1d23] rounded cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="rounded border-[#2d3139] bg-transparent"
                      checked={formData.dependencies?.includes(t.id) || false}
                      onChange={(e) => {
                         const deps = formData.dependencies || [];
                         if (e.target.checked) setFormData(p => ({ ...p, dependencies: [...deps, t.id] }));
                         else setFormData(p => ({ ...p, dependencies: deps.filter(id => id !== t.id) }));
                      }}
                    />
                    <span>{t.title}</span>
                    <span className="text-slate-500 text-[10px] uppercase">({t.status.replace('_', ' ')})</span>
                  </label>
                ))}
                {tasks.filter(t => t.id !== task?.id && (!formData.projectId || t.projectId === formData.projectId)).length === 0 && (
                   <div className="text-xs text-slate-500 italic p-1">No other tasks available to depend on.</div>
                )}
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
                  disabled={generatingBranch}
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
