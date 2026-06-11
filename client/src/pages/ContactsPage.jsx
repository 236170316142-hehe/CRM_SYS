import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/axios';
import { Mail, Phone, Building2, X, Search, Ticket, Plus, ExternalLink, AlertTriangle } from 'lucide-react';
import { cn } from '../lib/utils';

const TICKET_PRIORITY = {
  low:    { label: 'Low',    color: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400' },
  normal: { label: 'Normal', color: 'bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300' },
  high:   { label: 'High',   color: 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400' },
  urgent: { label: 'Urgent', color: 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400' },
};
const TICKET_STATUS = {
  open:    'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400',
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400',
  solved:  'bg-teal-100 text-teal-700 dark:bg-teal-950/50 dark:text-teal-300',
  closed:  'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
};

const STATUS_BADGE = {
  new:       'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
  contacted: 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300',
  qualified: 'bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300',
  won:       'bg-teal-100 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300',
  lost:      'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
};

const SOURCE_LABEL = {
  web: 'Web', linkedin: 'LinkedIn', chat: 'Chat', email: 'Email',
};

const AVATAR_COLORS = [
  'from-blue-500 to-indigo-500',
  'from-purple-500 to-pink-500',
  'from-teal-500 to-cyan-500',
  'from-amber-500 to-orange-500',
  'from-emerald-500 to-green-500',
  'from-rose-500 to-red-500',
];

function avatarColor(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export default function ContactsPage() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [addTicketFor, setAddTicketFor] = useState(null); // contactId for new ticket modal

  // Pull ALL leads as contacts
  const { data: leads = [], isLoading } = useQuery({
    queryKey: ['leads', ''],
    queryFn: () => api.get('/leads').then(r => r.data),
  });

  // Also fetch pipeline-linked contacts for deal history
  const { data: pipelineContacts = [] } = useQuery({
    queryKey: ['contacts'],
    queryFn: () => api.get('/contacts').then(r => r.data),
  });

  // Detail view: if selected is a lead, show lead data + matching pipeline contact deals
  const selectedLead = leads.find(l => l._id === selectedId);
  const matchingContact = useMemo(() => {
    if (!selectedLead) return null;
    return pipelineContacts.find(c =>
      c.email?.toLowerCase() === selectedLead.email?.toLowerCase()
    );
  }, [selectedLead, pipelineContacts]);

  // Fetch deals for the matching pipeline contact if found
  const { data: contactDetail } = useQuery({
    queryKey: ['contact-detail', matchingContact?._id],
    queryFn: () => api.get(`/contacts/${matchingContact._id}`).then(r => r.data),
    enabled: !!matchingContact?._id,
  });

  // Fetch tickets for selected contact
  const { data: tickets = [], refetch: refetchTickets } = useQuery({
    queryKey: ['tickets', matchingContact?._id],
    queryFn: () => api.get(`/tickets?contactId=${matchingContact._id}`).then(r => r.data),
    enabled: !!matchingContact?._id,
  });

  // Update ticket status inline
  const updateTicketMutation = useMutation({
    mutationFn: ({ id, status }) => api.put(`/tickets/${id}`, { status }).then(r => r.data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['tickets'] }); queryClient.invalidateQueries({ queryKey: ['leads'] }); },
  });

  const filtered = useMemo(() => {
    return leads.filter(l => {
      const q = search.toLowerCase();
      const matchSearch = !q ||
        l.name?.toLowerCase().includes(q) ||
        l.email?.toLowerCase().includes(q) ||
        l.company?.toLowerCase().includes(q);
      const matchStatus = !statusFilter || l.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [leads, search, statusFilter]);

  return (
    <div className="flex gap-6 items-start">
      {/* List */}
      <div className={`flex-1 min-w-0 ${selectedId ? 'hidden lg:block' : 'block'}`}>
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Contacts</h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">
              {leads.length} people across all lead stages
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-3 mb-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search name, email, company…"
              className="w-full pl-9 pr-4 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700 dark:text-slate-200"
            />
          </div>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700 dark:text-slate-300"
          >
            <option value="">All Statuses</option>
            <option value="new">New</option>
            <option value="contacted">Contacted</option>
            <option value="qualified">Qualified</option>
            <option value="won">Won</option>
            <option value="lost">Lost</option>
          </select>
        </div>

        {/* Table — grows naturally, outer main scrolls */}
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-950/50 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <th className="px-6 py-3.5">Name</th>
                <th className="px-6 py-3.5">Company</th>
                <th className="px-6 py-3.5">Status</th>
                <th className="px-6 py-3.5">Source</th>
                <th className="px-6 py-3.5">Assigned Rep</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan="5" className="px-6 py-12 text-center text-slate-400 text-sm">
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    Loading contacts…
                  </div>
                </td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan="5" className="px-6 py-12 text-center text-slate-400 text-sm">
                  {search || statusFilter ? 'No contacts match your filters.' : 'No leads yet.'}
                </td></tr>
              ) : filtered.map((lead) => (
                <tr
                  key={lead._id}
                  onClick={() => setSelectedId(lead._id === selectedId ? null : lead._id)}
                  className={cn(
                    'border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/20 cursor-pointer transition-colors',
                    selectedId === lead._id && 'bg-blue-50/50 dark:bg-blue-900/10'
                  )}
                >
                  <td className="px-6 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'w-8 h-8 rounded-full bg-gradient-to-tr flex items-center justify-center text-white text-sm font-bold shrink-0',
                        avatarColor(lead.name)
                      )}>
                        {lead.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-medium text-slate-900 dark:text-slate-100 text-sm">{lead.name}</div>
                        <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                          <Mail className="w-3 h-3" /> {lead.email}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-3.5 text-slate-600 dark:text-slate-300 text-sm">
                    {lead.company ? (
                      <div className="flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        {lead.company}
                      </div>
                    ) : <span className="text-slate-400 italic">—</span>}
                  </td>
                  <td className="px-6 py-3.5">
                    <span className={cn(
                      'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold capitalize',
                      STATUS_BADGE[lead.status] || STATUS_BADGE.new
                    )}>
                      {lead.status}
                    </span>
                  </td>
                  <td className="px-6 py-3.5 text-slate-500 dark:text-slate-400 text-sm capitalize">
                    {SOURCE_LABEL[lead.source] || lead.source || '—'}
                  </td>
                  <td className="px-6 py-3.5 text-slate-600 dark:text-slate-300 text-sm">
                    {lead.assignedTo?.name || <span className="text-slate-400 italic">Unassigned</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail panel */}
      {selectedId && selectedLead && (
        <div className="w-80 shrink-0 bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden sticky top-0 self-start" style={{ maxHeight: 'calc(100vh - 4rem)' }}>
          {/* Header */}
          <div className="p-6 border-b border-slate-200 dark:border-slate-800 relative">
            <button
              onClick={() => setSelectedId(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
            <div className={cn(
              'w-14 h-14 rounded-full bg-gradient-to-tr flex items-center justify-center text-white text-2xl font-bold mb-4 shadow-lg',
              avatarColor(selectedLead.name)
            )}>
              {selectedLead.name.charAt(0).toUpperCase()}
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white pr-6">{selectedLead.name}</h2>
            <div className="flex items-center gap-2 mt-2">
              <span className={cn(
                'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold capitalize',
                STATUS_BADGE[selectedLead.status]
              )}>
                {selectedLead.status}
              </span>
              {selectedLead.score > 0 && (
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Score: <span className="font-semibold text-slate-700 dark:text-slate-300">{selectedLead.score}</span>
                </span>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Contact info */}
            <div>
              <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Contact Info</h3>
              <div className="space-y-2.5">
                <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
                  <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                  <a href={`mailto:${selectedLead.email}`} className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors truncate">
                    {selectedLead.email}
                  </a>
                </div>
                {selectedLead.phone && (
                  <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
                    <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                    <a href={`tel:${selectedLead.phone}`} className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                      {selectedLead.phone}
                    </a>
                  </div>
                )}
                {selectedLead.company && (
                  <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
                    <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
                    {selectedLead.company}
                  </div>
                )}
              </div>
            </div>

            {/* Lead details */}
            <div>
              <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Lead Details</h3>
              <div className="bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-100 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
                {[
                  ['Source', SOURCE_LABEL[selectedLead.source] || selectedLead.source],
                  ['Territory', selectedLead.territory || '—'],
                  ['Assigned Rep', selectedLead.assignedTo?.name || 'Unassigned'],
                  ['Added', new Date(selectedLead.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between items-center px-4 py-2.5 text-sm">
                    <span className="text-slate-500 dark:text-slate-400">{label}</span>
                    <span className="font-medium text-slate-700 dark:text-slate-300 text-right max-w-[160px] truncate">{value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Linked pipeline deals */}
            {contactDetail?.deals?.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                  Pipeline Deals ({contactDetail.deals.length})
                </h3>
                <div className="space-y-2">
                  {contactDetail.deals.map(deal => (
                    <div key={deal._id} className="bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-100 dark:border-slate-800 p-3">
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <span className="text-sm font-medium text-slate-900 dark:text-white leading-snug">{deal.title}</span>
                        <span className={cn(
                          'text-[10px] font-bold px-2 py-0.5 rounded-full capitalize shrink-0',
                          deal.stage === 'closed-won'  ? 'bg-teal-100 text-teal-700 dark:bg-teal-950/50 dark:text-teal-300' :
                          deal.stage === 'closed-lost' ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400' :
                          deal.stage === 'proposal'    ? 'bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300' :
                          deal.stage === 'negotiation' ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300' :
                          'bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300'
                        )}>
                          {deal.stage.replace('-', ' ')}
                        </span>
                      </div>
                      <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                        ${deal.value.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Support Tickets */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Ticket className="w-3.5 h-3.5" />
                  Support Tickets
                  {tickets.length > 0 && (
                    <span className={cn('ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold',
                      tickets.some(t => ['open','pending'].includes(t.status))
                        ? 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400'
                        : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                    )}>
                      {tickets.filter(t => ['open','pending'].includes(t.status)).length} open
                    </span>
                  )}
                </h3>
                {matchingContact && (
                  <button
                    onClick={() => setAddTicketFor(matchingContact._id)}
                    className="flex items-center gap-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                  >
                    <Plus className="w-3 h-3" /> Add
                  </button>
                )}
              </div>
              {tickets.length === 0 ? (
                <p className="text-xs text-slate-400 italic">No tickets. Great sign!</p>
              ) : (
                <div className="space-y-2">
                  {tickets.map(t => (
                    <div key={t._id} className="bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-100 dark:border-slate-800 p-3">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <span className="text-xs font-medium text-slate-900 dark:text-white leading-snug flex-1">{t.subject}</span>
                        {t.externalUrl && (
                          <a href={t.externalUrl} target="_blank" rel="noopener noreferrer" className="shrink-0 text-slate-400 hover:text-blue-500">
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-bold capitalize', TICKET_STATUS[t.status] || TICKET_STATUS.open)}>
                          {t.status}
                        </span>
                        <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-bold capitalize', (TICKET_PRIORITY[t.priority] || TICKET_PRIORITY.normal).color)}>
                          {t.priority}
                        </span>
                        <span className="text-[10px] text-slate-400 capitalize ml-auto">{t.source}</span>
                      </div>
                      {['open','pending'].includes(t.status) && (
                        <button
                          onClick={() => updateTicketMutation.mutate({ id: t._id, status: 'solved' })}
                          className="mt-2 text-[10px] font-semibold text-teal-600 dark:text-teal-400 hover:underline"
                        >
                          Mark Solved
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add Ticket Modal */}
      {addTicketFor && (
        <AddTicketModal
          contactId={addTicketFor}
          onClose={() => setAddTicketFor(null)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['tickets'] });
            queryClient.invalidateQueries({ queryKey: ['leads', ''] });
            setAddTicketFor(null);
          }}
        />
      )}
    </div>
  );
}

function AddTicketModal({ contactId, onClose, onSuccess }) {
  const [form, setForm] = useState({ subject: '', description: '', priority: 'normal' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    if (!form.subject.trim()) return setError('Subject is required');
    setLoading(true);
    try {
      await api.post('/tickets', { contactId, ...form });
      onSuccess();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create ticket');
    } finally { setLoading(false); }
  };

  const inputCls = 'w-full px-3 py-2.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none text-sm';

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-sm border border-slate-200 dark:border-slate-800">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
          <h3 className="font-semibold text-slate-900 dark:text-white text-sm">Add Support Ticket</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-3">
          {error && <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-lg text-xs text-red-600 dark:text-red-400">{error}</div>}
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Subject *</label>
            <input value={form.subject} onChange={e => setForm(f => ({...f, subject: e.target.value}))} placeholder="Describe the issue" className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Priority</label>
            <select value={form.priority} onChange={e => setForm(f => ({...f, priority: e.target.value}))} className={inputCls}>
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Notes</label>
            <textarea value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))} rows={2} className={inputCls + ' resize-none'} placeholder="Optional details" />
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition-colors disabled:opacity-70">{loading ? 'Creating…' : 'Create Ticket'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
