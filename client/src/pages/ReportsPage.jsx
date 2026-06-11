import React from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../lib/axios';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend,
} from 'recharts';
import { TrendingUp, Users, Target, CheckSquare, AlertCircle, DollarSign } from 'lucide-react';
import { cn } from '../lib/utils';

const STAGE_COLORS = {
  Prospect: '#3b82f6', Proposal: '#8b5cf6', Negotiation: '#f59e0b',
  'Closed Won': '#22c55e', 'Closed Lost': '#ef4444',
};
const STATUS_COLORS = {
  New: '#22c55e', Contacted: '#3b82f6', Qualified: '#8b5cf6',
  Won: '#14b8a6', Lost: '#64748b',
};
const SOURCE_COLORS = ['#3b82f6', '#8b5cf6', '#f59e0b', '#22c55e', '#ef4444'];

function KpiCard({ icon: Icon, label, value, sub, color = 'blue' }) {
  const colors = {
    blue:  'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400',
    green: 'bg-green-50 dark:bg-green-950/40 text-green-600 dark:text-green-400',
    purple:'bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400',
    amber: 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400',
    red:   'bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400',
    teal:  'bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400',
  };
  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 flex items-start gap-4">
      <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center shrink-0', colors[color])}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-0.5">{label}</p>
        <p className="text-2xl font-bold text-slate-900 dark:text-white leading-none">{value}</p>
        {sub && <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{sub}</p>}
      </div>
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 shadow-xl text-xs">
      <p className="font-semibold text-white mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color || p.fill }}>{p.name}: <span className="font-bold">{
          typeof p.value === 'number' && p.name?.toLowerCase().includes('value')
            ? `$${p.value.toLocaleString()}`
            : p.value
        }</span></p>
      ))}
    </div>
  );
};

export default function ReportsPage() {
  const { data: summary, isLoading: sumLoading } = useQuery({
    queryKey: ['report-summary'],
    queryFn: () => api.get('/reports/summary').then(r => r.data),
  });

  const { data: pipelineData, isLoading: pipeLoading } = useQuery({
    queryKey: ['report-pipeline'],
    queryFn: () => api.get('/reports/pipeline').then(r => r.data),
  });

  const { data: activityData, isLoading: actLoading } = useQuery({
    queryKey: ['report-activity'],
    queryFn: () => api.get('/reports/activity').then(r => r.data),
  });

  const { data: leadData, isLoading: leadLoading } = useQuery({
    queryKey: ['report-leads'],
    queryFn: () => api.get('/reports/leads').then(r => r.data),
  });

  const isLoading = sumLoading || pipeLoading || actLoading || leadLoading;

  return (
    <div className="space-y-8 pb-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Reports & Analytics</h1>
        <p className="text-slate-500 dark:text-slate-400">Insights into your sales pipeline and team activity</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <KpiCard icon={Users}       label="Total Leads"       color="blue"
          value={sumLoading ? '—' : summary?.totalLeads ?? 0}
          sub={`${summary?.wonLeads ?? 0} won`} />
        <KpiCard icon={Target}      label="Lead Conversion"   color="green"
          value={sumLoading ? '—' : `${summary?.leadConversionRate ?? 0}%`}
          sub="leads → won" />
        <KpiCard icon={TrendingUp}  label="Pipeline Value"    color="purple"
          value={sumLoading ? '—' : `$${((summary?.totalPipelineValue ?? 0) / 1000).toFixed(0)}k`}
          sub="active deals" />
        <KpiCard icon={DollarSign}  label="Deal Win Rate"     color="teal"
          value={sumLoading ? '—' : `${summary?.dealWinRate ?? 0}%`}
          sub={`${summary?.wonDeals ?? 0} of ${summary?.totalDeals ?? 0} deals`} />
        <KpiCard icon={CheckSquare} label="Open Tasks"        color="amber"
          value={sumLoading ? '—' : summary?.openTasks ?? 0}
          sub="pending" />
        <KpiCard icon={AlertCircle} label="Overdue Tasks"     color="red"
          value={sumLoading ? '—' : summary?.overdueTasks ?? 0}
          sub="past due date" />
      </div>

      {/* Row 1 — Pipeline + Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-5">Pipeline Value by Stage</h2>
          <div className="h-60">
            {pipeLoading ? (
              <div className="h-full flex items-center justify-center text-slate-400 text-sm">Loading…</div>
            ) : !pipelineData?.length ? (
              <div className="h-full flex items-center justify-center text-slate-400 text-sm">No pipeline data</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={pipelineData} margin={{ top: 5, right: 10, left: 10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false} dy={8} />
                  <YAxis tickFormatter={v => `$${v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}`} tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="totalValue" name="Total Value" radius={[6, 6, 0, 0]} barSize={36}>
                    {pipelineData.map((entry) => (
                      <Cell key={entry._id} fill={STAGE_COLORS[entry.label] || '#3b82f6'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-5">Weekly Rep Activity</h2>
          <div className="h-60">
            {actLoading ? (
              <div className="h-full flex items-center justify-center text-slate-400 text-sm">Loading…</div>
            ) : !activityData?.length ? (
              <div className="h-full flex items-center justify-center text-slate-400 text-sm">No activity this week</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={activityData} margin={{ top: 5, right: 10, left: 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" vertical={false} />
                  <XAxis dataKey="repName" tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false} dy={8} />
                  <YAxis allowDecimals={false} tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="count" name="Activities" fill="#8b5cf6" radius={[6, 6, 0, 0]} barSize={36} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Row 2 — Lead Status + Source Pie + Weekly Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lead status bar */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-5">Leads by Status</h2>
          <div className="h-52">
            {leadLoading ? (
              <div className="h-full flex items-center justify-center text-slate-400 text-sm">Loading…</div>
            ) : !leadData?.byStatus?.length ? (
              <div className="h-full flex items-center justify-center text-slate-400 text-sm">No lead data</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={leadData.byStatus} layout="vertical" margin={{ top: 0, right: 16, left: 60, bottom: 0 }}>
                  <XAxis type="number" allowDecimals={false} tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="label" tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false} width={56} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="count" name="Leads" radius={[0, 6, 6, 0]} barSize={18}>
                    {leadData.byStatus.map((entry) => (
                      <Cell key={entry._id} fill={STATUS_COLORS[entry.label] || '#3b82f6'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Source pie */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-5">Lead Sources</h2>
          <div className="h-52 flex items-center justify-center">
            {leadLoading ? (
              <div className="text-slate-400 text-sm">Loading…</div>
            ) : !leadData?.bySource?.length ? (
              <div className="text-slate-400 text-sm">No data</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={leadData.bySource}
                    dataKey="count"
                    nameKey="label"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    innerRadius={40}
                    paddingAngle={3}
                    label={({ label, percent }) => `${label} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                    fontSize={11}
                  >
                    {leadData.bySource.map((_, i) => (
                      <Cell key={i} fill={SOURCE_COLORS[i % SOURCE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Weekly new leads trend */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-5">New Leads — Last 8 Weeks</h2>
          <div className="h-52">
            {leadLoading ? (
              <div className="h-full flex items-center justify-center text-slate-400 text-sm">Loading…</div>
            ) : !leadData?.weeklyTrend?.length ? (
              <div className="h-full flex items-center justify-center text-slate-400 text-sm">No trend data</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={leadData.weeklyTrend} margin={{ top: 5, right: 10, left: 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" vertical={false} />
                  <XAxis dataKey="week" tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false} dy={8} />
                  <YAxis allowDecimals={false} tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="count"
                    name="New Leads"
                    stroke="#3b82f6"
                    strokeWidth={2.5}
                    dot={{ fill: '#3b82f6', r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
