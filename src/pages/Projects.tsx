import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Project } from '../types';
import { FolderKanban, Plus, X, Trash2, Calendar, LayoutDashboard } from 'lucide-react';
import { format } from 'date-fns';
import { useNavigate } from 'react-router';

export default function Projects() {
  const { token, user: currentUser } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const navigate = useNavigate();
  
  const fetchProjects = async () => {
    try {
      const res = await fetch('/api/projects', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setProjects(await res.json());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) fetchProjects();
  }, [token]);

  return (
    <div className="flex h-full flex-col bg-[#0a0c10]">
      <header className="flex-none flex items-center justify-between px-6 py-4 border-b border-[#2d3139] bg-[#0a0c10]">
        <div className="flex flex-col">
          <h1 className="text-xl font-semibold text-white tracking-tight">Projects</h1>
          <p className="text-xs text-slate-400 mt-1">Manage all projects and their related tasks</p>
        </div>
        {(currentUser?.role === 'admin' || currentUser?.role === 'manager') && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-medium transition-colors text-sm"
          >
            <Plus size={16} />
            <span>New Project</span>
          </button>
        )}
      </header>
      
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="text-slate-500 text-sm">Loading projects...</div>
        ) : projects.length === 0 ? (
          <div className="text-center text-slate-500 py-20 bg-[#1a1d23] rounded-xl border border-[#2d3139] border-dashed">
            <FolderKanban size={48} className="mx-auto mb-4 text-slate-600" />
            <h3 className="text-lg font-medium text-slate-300 mb-2">No projects yet</h3>
            <p className="text-sm">Create a new project to start organizing tasks.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {projects.map(project => (
              <div 
                key={project.id}
                className="bg-[#1a1d23] border border-[#2d3139] hover:border-blue-500/50 rounded-lg p-5 transition-all group flex flex-col"
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                      <FolderKanban size={20} />
                    </div>
                    <div>
                      <h3 className="text-white font-medium truncate">{project.name}</h3>
                      {project.ownerId === currentUser?.id && (
                        <span className="text-[9px] bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded font-bold tracking-wider uppercase inline-block mt-1">OWNER</span>
                      )}
                    </div>
                  </div>
                </div>
                
                <p className="text-xs text-slate-400 line-clamp-2 mb-6 flex-1 min-h-[32px]">
                  {project.description || 'No description provided.'}
                </p>
                
                <div className="flex items-center justify-between pt-4 border-t border-[#2d3139]">
                  <div className="flex items-center text-[10px] text-slate-500 font-medium">
                    <Calendar size={12} className="mr-1.5" />
                    {format(new Date(project.createdAt), 'MMM d, yyyy')}
                  </div>
                  <button
                    onClick={() => navigate(`/board?projectId=${project.id}`)}
                    className="flex items-center space-x-1.5 text-xs text-blue-400 hover:text-blue-300 font-medium bg-blue-500/10 hover:bg-blue-500/20 px-2.5 py-1.5 rounded transition-colors"
                  >
                    <LayoutDashboard size={14} />
                    <span>View Board</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showCreateModal && (
        <CreateProjectModal 
          onClose={() => setShowCreateModal(false)} 
          onSuccess={() => {
            setShowCreateModal(false);
            fetchProjects();
          }} 
        />
      )}
    </div>
  );
}

function CreateProjectModal({ onClose, onSuccess }: { onClose: () => void, onSuccess: () => void }) {
  const { token } = useAuth();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    
    setSubmitting(true);
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ name, description })
      });
      if (res.ok) {
        onSuccess();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-[#1a1d23] border border-[#2d3139] rounded-lg shadow-2xl w-full max-w-md flex flex-col font-sans">
        <div className="px-6 py-4 border-b border-[#2d3139] flex justify-between items-center bg-[#0f1115] rounded-t-lg">
          <h2 className="text-sm font-bold text-white uppercase tracking-widest">Create Project</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-red-400 transition-colors">
            <X size={18} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6">
          <div className="space-y-4">
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2">Project Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
                required
                placeholder="e.g. Frontend Redesign"
                className="w-full bg-[#0a0c10] border border-[#2d3139] rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500 text-sm"
              />
            </div>
            
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                placeholder="Brief description of the project goals..."
                className="w-full bg-[#0a0c10] border border-[#2d3139] rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500 resize-none text-sm"
              />
            </div>
          </div>
          
          <div className="mt-6 flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || submitting}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 text-white rounded text-sm font-medium transition-colors"
            >
              {submitting ? 'Creating...' : 'Create Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
