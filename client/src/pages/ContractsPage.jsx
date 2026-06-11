import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/axios';
import { Plus, X, FileText, Clock, CheckCircle, AlertTriangle, RefreshCw, Trash2 } from 'lucide-react';
import { cn } from '../lib/utils';
import useAuthStore from '../store/authStore';

const STATUS_CONFIG = {
  active:  { label: 'Active',   color: 'bg-teal-100 text-teal-700 dark:bg-teal-950/50 dark:text-teal-300' },
  renewed: { label: 'Renewed',  color: 'bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300' },
  churned: { label: 'Churned',  color: 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300' },
  expired: { label: 'Expired',  color: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400' },
};

function daysUntil(date) {
  return Math.ceil((new Date(date) - Date.now()) / 86400000);
}

function urgencyBadge(days) {
  if (days < 0)  return 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400';
  if (days <= 30) return 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400';
  if (days <= 60) return 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400';
  if (days <= 90) return 'bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400';
  return 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400';
}

export default function ContractsPage() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const { data: contracts = [], isLoading } = useQuery({
    queryKey: ['contracts'],
    queryFn: () => api.get('/contracts').then(r => r.data),
  });

  const { data: deals = [] } = useQuery({
    queryKey: ['deals'],
    queryFn: () => api.get('/deals').then(r => r.data),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/contracts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      showToast('Contract removed');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => api.put(`/contracts/${id}`, data).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      showToast('Contract updated');
    },
  });

  const triggerRemindersMutation = useMutation({
    mutationFn: () => api.post('/contracts/trigger-reminders').then(r => r.data),
    onSuccess: (data) => {
      showToast(`Reminders triggered — ${data.results.processed} sent, ${data.results.skipped} skipped`);
    },
    onError: (err) => showToast(err.response?.data?.message || 'Failed', 'error'),
  });

  // Stats
  const active  = contracts.filter(c => c.status === 'active');
  const expiring30  = active.filter(c => daysUntil(c.endDate) <= 30  && daysUntil(c.endDate) >= 0);
  const expiring60  = active.filter(c => daysUntil(c.endDate) <= 60  && daysUntil(c.endDate) > 30);
  const expiring90  = active.filter(c => daysUntil(c.endDate) <= 90  && daysUntil(c.endDate) > 60);

  return (
    <div className="space-y-6 pb-8">
      {/* Toast */}
      {toast && (
        <div className={cn(
          'fixed top-4 right-4 z-50 px-4 py-3 rounded-xl border shadow-xl text-sm font-medium flex items-center gap-2',
          toast.type === 'error'
            ? 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300'
            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white'
        )}>
          {toast.type === 'error' ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4 text-teal-500" />}
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Contracts</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">
            Track renewals and prevent churn with automated reminders
          </p>
        </div>
        <div className="flex gap-2">
          {user?.role === 'admin' && (
            <button
              onClick={() => triggerRemindersMutation.mutate()}
              disabled={triggerRemindersMutation.isPending}
              className="flex items-center gap-2 px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
              title="Manually trigger renewal reminders"
            >
              <RefreshCw className={cn('w-4 h-4', triggerRemindersMutation.isPending && 'animate-spin')} />
              Send Reminders
            </button>
          )}
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm transition-colors shadow-md shadow-blue-500/20"
          >
            <Plus className="w-4 h-4" />
            Add Contract
          </button>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Active Contracts', value: active.length, icon: FileText, color: 'text-teal-600 dark:text-teal-400', bg: 'bg-teal-50 dark:bg-teal-950/40' },
          { label: 'Expiring in 30d', value: expiring30.length, icon: AlertTriangle, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-950/40' },
          { label: 'Expiring in 60d', value: expiring60.length, icon: Clock, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/40' },
          { label: 'Expiring in 90d', value: expiring90.length, icon: Clock, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-950/40' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 flex items-center gap-4">
            <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', bg)}>
              <Icon className={cn('w-5 h-5', color)} />
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">{label}</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white leading-none">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Contracts table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-950/50 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              <th className="px-6 py-4">Contract</th>
              <th className="px-6 py-4">Client</th>
              <th className="px-6 py-4">Deal</th>
              <th className="px-6 py-4">Value</th>
              <th className="px-6 py-4">End Date</th>
              <th className="px-6 py-4">Days Left</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4">Reminders</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan="9" className="px-6 py-12 text-center text-slate-400 text-sm">
                <div className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  Loading contracts…
                </div>
              </td></tr>
            ) : contracts.length === 0 ? (
              <tr><td colSpan="9" className="px-6 py-12 text-center text-slate-400 text-sm">
                No contracts yet. Add one to start tracking renewals.
              </td></tr>
            ) : contracts.map((contract) => {
              const days = daysUntil(contract.endDate);
              const cfg  = STATUS_CONFIG[contract.status] || STATUS_CONFIG.active;
              return (
                <tr key={contract._id} className="border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                      <span className="font-medium text-slate-900 dark:text-slate-100 text-sm">{contract.title}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">
                    {contract.contact?.name || '—'}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">
                    {contract.deal?.title || '—'}
                  </td>
                  <td className="px-6 py-4 text-sm font-semibold text-slate-700 dark:text-slate-300">
                    ${(contract.value || 0).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">
                    {new Date(contract.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold', urgencyBadge(days))}>
                      {days < 0 ? 'Expired' : `${days}d`}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <select
                      value={contract.status}
                      onChange={(e) => updateMutation.mutate({ id: contract._id, data: { status: e.target.value } })}
                      className={cn(
                        'text-xs font-semibold px-2 py-1 rounded-full border-0 outline-none cursor-pointer',
                        cfg.color
                      )}
                    >
                      {Object.entries(STATUS_CONFIG).map(([val, { label }]) => (
                        <option key={val} value={val}>{label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-1">
                      {[90, 60, 30].map(d => (
                        <span
                          key={d}
                          title={`${d}-day reminder ${contract.remindersSent?.includes(d) ? 'sent' : 'pending'}`}
                          className={cn(
                            'inline-flex items-center justify-center w-7 h-5 rounded text-[10px] font-bold',
                            contract.remindersSent?.includes(d)
                              ? 'bg-teal-100 text-teal-700 dark:bg-teal-950/50 dark:text-teal-400'
                              : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500'
                          )}
                        >
                          {d}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => {
                        if (confirm(`Remove contract "${contract.title}"?`)) {
                          deleteMutation.mutate(contract._id);
                        }
                      }}
                      className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <AddContractModal
          deals={deals}
          onClose={() => setIsModalOpen(false)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['contracts'] });
            setIsModalOpen(false);
            showToast('Contract created');
          }}
        />
      )}
    </div>
  );
}

function AddContractModal({ deals, onClose, onSuccess }) {
  const [form, setForm] = useState({
    deal: '', title: '', startDate: new Date().toISOString().split('T')[0],
    endDate: '', value: '', notes: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handle = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  // Auto-fill title and value when deal is selected
  const onDealChange = (e) => {
    const deal = deals.find(d => d._id === e.target.value);
    setForm(f => ({
      ...f,
      deal: e.target.value,
      title: deal ? `${deal.title} — Contract` : f.title,
      value: deal ? deal.value : f.value,
    }));
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.deal)    return setError('Select a deal');
    if (!form.endDate) return setError('End date is required');
    setError('');
    setLoading(true);
    try {
      await api.post('/contracts', {
        ...form,
        value: Number(form.value) || 0,
      });
      onSuccess();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create contract');
    } finally { setLoading(false); }
  };

  const inputCls = 'w-full px-3 py-2.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none text-sm';

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 dark:border-slate-800">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
          <h3 className="font-semibold text-slate-900 dark:text-white">Add Contract</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Deal *</label>
            <select name="deal" value={form.deal} onChange={onDealChange} className={inputCls}>
              <option value="">Select a deal…</option>
              {deals.map(d => (
                <option key={d._id} value={d._id}>{d.title} — ${d.value?.toLocaleString()}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Contract Title</label>
            <input name="title" value={form.title} onChange={handle} placeholder="e.g. Acme Corp — Annual SaaS License" className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Start Date</label>
              <input type="date" name="startDate" value={form.startDate} onChange={handle} className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">End Date *</label>
              <input type="date" name="endDate" value={form.endDate} onChange={handle} className={inputCls} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Contract Value ($)</label>
            <input type="number" name="value" value={form.value} onChange={handle} placeholder="50000" className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Notes</label>
            <textarea name="notes" value={form.notes} onChange={handle} rows={2} placeholder="Any relevant notes…" className={inputCls + ' resize-none'} />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 px-4 rounded-lg border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="flex-1 py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors disabled:opacity-70">
              {loading ? 'Creating…' : 'Create Contract'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
