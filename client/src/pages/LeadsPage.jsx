import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api, { extractError } from '../lib/axios';
import { useForm } from 'react-hook-form';
import { Search, Plus, X, UserCheck, ChevronDown, CheckCircle2, AlertCircle, Zap } from 'lucide-react';
import { cn } from '../lib/utils';
import useAuthStore from '../store/authStore';

export default function LeadsPage() {
  const [statusFilter, setStatusFilter] = useState('');
  const [searchText, setSearchText] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [assigningLead, setAssigningLead] = useState(null); // lead being reassigned
  const [activeDropdownId, setActiveDropdownId] = useState(null); // lead whose status dropdown is open
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  };

  const { data: leads = [], isLoading, error } = useQuery({
    queryKey: ['leads', statusFilter],
    queryFn: async () => {
      const res = await api.get('/leads', { params: { status: statusFilter } });
      return res.data;
    },
  });

  // Fetch all tasks to show indicators on each lead row
  const { data: allTasks = [] } = useQuery({
    queryKey: ['tasks'],
    queryFn: async () => (await api.get('/tasks', { params: { status: 'pending' } })).data,
  });

  // Build a map: leadId -> tasks[]
  const tasksByLead = React.useMemo(() => {
    return allTasks.reduce((acc, task) => {
      const lid = task.relatedTo?._id || task.relatedTo;
      if (!lid) return acc;
      const key = typeof lid === 'object' ? lid._id?.toString() : lid.toString();
      if (!acc[key]) acc[key] = [];
      acc[key].push(task);
      return acc;
    }, {});
  }, [allTasks]);

  // Fetch approved reps for assignment dropdown
  const { data: reps = [] } = useQuery({
    queryKey: ['reps'],
    queryFn: async () => {
      const res = await api.get('/users/reps');
      return res.data;
    },
    enabled: user?.role === 'admin',
  });

  const [createError, setCreateError] = useState('');

  const createMutation = useMutation({
    mutationFn: async (newLead) => {
      const res = await api.post('/leads', newLead);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      setIsModalOpen(false);
      setCreateError('');
    },
    onError: (error) => {
      setCreateError(extractError(error));
    },
  });

  const reassignMutation = useMutation({
    mutationFn: async ({ id, assignedTo }) => {
      const res = await api.put(`/leads/${id}`, { assignedTo: assignedTo || null });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      setAssigningLead(null);
    },
    onError: (error) => {
      alert(extractError(error));
    },
  });

  const updateLeadStatusMutation = useMutation({
    mutationFn: async ({ id, status }) => {
      const res = await api.put(`/leads/${id}`, { status });
      return res.data;
    },
    onSuccess: (_, { status }) => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      // Invalidate tasks so the Tasks page reflects the new auto-created follow-up
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['tasks-admin'] });
      if (status === 'contacted' || status === 'qualified') {
        showToast(
          `Lead marked as "${status}" — a follow-up task has been added to the rep's queue, due tomorrow.`,
          'task'
        );
      } else if (status === 'won') {
        showToast(`Lead marked as Won. Great work.`, 'success');
      }
    },
    onError: (error) => {
      showToast(extractError(error), 'error');
    },
  });

  const getScoreBadge = (score) => {
    if (score < 20) return 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700';
    if (score < 50) return 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/50 dark:text-blue-300 dark:border-blue-800';
    if (score < 80) return 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/50 dark:text-amber-300 dark:border-amber-800';
    return 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/50 dark:text-red-300 dark:border-red-800';
  };

  const getStatusBadge = (status) => {
    const map = {
      new:       'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/50',
      contacted: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900/50',
      qualified: 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-900/50',
      won:       'bg-teal-100 text-teal-700 border-teal-200 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-900/50',
      lost:      'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-900/40 dark:text-slate-300 dark:border-slate-800/50',
    };
    return map[status] || 'bg-slate-100 text-slate-700 border-slate-200';
  };

  const filteredLeads = leads.filter((lead) => {
    if (!searchText) return true;
    const q = searchText.toLowerCase();
    return (
      lead.name?.toLowerCase().includes(q) ||
      lead.email?.toLowerCase().includes(q) ||
      lead.company?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6 relative">

      {/* Toast notification */}
      {toast && (
        <div className={cn(
          'fixed top-4 right-4 z-50 max-w-sm w-full p-4 rounded-xl border shadow-xl flex gap-3 items-start animate-in fade-in slide-in-from-top-2',
          toast.type === 'error'
            ? 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900 text-red-800 dark:text-red-200'
            : toast.type === 'task'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
        )}>
          {toast.type === 'error'
            ? <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            : toast.type === 'task'
              ? <Zap className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
              : <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
          }
          <div className="flex-1">
            <p className={cn(
              'text-sm font-semibold',
              toast.type === 'error' ? 'text-red-700 dark:text-red-300'
                : toast.type === 'task' ? 'text-emerald-700 dark:text-emerald-300'
                  : 'text-slate-900 dark:text-white'
            )}>
              {toast.type === 'task' ? '⚡ Follow-up Task Created' : toast.type === 'error' ? 'Error' : 'Done'}
            </p>
            <p className={cn(
              'text-xs mt-0.5 leading-relaxed',
              toast.type === 'error' ? 'text-red-600 dark:text-red-400'
                : toast.type === 'task' ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-slate-500 dark:text-slate-400'
            )}>
              {toast.message}
            </p>
          </div>
          <button onClick={() => setToast(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Leads</h1>
          <p className="text-slate-500 dark:text-slate-400">Manage your prospective customers</p>
        </div>
        {user?.role === 'admin' && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-md shadow-blue-500/20"
          >
            <Plus className="w-4 h-4" />
            Add Lead
          </button>
        )}
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Search leads..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700 dark:text-slate-300"
          >
            <option value="">All Statuses</option>
            <option value="new">New</option>
            <option value="contacted">Contacted</option>
            <option value="qualified">Qualified</option>
            <option value="won">Won</option>
            <option value="lost">Lost</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-950/50 border-b border-slate-200 dark:border-slate-800 text-sm font-medium text-slate-500 dark:text-slate-400">
                <th className="px-6 py-4">Name</th>
                <th className="px-6 py-4">Company</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Score</th>
                <th className="px-6 py-4">Source</th>
                <th className="px-6 py-4">Assigned To</th>
                <th className="px-6 py-4">Follow-up</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-slate-500">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                      Loading leads...
                    </div>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan="7" className="px-6 py-8 text-center text-red-500">Failed to load leads. Please try again.</td>
                </tr>
              ) : filteredLeads.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-slate-500">
                    {searchText ? 'No leads match your search.' : 'No leads found. Add your first lead!'}
                  </td>
                </tr>
              ) : (
                filteredLeads.map((lead) => (
                  <tr key={lead._id} className="border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-900 dark:text-slate-100">{lead.name}</div>
                      <div className="text-sm text-slate-500">{lead.email}</div>
                    </td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{lead.company || '-'}</td>
                    <td className="px-6 py-4">
                      <div className="relative">
                        <button
                          onClick={() => setActiveDropdownId(activeDropdownId === lead._id ? null : lead._id)}
                          className={cn(
                            'px-2.5 py-1.5 rounded-full text-xs font-semibold border cursor-pointer capitalize transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center gap-1.5',
                            getStatusBadge(lead.status)
                          )}
                        >
                          <span>{lead.status}</span>
                          <ChevronDown className="w-3 h-3 opacity-60" />
                        </button>
                        
                        {activeDropdownId === lead._id && (
                          <>
                            {/* Backdrop to close */}
                            <div className="fixed inset-0 z-10" onClick={() => setActiveDropdownId(null)} />
                            
                            {/* Dropdown Menu Overlay */}
                            <div className="absolute left-0 bottom-full mb-1 w-36 rounded-lg shadow-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 py-1 z-20">
                              {['new', 'contacted', 'qualified', 'won', 'lost'].map((statusOption) => (
                                <button
                                  key={statusOption}
                                  type="button"
                                  onClick={() => {
                                    updateLeadStatusMutation.mutate({ id: lead._id, status: statusOption });
                                    setActiveDropdownId(null);
                                  }}
                                  className={cn(
                                    'w-full text-left px-3 py-1.5 text-xs font-semibold capitalize transition-colors flex items-center gap-2',
                                    lead.status === statusOption
                                      ? 'bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400'
                                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900/60'
                                  )}
                                >
                                  <span className={cn('w-1.5 h-1.5 rounded-full',
                                    statusOption === 'new'       ? 'bg-emerald-500' :
                                    statusOption === 'contacted' ? 'bg-blue-500' :
                                    statusOption === 'qualified' ? 'bg-purple-500' :
                                    statusOption === 'won'       ? 'bg-teal-400' :
                                    'bg-slate-400'
                                  )} />
                                  {statusOption}
                                </button>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn('px-2.5 py-1 rounded-full text-xs font-semibold border', getScoreBadge(lead.score))}>
                        {lead.score}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-300 capitalize">{lead.source}</td>
                    <td className="px-6 py-4">
                      {/* Admins get an inline dropdown to reassign */}
                      {user?.role === 'admin' ? (
                        assigningLead === lead._id ? (
                          <div className="flex items-center gap-2">
                            <select
                              defaultValue={lead.assignedTo?._id || ''}
                              onChange={(e) => reassignMutation.mutate({ id: lead._id, assignedTo: e.target.value })}
                              className="text-sm px-2 py-1 border border-blue-400 rounded-md bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              <option value="">Unassigned</option>
                              {reps.map((rep) => (
                                <option key={rep._id} value={rep._id}>{rep.name}</option>
                              ))}
                            </select>
                            <button
                              onClick={() => setAssigningLead(null)}
                              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setAssigningLead(lead._id)}
                            className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 group"
                          >
                            <UserCheck className="w-4 h-4 opacity-40 group-hover:opacity-100 transition-opacity" />
                            <span>{lead.assignedTo?.name || <span className="text-slate-400 italic">Unassigned</span>}</span>
                          </button>
                        )
                      ) : (
                        <span className="text-slate-600 dark:text-slate-300">
                          {lead.assignedTo?.name || <span className="text-slate-400 italic">Unassigned</span>}
                        </span>
                      )}
                    </td>

                    {/* Follow-up task indicator */}
                    <td className="px-6 py-4">
                      {(() => {
                        const leadTasks = tasksByLead[lead._id?.toString()] || [];
                        if (leadTasks.length === 0) {
                          return (
                            <span className="text-xs text-slate-400 dark:text-slate-600 italic">None</span>
                          );
                        }
                        const overdue = leadTasks.some(t => new Date(t.dueDate) < new Date());
                        return (
                          <span className={cn(
                            'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border',
                            overdue
                              ? 'bg-red-100 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-900/50'
                              : 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900/50'
                          )}>
                            <span className={cn('w-1.5 h-1.5 rounded-full', overdue ? 'bg-red-500' : 'bg-amber-500')} />
                            {overdue ? 'Overdue' : `${leadTasks.length} pending`}
                          </span>
                        );
                      })()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <CreateLeadModal
          reps={reps}
          isAdmin={user?.role === 'admin'}
          onClose={() => setIsModalOpen(false)}
          onSubmit={(data) => createMutation.mutate(data)}
          isSubmitting={createMutation.isPending}
          error={createError}
        />
      )}
    </div>
  );
}

function CreateLeadModal({ onClose, onSubmit, isSubmitting, error, reps, isAdmin }) {
  const { register, handleSubmit, formState: { errors } } = useForm();

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Add New Lead</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Name *</label>
            <input
              {...register('name', { required: 'Name is required' })}
              placeholder="Rahul Sharma"
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
            />
            {errors.name && <p className="mt-1 text-sm text-red-500">{errors.name.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Email *</label>
            <input
              type="email"
              {...register('email', { required: 'Email is required' })}
              placeholder="rahul@example.com"
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
            />
            {errors.email && <p className="mt-1 text-sm text-red-500">{errors.email.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Phone</label>
            <input
              {...register('phone', {
                pattern: {
                  value: /^[\+\-\s\(\)\d]{7,20}$/,
                  message: 'Only digits, spaces, +, -, and () allowed',
                },
              })}
              type="tel"
              placeholder="+91 99999 99999"
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
            />
            {errors.phone && <p className="mt-1 text-sm text-red-500">{errors.phone.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Company</label>
            <input
              {...register('company')}
              placeholder="Acme Corp"
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Source</label>
            <select
              {...register('source')}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="web">Website</option>
              <option value="linkedin">LinkedIn</option>
              <option value="google_ads">Google Ads</option>
              <option value="chat">Chat</option>
              <option value="email">Email</option>
              <option value="manual">Manual Entry</option>
            </select>
          </div>

          {/* Rep assignment — only visible for admin and when reps exist */}
          {isAdmin && (
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Assign To Rep
              </label>
              <select
                {...register('assignedTo')}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="">Auto-assign (random)</option>
                {reps.map((rep) => (
                  <option key={rep._id} value={rep._id}>
                    {rep.name} — {rep.email}
                  </option>
                ))}
              </select>
              {reps.length === 0 && (
                <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                  No approved reps yet. Add reps in the Sales Team section first.
                </p>
              )}
            </div>
          )}

          <div className="pt-4 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 px-4 rounded-lg border border-slate-300 dark:border-slate-700 font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-slate-700 dark:text-slate-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-2 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors disabled:opacity-70"
            >
              {isSubmitting ? 'Creating...' : 'Create Lead'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
