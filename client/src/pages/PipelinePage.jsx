import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/axios';
import { DndContext, closestCenter } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useDroppable } from '@dnd-kit/core';
import { 
  Bell, CheckCircle, AlertCircle, X, Send, Mail, RefreshCw,
  Clock, User, Flame, AlertTriangle, FileText, ExternalLink, RotateCcw,
} from 'lucide-react';

const SlackIcon = (props) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52-2.523 2.528 2.528 0 0 1-2.522-2.523 2.528 2.528 0 0 1 2.522-2.52h2.52v2.52zm1.261 0a2.528 2.528 0 0 1 2.52-2.52h5.043a2.528 2.528 0 0 1 2.522 2.52v5.042a2.528 2.528 0 0 1-2.522 2.52H8.823a2.528 2.528 0 0 1-2.52-2.52v-5.042zM8.823 5.043a2.528 2.528 0 0 1-2.52-2.52A2.528 2.528 0 0 1 8.823 0a2.528 2.528 0 0 1 2.52 2.522v2.52h-2.52zm0 1.261a2.528 2.528 0 0 1 2.52 2.52v5.043a2.528 2.528 0 0 1-2.52 2.522H3.78a2.528 2.528 0 0 1-2.522-2.522V8.824a2.528 2.528 0 0 1 2.522-2.52h5.043zm10.135 3.78a2.528 2.528 0 0 1 2.522-2.52 2.528 2.528 0 0 1 2.52 2.52 2.528 2.528 0 0 1-2.52 2.52h-2.522v-2.52zm-1.262 0a2.528 2.528 0 0 1-2.52 2.52h-5.043a2.528 2.528 0 0 1-2.522-2.52V5.043a2.528 2.528 0 0 1 2.522-2.52h5.043a2.528 2.528 0 0 1 2.52 2.52v5.043zm-3.78 10.135a2.528 2.528 0 0 1 2.52 2.522a2.528 2.528 0 0 1-2.52 2.522 2.528 2.528 0 0 1-2.522-2.522v-2.52h2.522zm0-1.262a2.528 2.528 0 0 1-2.52-2.52v-5.043a2.528 2.528 0 0 1 2.522-2.52h5.043a2.528 2.528 0 0 1 2.522 2.52v5.043a2.528 2.528 0 0 1-2.522 2.52h-5.043z" />
  </svg>
);

const COLUMNS = [
  { id: 'prospect', title: 'Prospect' },
  { id: 'proposal', title: 'Proposal' },
  { id: 'negotiation', title: 'Negotiation' },
  { id: 'closed-won', title: 'Closed Won' },
  { id: 'closed-lost', title: 'Closed Lost' },
];

export default function PipelinePage() {
  const queryClient = useQueryClient();
  const [toasts, setToasts] = useState([]);
  const [isAddDealOpen, setIsAddDealOpen] = useState(false);

  // Toast helper
  const addToast = (title, message, type = 'success') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, title, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5500);
  };

  const removeToast = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Fetch deals
  const { data: deals, isLoading } = useQuery({
    queryKey: ['deals'],
    queryFn: async () => {
      const res = await api.get('/deals');
      return res.data;
    },
  });

  // Fetch stale deals for sidebar summary
  const { data: staleDeals = [], refetch: refetchStale } = useQuery({
    queryKey: ['deals-stale'],
    queryFn: async () => {
      const res = await api.get('/deals/stale');
      return res.data;
    },
  });

  // Re-engage a single stale deal manually
  const reEngageMutation = useMutation({
    mutationFn: async (dealId) => {
      const res = await api.post(`/deals/${dealId}/re-engage`);
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      queryClient.invalidateQueries({ queryKey: ['deals-stale'] });
      addToast('Re-engagement Triggered', data.message, 'success');
    },
    onError: (err) => {
      addToast('Re-engagement Failed', err.response?.data?.message || err.message, 'error');
    },
  });

  // Resend proposal
  const resendProposalMutation = useMutation({
    mutationFn: async (dealId) => {
      const res = await api.post(`/deals/${dealId}/proposal/resend`);
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      addToast('Proposal Resent', data.message, 'success');
    },
    onError: (err) => {
      addToast('Resend Failed', err.response?.data?.message || err.message, 'error');
    },
  });

  // Fetch stage change alerts activity logs
  const { data: activities, isLoading: isActivitiesLoading, refetch: refetchActivities } = useQuery({
    queryKey: ['activities', 'stage_change'],
    queryFn: async () => {
      const res = await api.get('/activities?type=stage_change');
      return res.data;
    },
  });

  // Fetch contacts for "Add Deal" dropdown — use leads so all 19 show up
  const { data: allLeads = [] } = useQuery({
    queryKey: ['leads', ''],
    queryFn: () => api.get('/leads').then(r => r.data),
  });

  // Create deal mutation
  const createDealMutation = useMutation({
    mutationFn: (data) => api.post('/deals', data).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      setIsAddDealOpen(false);
      addToast('Deal Created', 'New deal added to the pipeline.', 'success');
    },
    onError: (err) => addToast('Create Failed', err.response?.data?.message || err.message, 'error'),
  });

  // Update deal stage
  const updateDealStage = useMutation({
    mutationFn: async ({ id, stage }) => {
      const res = await api.put(`/deals/${id}`, { stage });
      return res.data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      queryClient.invalidateQueries({ queryKey: ['activities', 'stage_change'] });
      
      const oldStageLabel = COLUMNS.find(c => c.id === variables.oldStage)?.title || variables.oldStage;
      const newStageLabel = COLUMNS.find(c => c.id === variables.stage)?.title || variables.stage;
      
      addToast(
        'Deal Stage Progression Alert Triggered',
        `"${data.title}" moved ${oldStageLabel} → ${newStageLabel}. Slack & email alerts dispatched to managers.`,
        'success'
      );
    },
    onError: (error) => {
      addToast(
        'Failed to Update Deal Stage',
        error.response?.data?.message || error.message || 'An error occurred',
        'error'
      );
    }
  });

  const dealsByStage = useMemo(() => {
    if (!deals) return {};
    return deals.reduce((acc, deal) => {
      if (!acc[deal.stage]) acc[deal.stage] = [];
      acc[deal.stage].push(deal);
      return acc;
    }, {});
  }, [deals]);

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over) return;

    const dealId = active.id;
    const newStage = over.id.split('-column')[0];
    const currentDeal = deals.find(d => d._id === dealId);

    if (currentDeal && currentDeal.stage !== newStage && COLUMNS.some(c => c.id === newStage)) {
      updateDealStage.mutate({ 
        id: dealId, 
        stage: newStage, 
        oldStage: currentDeal.stage 
      });
    }
  };

  if (isLoading) {
    return <div className="p-8 text-slate-500">Loading pipeline...</div>;
  }

  return (
    <div className="h-full flex flex-col relative">
      {/* Toast Notification Container */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-md w-full">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`p-4 rounded-xl border shadow-lg flex gap-3 items-start transition-all transform translate-y-0 duration-300 ${
              toast.type === 'error'
                ? 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900/60 text-red-900 dark:text-red-200'
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white'
            }`}
          >
            {toast.type === 'error' ? (
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            ) : (
              <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
            )}
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-sm">{toast.title}</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                {toast.message}
              </p>
              {toast.type !== 'error' && (
                <div className="flex gap-2 mt-2">
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded border border-emerald-200/50 dark:border-emerald-800/50">
                    <SlackIcon className="w-2.5 h-2.5" /> Slack Sent
                  </span>
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded border border-blue-200/50 dark:border-blue-800/50">
                    <Mail className="w-2.5 h-2.5" /> Email Sent
                  </span>
                </div>
              )}
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Pipeline</h1>
          <p className="text-slate-500 dark:text-slate-400">Track and manage your deals</p>
        </div>
        <button
          onClick={() => setIsAddDealOpen(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-md shadow-blue-500/20 text-sm"
        >
          <span className="text-lg leading-none">+</span>
          Add Deal
        </button>
      </div>

      {/* Main Workspace Layout */}
      <div className="flex gap-6 flex-1 overflow-hidden">
        {/* Kanban Board Container */}
        <div className="flex-1 overflow-x-auto pb-4">
          <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <div className="flex gap-6 h-full min-h-[500px]">
              {COLUMNS.map((column) => (
                <KanbanColumn
                  key={column.id}
                  column={column}
                  deals={dealsByStage[column.id] || []}
                  onReEngage={(id) => reEngageMutation.mutate(id)}
                  reEngaging={reEngageMutation.isPending}
                  onResendProposal={(id) => resendProposalMutation.mutate(id)}
                  resendingProposal={resendProposalMutation.isPending}
                />
              ))}
            </div>
          </DndContext>
        </div>

        {/* Real-time Alerts & Workflow Sidebar */}
        <div className="w-80 shrink-0 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col h-[calc(100vh-12rem)] shadow-sm overflow-y-auto">

          {/* Stale Deals Summary */}
          {staleDeals.length > 0 && (
            <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-xl">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                <span className="text-xs font-bold text-amber-700 dark:text-amber-400">
                  {staleDeals.length} Stale Deal{staleDeals.length > 1 ? 's' : ''} — No activity 14+ days
                </span>
              </div>
              <div className="space-y-1.5">
                {staleDeals.slice(0, 3).map((deal) => (
                  <div key={deal._id} className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="text-amber-800 dark:text-amber-300 truncate font-medium">{deal.title}</span>
                    <button
                      onClick={() => reEngageMutation.mutate(deal._id)}
                      disabled={reEngageMutation.isPending}
                      className="shrink-0 px-2 py-0.5 bg-amber-500 hover:bg-amber-600 text-white rounded text-[10px] font-bold transition-colors disabled:opacity-50"
                    >
                      Re-engage
                    </button>
                  </div>
                ))}
                {staleDeals.length > 3 && (
                  <p className="text-[10px] text-amber-600 dark:text-amber-500">+{staleDeals.length - 3} more stale deals</p>
                )}
              </div>
            </div>
          )}

          <div className="flex justify-between items-center pb-3 border-b border-slate-200 dark:border-slate-800 mb-4">
            <div className="flex items-center gap-2">
              <Bell className="w-4.5 h-4.5 text-blue-600 dark:text-blue-400 animate-pulse" />
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                Progression Alerts Log
              </h3>
            </div>
            <button
              onClick={() => { refetchActivities(); refetchStale(); }}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 hover:bg-slate-100 dark:hover:bg-slate-900 rounded"
              title="Refresh log"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {/* Activity Alerts Stream */}
          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {isActivitiesLoading ? (
              <div className="text-center text-xs text-slate-400 py-8">Loading alert logs...</div>
            ) : !activities || activities.length === 0 ? (
              <div className="text-center text-xs text-slate-400 py-8">
                No recent stage progression alerts. Move a deal card to trigger one!
              </div>
            ) : (
              activities.map((act) => (
                <div
                  key={act._id}
                  className="p-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-900 rounded-lg hover:border-slate-200 dark:hover:border-slate-800 transition-colors"
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-semibold text-xs text-slate-900 dark:text-white truncate max-w-[130px]">
                      {act.relatedTo?.title || 'Unknown Deal'}
                    </span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(act.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-600 dark:text-slate-400 font-medium bg-white dark:bg-slate-950 px-2 py-1 rounded border border-slate-200/40 dark:border-slate-800/40 my-2 text-center">
                    {act.outcome}
                  </div>

                  <div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-200/50 dark:border-slate-800/50">
                    <div className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400">
                      <User className="w-3 h-3" />
                      <span className="truncate max-w-[80px]">
                        {act.performedBy?.name || 'System'}
                      </span>
                    </div>

                    <div className="flex gap-1.5">
                      <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/40" title="Slack Alert Sent">
                        <SlackIcon className="w-3 h-3" />
                      </span>
                      <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/40" title="Email Alert Sent">
                        <Mail className="w-3 h-3" />
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Add Deal Modal */}
      {isAddDealOpen && (
        <AddDealModal
          leads={allLeads}
          onClose={() => setIsAddDealOpen(false)}
          onSubmit={(data) => createDealMutation.mutate(data)}
          isSubmitting={createDealMutation.isPending}
        />
      )}
    </div>
  );
}

function AddDealModal({ leads, onClose, onSubmit, isSubmitting }) {
  const [form, setForm] = React.useState({ title: '', value: '', leadId: '', stage: 'prospect' });
  const [error, setError] = React.useState('');

  const handle = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const submit = (e) => {
    e.preventDefault();
    if (!form.title.trim()) return setError('Title is required');
    if (!form.leadId) return setError('Please select a contact');
    if (!form.value || isNaN(form.value) || Number(form.value) <= 0) return setError('Enter a valid deal value');
    setError('');
    onSubmit({ title: form.title, value: Number(form.value), leadId: form.leadId, stage: form.stage });
  };

  const inputCls = 'w-full px-3 py-2.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none text-sm transition-all';

  // Group leads by status for better UX
  const STATUS_ORDER = ['won', 'qualified', 'contacted', 'new', 'lost'];
  const grouped = STATUS_ORDER.reduce((acc, s) => {
    const group = leads.filter(l => l.status === s);
    if (group.length) acc[s] = group;
    return acc;
  }, {});

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-slate-800">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">Add New Deal</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
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
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Deal Title *</label>
            <input name="title" value={form.title} onChange={handle} placeholder="e.g. Acme Corp Enterprise Plan" className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Contact * <span className="text-slate-400 font-normal">({leads.length} leads available)</span>
            </label>
            <select name="leadId" value={form.leadId} onChange={handle} className={inputCls}>
              <option value="">Select a contact…</option>
              {Object.entries(grouped).map(([status, group]) => (
                <optgroup key={status} label={status.charAt(0).toUpperCase() + status.slice(1)}>
                  {group.map(l => (
                    <option key={l._id} value={l._id}>
                      {l.name}{l.company ? ` — ${l.company}` : ''} {l.email ? `<${l.email}>` : ''}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            {leads.length === 0 && (
              <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">No leads yet. Add leads first.</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Deal Value ($) *</label>
            <input name="value" type="number" min="1" value={form.value} onChange={handle} placeholder="50000" className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Starting Stage</label>
            <select name="stage" value={form.stage} onChange={handle} className={inputCls}>
              <option value="prospect">Prospect</option>
              <option value="proposal">Proposal</option>
              <option value="negotiation">Negotiation</option>
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 px-4 rounded-lg border border-slate-200 dark:border-slate-700 font-medium text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-slate-700 dark:text-slate-300">
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting} className="flex-1 py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm transition-colors disabled:opacity-70">
              {isSubmitting ? 'Creating…' : 'Create Deal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function KanbanColumn({ column, deals, onReEngage, reEngaging, onResendProposal, resendingProposal }) {
  const { setNodeRef } = useDroppable({ id: `${column.id}-column` });

  const totalValue  = deals.reduce((sum, d) => sum + d.value, 0);
  const staleCount  = deals.filter(d => d.isStale).length;
  const sentCount   = column.id === 'proposal'
    ? deals.filter(d => d.proposalStatus && d.proposalStatus !== 'none').length
    : 0;

  return (
    <div className="flex flex-col w-72 shrink-0 bg-slate-50/50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800">
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-white/50 dark:bg-slate-950/50 rounded-t-xl">
        <div className="flex items-center gap-2 min-w-0">
          <h3 className="font-semibold text-slate-700 dark:text-slate-200 text-sm truncate">{column.title}</h3>
          {staleCount > 0 && (
            <span className="text-[10px] font-bold bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50 px-1.5 py-0.5 rounded-full shrink-0">
              {staleCount} stale
            </span>
          )}
          {sentCount > 0 && (
            <span className="text-[10px] font-bold bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800/50 px-1.5 py-0.5 rounded-full shrink-0 flex items-center gap-0.5">
              <FileText className="w-2.5 h-2.5" />{sentCount} sent
            </span>
          )}
        </div>
        <span className="text-xs font-semibold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full shrink-0 ml-2">
          ${totalValue.toLocaleString()}
        </span>
      </div>
      <div ref={setNodeRef} className="flex-1 p-3 flex flex-col gap-3 min-h-[300px]">
        <SortableContext items={deals.map(d => d._id)} strategy={verticalListSortingStrategy}>
          {deals.map((deal) => (
            <DealCard
              key={deal._id}
              deal={deal}
              onReEngage={onReEngage}
              reEngaging={reEngaging}
              onResendProposal={onResendProposal}
              resendingProposal={resendingProposal}
            />
          ))}
        </SortableContext>
      </div>
    </div>
  );
}

function DealCard({ deal, onReEngage, reEngaging, onResendProposal, resendingProposal }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: deal._id });

  const style = { transform: CSS.Transform.toString(transform), transition };

  const daysSinceActivity = Math.floor(
    (Date.now() - new Date(deal.lastActivityAt)) / 86400000
  );

  // Proposal status config
  const proposalConfig = {
    none:       null,
    generating: { label: 'Generating…', color: 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700' },
    sent:       { label: 'Proposal Sent', color: 'bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/50' },
    viewed:     { label: 'Proposal Viewed', color: 'bg-purple-100 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800/50' },
    signed:     { label: 'Signed', color: 'bg-teal-100 dark:bg-teal-950/50 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800/50' },
    declined:   { label: 'Declined', color: 'bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800/50' },
  };

  const proposal = proposalConfig[deal.proposalStatus || 'none'];
  const isProposalStage = deal.stage === 'proposal';

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`bg-white dark:bg-slate-950 p-4 rounded-lg shadow-sm border cursor-grab active:cursor-grabbing transition-colors ${
        deal.isStale
          ? 'border-amber-300 dark:border-amber-700/60 hover:border-amber-400 dark:hover:border-amber-600'
          : isProposalStage
            ? 'border-blue-200 dark:border-blue-800/60 hover:border-blue-400 dark:hover:border-blue-600'
            : 'border-slate-200 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-700'
      }`}
    >
      {/* Stale banner */}
      {deal.isStale && (
        <div className="flex items-center gap-1.5 mb-2 px-2 py-1 bg-amber-50 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-800/40 rounded-md">
          <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0" />
          <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400">
            Stale · {daysSinceActivity}d no activity
          </span>
        </div>
      )}

      {/* Proposal status banner */}
      {isProposalStage && proposal && (
        <div className={`flex items-center gap-1.5 mb-2 px-2 py-1 rounded-md border text-[10px] font-bold ${proposal.color}`}>
          <FileText className="w-3 h-3 shrink-0" />
          {proposal.label}
          {deal.proposalSentAt && (
            <span className="ml-auto opacity-60 font-normal">
              {new Date(deal.proposalSentAt).toLocaleDateString()}
            </span>
          )}
        </div>
      )}

      <div className="font-semibold text-slate-900 dark:text-slate-100 text-sm mb-0.5 leading-snug">
        {deal.title}
      </div>
      <div className="text-xs text-slate-500 dark:text-slate-400 mb-3">
        {deal.contact?.name || 'Unknown Contact'}
      </div>

      <div className="flex justify-between items-center pt-2 border-t border-slate-100 dark:border-slate-800 gap-2">
        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 shrink-0">
          ${deal.value.toLocaleString()}
        </span>

        <div className="flex items-center gap-1.5">
          {/* View proposal PDF — use api with auth token */}
          {isProposalStage && (
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={async (e) => {
                e.stopPropagation();
                try {
                  const res = await api.get(`/deals/${deal._id}/proposal`, { responseType: 'blob' });
                  const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
                  window.open(url, '_blank');
                  setTimeout(() => URL.revokeObjectURL(url), 10000);
                } catch {
                  alert('Could not load proposal PDF');
                }
              }}
              className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors border border-slate-200 dark:border-slate-700"
              title="View / Download Proposal PDF"
            >
              <ExternalLink className="w-2.5 h-2.5" />
              View
            </button>
          )}

          {/* Resend proposal */}
          {isProposalStage && deal.proposalStatus !== 'none' && deal.proposalStatus !== 'generating' && (
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); onResendProposal(deal._id); }}
              disabled={resendingProposal}
              className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 hover:bg-blue-200 dark:bg-blue-950/50 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 transition-colors border border-blue-200 dark:border-blue-800/50 disabled:opacity-50"
              title="Resend Proposal"
            >
              <RotateCcw className="w-2.5 h-2.5" />
              Resend
            </button>
          )}

          {/* Re-engage stale */}
          {deal.isStale && (
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); onReEngage(deal._id); }}
              disabled={reEngaging}
              className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500 hover:bg-amber-600 text-white transition-colors disabled:opacity-50"
            >
              <Flame className="w-2.5 h-2.5" />
              Re-engage
            </button>
          )}

          {/* Default — days since activity */}
          {!deal.isStale && !isProposalStage && (
            <span className="text-[10px] text-slate-400 dark:text-slate-600">
              {daysSinceActivity}d ago
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
