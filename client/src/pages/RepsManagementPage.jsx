import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api, { extractError } from '../lib/axios';
import { Users, UserCheck, Trash2, Plus, ShieldCheck, Mail, ShieldAlert } from 'lucide-react';

export default function RepsManagementPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('active'); // 'active' or 'pending'
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [assignmentRule, setAssignmentRule] = useState(null);
  const [editingTerritory, setEditingTerritory] = useState({});
  
  // Add rep form states
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [territoryError, setTerritoryError] = useState('');
  const [ruleError, setRuleError] = useState('');

  // Fetch users
  const { data: users = [], isLoading, error } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const res = await api.get('/users');
      // fetch assignment rule
      try {
        const ruleRes = await api.get('/assignment-rules');
        setAssignmentRule(ruleRes.data);
      } catch (e) {
        // ignore
      }
      return res.data;
    },
  });

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: async (id) => {
      const res = await api.put(`/users/${id}/approve`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const res = await api.delete(`/users/${id}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });

  const handleAddRep = async (e) => {
    e.preventDefault();
    setFormError('');
    setIsSubmitting(true);

    try {
      await api.post('/users', {
        name,
        email,
        password,
        role: 'rep',
      });
      setName('');
      setEmail('');
      setPassword('');
      setIsAddModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['users'] });
    } catch (err) {
      setFormError(extractError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const reps = users.filter((u) => u.role === 'rep');
  const activeReps = reps.filter((u) => u.approved);
  const pendingReps = reps.filter((u) => !u.approved);

  const displayedReps = activeTab === 'active' ? activeReps : pendingReps;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Sales Team</h1>
          <p className="text-slate-500 dark:text-slate-400">Manage internal sales representatives and approvals.</p>
        </div>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors shadow-lg shadow-blue-500/20"
        >
          <Plus className="w-5 h-5" />
          Add Sales Rep
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={() => setActiveTab('active')}
          className={`px-4 py-2.5 font-medium text-sm border-b-2 transition-all -mb-px flex items-center gap-2 ${
            activeTab === 'active'
              ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          Active Reps ({activeReps.length})
        </button>
        <button
          onClick={() => setActiveTab('pending')}
          className={`px-4 py-2.5 font-medium text-sm border-b-2 transition-all -mb-px flex items-center gap-2 ${
            activeTab === 'pending'
              ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <ShieldAlert className="w-4 h-4" />
          Pending Approval ({pendingReps.length})
        </button>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-slate-500">Loading sales team...</div>
      ) : error ? (
        <div className="text-center py-12 text-red-500">Failed to load sales team.</div>
      ) : displayedReps.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
          <Users className="w-12 h-12 mx-auto text-slate-400 dark:text-slate-600 mb-4" />
          <h3 className="text-lg font-medium text-slate-900 dark:text-white">No representatives found</h3>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            {activeTab === 'active' ? 'Create a new rep or approve pending registrations.' : 'No new representatives are pending approval.'}
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Email</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Joined At</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {displayedReps.map((rep) => (
                  <tr key={rep._id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center font-semibold text-blue-700 dark:text-blue-300">
                          {rep.name.charAt(0)}
                        </div>
                        <div className="font-medium text-slate-900 dark:text-white">{rep.name}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{rep.email}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        rep.approved
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                      }`}>
                        {rep.approved ? 'Active' : 'Pending Approval'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-500 dark:text-slate-400 text-sm">
                      {new Date(rep.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <div className="flex items-center gap-2 justify-end">
                        <input
                          type="text"
                          placeholder="Territory"
                          value={editingTerritory[rep._id] ?? (rep.territory || '')}
                          onChange={(e) => setEditingTerritory(prev => ({ ...prev, [rep._id]: e.target.value }))}
                          className="px-2 py-1.5 border border-slate-300 dark:border-slate-700 rounded-md text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                        />
                        <button
                          onClick={async () => {
                            const newTerr = editingTerritory[rep._id] ?? rep.territory ?? '';
                            setTerritoryError('');
                            try {
                              await api.put(`/users/${rep._id}`, { territory: newTerr });
                              queryClient.invalidateQueries({ queryKey: ['users'] });
                            } catch (err) {
                              setTerritoryError(extractError(err));
                            }
                          }}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 rounded-md text-sm font-medium transition-colors"
                        >
                          Save
                        </button>
                        {territoryError && (
                          <span className="text-xs text-red-500 ml-2">{territoryError}</span>
                        )}
                      </div>
                      {!rep.approved && (
                        <button
                          onClick={() => approveMutation.mutate(rep._id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors"
                        >
                          <UserCheck className="w-4 h-4" />
                          Approve
                        </button>
                      )}
                      <button
                        onClick={() => {
                          if (confirm(`Are you sure you want to remove ${rep.name}?`)) {
                            deleteMutation.mutate(rep._id);
                          }
                        }}
                        className="inline-flex items-center p-1.5 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400 text-slate-400 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Assignment Rule Panel */}
      <div className="mt-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
        <div className="mb-4">
          <h3 className="font-semibold text-slate-900 dark:text-white text-base">Assignment Rules</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Control how new leads are automatically assigned to reps.</p>
        </div>
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium text-slate-600 dark:text-slate-300 whitespace-nowrap">Rule Type:</label>
              <select
                value={assignmentRule?.type || 'round_robin'}
                onChange={async (e) => {
                  const newType = e.target.value;
                  setRuleError('');
                  try {
                    const res = await api.put('/assignment-rules', { type: newType });
                    setAssignmentRule(res.data);
                  } catch (err) {
                    setRuleError(extractError(err));
                  }
                }}
            className="px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          >
            <option value="round_robin">Round Robin</option>
            <option value="territory">Territory-based</option>
          </select>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
            Active: {assignmentRule?.type === 'territory' ? 'Territory-based' : 'Round Robin'}
          </span>
          {ruleError && (
            <span className="ml-2 text-xs text-red-500">{ruleError}</span>
          )}
        </div>
      </div>

      {/* Add Rep Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-md rounded-2xl shadow-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
              <h3 className="font-semibold text-lg text-slate-900 dark:text-white">Add New Sales Representative</h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-medium text-lg">×</button>
            </div>
            <form onSubmit={handleAddRep} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-600 dark:bg-red-900/30 dark:border-red-800 dark:text-red-400 rounded-lg text-sm">
                  {formError}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="John Doe"
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="john@teamgrid.com"
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>
              <div className="flex gap-3 justify-end pt-4 border-t border-slate-200 dark:border-slate-800 mt-6">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-70 text-white rounded-lg font-medium transition-colors"
                >
                  {isSubmitting ? 'Creating...' : 'Create Rep'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
