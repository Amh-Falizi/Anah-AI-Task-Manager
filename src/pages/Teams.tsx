import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Team, TeamMember, User } from '../types';
import { Users, Plus, X, Trash2, Shield } from 'lucide-react';
import { format } from 'date-fns';
import Markdown from 'react-markdown';
import UserAvatar from '../components/UserAvatar';

export default function Teams() {
  const { token, user: currentUser } = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  
  // Data fetching
  const fetchTeams = async () => {
    try {
      const res = await fetch('/api/teams', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setTeams(await res.json());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeams();
  }, [token]);

  return (
    <div className="flex h-full flex-col bg-surface-dim">
      <header className="flex-none flex items-center justify-between px-6 py-4 border-b border-border-subtle bg-surface-dim">
        <div className="flex flex-col">
          <h1 className="text-xl font-semibold text-strong tracking-tight">Teams</h1>
          <p className="text-xs text-muted mt-1">Manage development teams and members</p>
        </div>
        {(currentUser?.role === 'admin' || currentUser?.role === 'manager') && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-strong px-4 py-2 rounded font-medium transition-colors text-sm"
          >
            <Plus size={16} />
            <span>New Team</span>
          </button>
        )}
      </header>
      
      <div className="flex-1 flex overflow-hidden">
        {/* Teams List */}
        <div className={`flex flex-col ${selectedTeam ? 'w-1/3 border-r border-border-subtle' : 'w-full'} overflow-y-auto p-6 transition-all`}>
          {loading ? (
            <div className="text-subtle text-sm">Loading teams...</div>
          ) : teams.length === 0 ? (
            <div className="text-center text-subtle py-12">
              <Users size={48} className="mx-auto mb-4 opacity-50" />
              <p>No teams available.</p>
            </div>
          ) : (
            <div className={selectedTeam ? "space-y-3" : "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"}>
              {teams.map(team => (
                <div 
                  key={team.id}
                  onClick={() => setSelectedTeam(team)}
                  className={`bg-surface border ${selectedTeam?.id === team.id ? 'border-blue-500' : 'border-border-subtle hover:border-slate-500'} rounded-lg p-5 cursor-pointer transition-colors flex flex-col`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-strong font-medium truncate pr-2">{team.name}</h3>
                    {team.ownerId === currentUser?.id && (
                      <span className="text-[10px] bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full font-bold">OWNER</span>
                    )}
                  </div>
                  <div className="text-xs text-muted line-clamp-2 mb-4 flex-1 prose prose-invert prose-sm">
                    {team.description ? (
                      <Markdown>{team.description}</Markdown>
                    ) : (
                      'No description provided.'
                    )}
                  </div>
                  <div className="text-[10px] text-subtle pt-3 border-t border-border-subtle">
                    Created {format(new Date(team.createdAt), 'MMM d, yyyy')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Team Details */}
        {selectedTeam && (
          <div className="flex-1 overflow-y-auto bg-page-bg">
            <TeamDetails 
              team={selectedTeam} 
              onClose={() => setSelectedTeam(null)} 
              onTeamDeleted={() => {
                setSelectedTeam(null);
                fetchTeams();
              }}
            />
          </div>
        )}
      </div>

      {showCreateModal && (
        <CreateTeamModal 
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            fetchTeams();
          }}
        />
      )}
    </div>
  );
}

function CreateTeamModal({ onClose, onSuccess }: { onClose: () => void, onSuccess: () => void }) {
  const { token } = useAuth();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [previewMode, setPreviewMode] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-surface rounded-lg shadow-2xl border border-border-subtle w-full max-w-md overflow-hidden flex flex-col">
        <div className="flex justify-between items-center px-5 py-4 border-b border-border-subtle bg-surface-dim">
          <h2 className="text-sm font-bold text-strong uppercase tracking-wider">Create New Team</h2>
          <button onClick={onClose} className="text-subtle hover:text-strong transition-colors">
            <X size={18} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
          <div>
            <label className="text-[10px] font-bold text-subtle uppercase tracking-widest block mb-2">Team Name *</label>
            <input
              type="text"
              autoFocus
              className="w-full rounded bg-surface-dim border border-border-subtle px-3 py-2 text-sm text-strong focus:border-blue-500 focus:outline-none"
              value={name}
              onChange={e => setName(e.target.value)}
              required
            />
          </div>
          <div>
            <div className="flex justify-between items-center mb-2 shrink-0">
              <label className="text-[10px] font-bold text-subtle uppercase tracking-widest block block">Description (Markdown)</label>
              <div className="flex space-x-1 bg-surface-dim border border-border-subtle rounded p-0.5">
                <button
                  type="button"
                  onClick={() => setPreviewMode(false)}
                  className={`px-3 py-1 text-[9px] font-bold rounded-sm uppercase tracking-wider ${!previewMode ? 'bg-surface-accent text-strong' : 'text-subtle hover:text-strong'}`}
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewMode(true)}
                  className={`px-3 py-1 text-[9px] font-bold rounded-sm uppercase tracking-wider ${previewMode ? 'bg-surface-accent text-strong' : 'text-subtle hover:text-strong'}`}
                >
                  Preview
                </button>
              </div>
            </div>
            
            {!previewMode ? (
              <textarea
                className="w-full rounded bg-surface-dim border border-border-subtle px-3 py-2 text-sm text-strong focus:border-blue-500 focus:outline-none resize-none h-32 font-mono"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Supports Markdown format..."
              />
            ) : (
              <div className="w-full h-32 overflow-y-auto prose prose-invert prose-sm max-w-none p-4 rounded border border-border-subtle bg-surface-dim text-primary font-sans text-sm">
                {description ? (
                  <Markdown>{description}</Markdown>
                ) : (
                  <span className="text-slate-600 italic">No description provided.</span>
                )}
              </div>
            )}
          </div>
          
          <div className="pt-4 flex justify-end gap-2 border-t border-border-subtle mt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-muted hover:text-strong transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !name}
              className="px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-strong rounded transition-colors"
            >
              {submitting ? 'Creating...' : 'Create Team'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function TeamDetails({ team, onClose, onTeamDeleted }: { team: Team, onClose: () => void, onTeamDeleted: () => void }) {
  const { token, user: currentUser } = useAuth();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [userToAdd, setUserToAdd] = useState('');
  const [adding, setAdding] = useState(false);

  const isAdminOrOwner = currentUser?.role === 'admin' || currentUser?.id === team.ownerId;

  const fetchData = async () => {
    setLoading(true);
    try {
      const [membersRes, usersRes] = await Promise.all([
        fetch(`/api/teams/${team.id}/members`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/users', { headers: { Authorization: `Bearer ${token}` } })
      ]);
      
      if (membersRes.ok && usersRes.ok) {
        setMembers(await membersRes.json());
        setAllUsers(await usersRes.json());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [team.id]);

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userToAdd) return;
    setAdding(true);
    try {
      const res = await fetch(`/api/teams/${team.id}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ userId: userToAdd })
      });
      if (res.ok) {
        setUserToAdd('');
        fetchData();
      } else {
        const data = await res.json();
        alert(data.error);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setAdding(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!confirm('Are you sure you want to remove this member?')) return;
    try {
      const res = await fetch(`/api/teams/${team.id}/members/${userId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteTeam = async () => {
    if (!confirm(`Are you sure you want to delete the team "${team.name}"? This action cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/teams/${team.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        onTeamDeleted();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const availableUsers = allUsers.filter(u => !members.some(m => m.id === u.id));

  return (
    <div className="flex flex-col h-full bg-surface-dim">
      <div className="flex justify-between items-center p-6 border-b border-border-subtle">
        <div>
          <h2 className="text-xl font-semibold text-strong">{team.name}</h2>
          <p className="text-xs text-muted mt-1">Created on {format(new Date(team.createdAt), 'MMM d, yyyy')}</p>
        </div>
        <div className="flex items-center gap-2">
          {isAdminOrOwner && (
            <button
              onClick={handleDeleteTeam}
              className="text-red-500 hover:text-red-400 hover:bg-red-500/10 p-2 rounded transition-colors"
              title="Delete Team"
            >
              <Trash2 size={16} />
            </button>
          )}
          <button onClick={onClose} className="text-subtle hover:text-strong p-2 rounded transition-colors">
            <X size={20} />
          </button>
        </div>
      </div>
      
      <div className="p-6 space-y-8 flex-1 overflow-y-auto">
        {team.description && (
          <section>
            <h3 className="text-[10px] font-bold text-subtle uppercase tracking-widest mb-3 border-b border-border-subtle pb-1">Description</h3>
            <div className="prose prose-invert prose-sm max-w-none text-primary">
              <Markdown>{team.description}</Markdown>
            </div>
          </section>
        )}

        <section>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-[10px] font-bold text-subtle uppercase tracking-widest flex items-center">
              <Users size={12} className="mr-2" />
              Members ({members.length})
            </h3>
          </div>

          <div className="bg-surface rounded-lg border border-border-subtle overflow-hidden">
            {loading ? (
              <div className="p-4 text-sm text-subtle text-center">Loading members...</div>
            ) : members.length === 0 ? (
              <div className="p-6 text-sm text-subtle text-center">No members yet.</div>
            ) : (
              <ul className="divide-y divide-[#2d3139]">
                {members.map(member => (
                  <li key={member.id} className="flex justify-between items-center p-4 hover:bg-white/5 transition-colors">
                    <div className="flex items-center gap-3">
                      <UserAvatar user={member} showTooltip={false} />
                      <div>
                        <div className="text-sm font-medium text-strong flex items-center gap-2">
                          {member.name}
                          {member.id === team.ownerId && (
                            <Shield size={12} className="text-blue-400" />
                          )}
                        </div>
                        <div className="text-xs text-muted">{member.email} • {member.role}</div>
                      </div>
                    </div>
                    {isAdminOrOwner && member.id !== team.ownerId && (
                      <button
                        onClick={() => handleRemoveMember(member.id)}
                        className="text-subtle hover:text-red-400 p-2 rounded transition-colors text-xs"
                      >
                        Remove
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
            
            {isAdminOrOwner && availableUsers.length > 0 && (
              <div className="p-4 bg-page-bg border-t border-border-subtle">
                <form onSubmit={handleAddMember} className="flex gap-2">
                  <select
                    className="flex-1 rounded bg-surface-dim border border-border-subtle px-3 py-2 text-sm text-strong focus:border-blue-500 focus:outline-none"
                    value={userToAdd}
                    onChange={e => setUserToAdd(e.target.value)}
                  >
                    <option value="">Select a user to add...</option>
                    {availableUsers.map(u => (
                      <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    disabled={!userToAdd || adding}
                    className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-strong px-4 py-2 rounded text-sm font-medium transition-colors whitespace-nowrap"
                  >
                    Add Member
                  </button>
                </form>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
