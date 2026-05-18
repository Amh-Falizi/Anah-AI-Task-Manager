import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { X, Activity, User, CheckCircle2, CircleDashed } from 'lucide-react';

interface WorkloadModalProps {
  projectId: string;
  projectName: string;
  onClose: () => void;
}

interface UserWorkload {
  user: { id: string; name: string; email: string };
  total: number;
  done: number;
  in_progress: number;
  review: number;
  todo: number;
  completionPercentage: number;
}

export default function WorkloadModal({ projectId, projectName, onClose }: WorkloadModalProps) {
  const { token } = useAuth();
  const [workloads, setWorkloads] = useState<UserWorkload[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const fetchWorkload = async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}/workload`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok && active) {
          setWorkloads(await res.json());
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchWorkload();
    return () => { active = false; };
  }, [projectId, token]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-[#1a1d23] border border-[#2d3139] rounded-lg shadow-2xl w-full max-w-2xl flex flex-col font-sans max-h-[85vh]">
        <div className="px-6 py-4 border-b border-[#2d3139] flex justify-between items-center bg-[#0f1115] rounded-t-lg shrink-0">
          <div className="flex items-center space-x-2">
             <Activity className="text-blue-500" size={18} />
             <h2 className="text-sm font-bold text-white tracking-widest">{projectName} - Team Workload</h2>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-red-400 transition-colors">
            <X size={18} />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto">
          {loading ? (
            <div className="text-slate-500 text-sm text-center py-8">Loading workload stats...</div>
          ) : workloads.length === 0 ? (
            <div className="text-center text-slate-500 py-12">
               <User size={32} className="mx-auto mb-3 opacity-20" />
               <p>No assigned tasks found in this project.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {workloads.map(w => (
                <div key={w.user.id} className="bg-[#0a0c10] border border-[#2d3139] p-4 rounded-lg">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-full bg-[#1a1d23] border border-[#2d3139] flex flex-col items-center justify-center text-xs font-bold text-white uppercase overflow-hidden">
                        {w.user.name.split(' ').map(n => n[0]).join('').substring(0, 2)}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-white">{w.user.name}</div>
                        <div className="text-xs text-slate-400">{w.user.email}</div>
                      </div>
                    </div>
                    <div className="text-right">
                       <span className="text-lg font-bold text-white">{w.completionPercentage}%</span>
                       <div className="text-[10px] text-slate-500 uppercase tracking-widest">Completed</div>
                    </div>
                  </div>
                  
                  {/* Progress Bar */}
                  <div className="h-2 w-full bg-[#1a1d23] rounded-full overflow-hidden flex mb-4">
                     <div style={{ width: `${w.done > 0 ? (w.done / w.total) * 100 : 0}%` }} className="bg-emerald-500 h-full" />
                     <div style={{ width: `${w.review > 0 ? (w.review / w.total) * 100 : 0}%` }} className="bg-yellow-500 h-full" />
                     <div style={{ width: `${w.in_progress > 0 ? (w.in_progress / w.total) * 100 : 0}%` }} className="bg-blue-500 h-full" />
                  </div>
                  
                  {/* Stats Grid */}
                  <div className="grid grid-cols-4 gap-2 text-center">
                    <div className="bg-[#1a1d23] rounded py-2 border border-[#2d3139]">
                       <div className="text-lg font-semibold text-slate-300">{w.total}</div>
                       <div className="text-[9px] uppercase tracking-wider text-slate-500">Total</div>
                    </div>
                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded py-2 text-emerald-400">
                       <div className="flex items-center justify-center space-x-1 mb-1">
                          <CheckCircle2 size={12} />
                          <span className="text-lg font-semibold leading-none">{w.done}</span>
                       </div>
                       <div className="text-[9px] uppercase tracking-wider opacity-70">Done</div>
                    </div>
                    <div className="bg-yellow-500/10 border border-yellow-500/20 rounded py-2 text-yellow-400">
                       <div className="text-lg font-semibold leading-none mb-1">{w.review}</div>
                       <div className="text-[9px] uppercase tracking-wider opacity-70">Review</div>
                    </div>
                    <div className="bg-blue-500/10 border border-blue-500/20 rounded py-2 text-blue-400">
                       <div className="flex items-center justify-center space-x-1 mb-1">
                          <CircleDashed size={12} />
                          <span className="text-lg font-semibold leading-none">{w.in_progress}</span>
                       </div>
                       <div className="text-[9px] uppercase tracking-wider opacity-70">In Progress</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
