import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api, { extractError } from '../lib/axios';
import { useForm } from 'react-hook-form';
import {
  Phone, Users, Mail, CheckCircle2, Clock, Plus, X,
  CalendarClock, AlertCircle, Zap, BarChart3,
  ListTodo, Filter
} from 'lucide-react';
import { cn } from '../lib/utils';
import useAuthStore from '../store/authStore';

const ACTIVITY_TYPES = [
  { value: 'call', label: 'Call', icon: Phone, color: 'text-blue-500' },
  { value: 'meeting', label: 'Meeting', icon: Users, color: 'text-purple-500' },
  { value: 'email', label: 'Email', icon: Mail, color: 'text-amber-500' },
];

const CALL_OUTCOMES = ['completed', 'no-answer', 'left-voicemail', 'scheduled-callback'];

// ─── Admin View ───────────────────────────────────────────────────────────────
function AdminTasksView() {
  const [filterRep, setFilterRep] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const queryClient = useQueryClient();
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const { data: allTasks = [], isLoading } = useQuery({
    queryKey: ['tasks-admin', filterRep, filterStatus],
    queryFn: async () => {
      const params = {};
      if (filterRep) params.assignedTo = filterRep;
      if (filterStatus) params.status = filterStatus;
      const res = await api.get('/tasks', { params });
      return res.data;
    },
  });

  const { data: reps = [] } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const res = await api.get('/users');
      return res.data.filter((u) => u.role === 'rep');
    },
  });

  const updateTask = useMutation({
    mutationFn: async ({ id, status }) => (await api.put(`/tasks/${id}`, { status })).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks-admin'] });
      showToast('Task updated');
    },
  });

  const deleteTask = useMutation({
    mutationFn: async (id) => api.delete(`/tasks/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks-admin'] });
      showToast('Task deleted');
    },
  });

  // Group tasks by rep using populated assignedTo
  const byRep = allTasks.reduce((acc, task) => {
    const repId =
      task.assignedTo?._id?.toString() ||
      (typeof task.assignedTo === 'string' ? task.assignedTo : 'unassigned');
    const repName = task.assignedTo?.name || 'Unassigned';
    const repEmail = task.assignedTo?.email || '';
    if (!acc[repId]) acc[repId] = { repName, repEmail, tasks: [] };
    acc[repId].tasks.push(task);
    return acc;
  }, {});

  const totalIncomplete = allTasks.filter((t) => t.status === 'pending').length;
  const totalOverdue = allTasks.filter(
    (t) => t.status === 'pending' && new Date(t.dueDate) < new Date()
  ).length;
  const totalDone = allTasks.filter((t) => t.status === 'done').length;

  return (
    <div className="space-y-6 relative">
      {toast && (
        <div className={cn(
          'fixed top-4 right-4 z-50 max-w-sm w-full p-4 rounded-xl border shadow-xl flex gap-3 items-center',
          toast.type === 'error'
            ? 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900 text-red-700 dark:text-red-300'
            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white'
        )}>
          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
          <p className="text-sm flex-1">{toast.msg}</p>
          <button onClick={() => setToast(null)}><X className="w-4 h-4 text-slate-400" /></button>
        </div>
      )}

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <ListTodo className="w-6 h-6 text-indigo-500" />
          Team Task Overview
        </h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">
          Monitor all follow-up tasks across every sales rep in real time
        </p>
      </div>

      {/* Global Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total Tasks', count: allTasks.length, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900/50', icon: BarChart3 },
          { label: 'Incomplete', count: totalIncomplete, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/50', icon: Clock },
          { label: 'Overdue', count: totalOverdue, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900/50', icon: AlertCircle },
          { label: 'Completed', count: totalDone, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/50', icon: CheckCircle2 },
        ].map(({ label, count, color, bg, icon: Icon }) => (
          <div key={label} className={cn('rounded-xl border p-4 flex items-center gap-4', bg)}>
            <Icon className={cn('w-6 h-6', color)} />
            <div>
              <p className={cn('text-2xl font-bold', color)}>{count}</p>
              <p className={cn('text-xs font-medium', color)}>{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
          <Filter className="w-4 h-4" /> Filter:
        </div>
        <select
          value={filterRep}
          onChange={(e) => setFilterRep(e.target.value)}
          className="px-3 py-1.5 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">All Reps</option>
          {reps.map((r) => <option key={r._id} value={r._id}>{r.name}</option>)}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-1.5 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="done">Done</option>
        </select>
      </div>

      {/* Tasks grouped by rep */}
      {isLoading ? (
        <div className="text-center text-slate-400 py-12">Loading tasks...</div>
      ) : allTasks.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
          <ListTodo className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <p className="text-slate-500 dark:text-slate-400 font-medium">No tasks found</p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
            Tasks are auto-created when reps log calls, meetings, or update lead statuses.
          </p>
        </div>
      ) : (
        Object.entries(byRep).map(([repId, { repName, repEmail, tasks: repTasks }]) => {
          const overdueCount = repTasks.filter(
            (t) => t.status === 'pending' && new Date(t.dueDate) < new Date()
          ).length;
          const incompleteCount = repTasks.filter((t) => t.status === 'pending').length;
          const doneCount = repTasks.filter((t) => t.status === 'done').length;
          const completionPct = repTasks.length > 0
            ? Math.round((doneCount / repTasks.length) * 100)
            : 0;

          return (
            <div key={repId} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
              {/* Rep Header */}
              <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0',
                      repId === 'unassigned'
                        ? 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                        : 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300'
                    )}>
                      {repName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-white text-sm">{repName}</p>
                      {repEmail && <p className="text-xs text-slate-400 dark:text-slate-500">{repEmail}</p>}
                    </div>
                  </div>

                  {/* Stats badges */}
                  <div className="flex items-center gap-2 flex-wrap justify-end">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                      {repTasks.length} total
                    </span>
                    {incompleteCount > 0 && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900/50">
                        <Clock className="w-3 h-3" />
                        {incompleteCount} incomplete
                      </span>
                    )}
                    {overdueCount > 0 && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-900/50">
                        <AlertCircle className="w-3 h-3" />
                        {overdueCount} overdue
                      </span>
                    )}
                    {doneCount > 0 && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/50">
                        <CheckCircle2 className="w-3 h-3" />
                        {doneCount} done
                      </span>
                    )}
                  </div>
                </div>

                {/* Progress bar */}
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                      style={{ width: `${completionPct}%` }}
                    />
                  </div>
                  <span className="text-xs text-slate-500 dark:text-slate-400 shrink-0 w-16 text-right">
                    {completionPct}% done
                  </span>
                </div>
              </div>

              {/* Task rows */}
              <div className="divide-y divide-slate-50 dark:divide-slate-800/50">
                {repTasks.map((task) => (
                  <AdminTaskRow
                    key={task._id}
                    task={task}
                    onToggle={(id, status) =>
                      updateTask.mutate({ id, status: status === 'done' ? 'pending' : 'done' })
                    }
                    onDelete={(id) => deleteTask.mutate(id)}
                  />
                ))}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

function AdminTaskRow({ task, onToggle, onDelete }) {
  const isOverdue = task.status === 'pending' && new Date(task.dueDate) < new Date();
  const isDone = task.status === 'done';

  const dueLabel = (() => {
    const d = new Date(task.dueDate);
    const diffH = Math.round((d - new Date()) / (1000 * 60 * 60));
    if (isDone) return 'Done';
    if (diffH < 0) return `${Math.abs(diffH)}h overdue`;
    if (diffH < 24) return `Due in ${diffH}h`;
    return `Due ${d.toLocaleDateString()}`;
  })();

  return (
    <div className={cn(
      'flex items-center gap-4 px-5 py-3 transition-colors',
      isOverdue && 'bg-red-50/40 dark:bg-red-950/10',
    )}>
      <button
        onClick={() => onToggle(task._id, task.status)}
        className={cn(
          'w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors',
          isDone
            ? 'bg-emerald-500 border-emerald-500 text-white'
            : isOverdue
              ? 'border-red-400 hover:bg-red-100 dark:hover:bg-red-900/30'
              : 'border-slate-300 dark:border-slate-600 hover:border-blue-500'
        )}
      >
        {isDone && <CheckCircle2 className="w-3 h-3" />}
      </button>

      <div className="flex-1 min-w-0">
        <p className={cn(
          'text-sm text-slate-900 dark:text-white font-medium',
          isDone && 'line-through text-slate-400 dark:text-slate-500'
        )}>
          {task.subject}
        </p>
        {task.relatedTo && (
          <p className="text-xs text-slate-400 dark:text-slate-500 truncate mt-0.5">
            {task.relatedTo.title || task.relatedTo.name || ''}
          </p>
        )}
      </div>

      <span className={cn(
        'text-xs font-medium shrink-0 inline-flex items-center gap-1',
        isDone ? 'text-emerald-600 dark:text-emerald-400'
          : isOverdue ? 'text-red-600 dark:text-red-400'
            : 'text-slate-500 dark:text-slate-400'
      )}>
        <Clock className="w-3 h-3" />{dueLabel}
      </span>

      <button
        onClick={() => onDelete(task._id)}
        className="text-slate-300 dark:text-slate-700 hover:text-red-500 dark:hover:text-red-400 transition-colors shrink-0"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

// ─── Rep View ─────────────────────────────────────────────────────────────────
function RepTasksView() {
  const queryClient = useQueryClient();
  const [logModalOpen, setLogModalOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState('pending');
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4500);
  };

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['tasks', filterStatus],
    queryFn: async () => {
      const res = await api.get('/tasks', {
        params: { status: filterStatus || undefined },
      });
      return res.data;
    },
  });

  const { data: leads = [] } = useQuery({
    queryKey: ['leads'],
    queryFn: async () => (await api.get('/leads')).data,
  });
  const { data: deals = [] } = useQuery({
    queryKey: ['deals'],
    queryFn: async () => (await api.get('/deals')).data,
  });

  const updateTaskMutation = useMutation({
    mutationFn: async ({ id, status }) => (await api.put(`/tasks/${id}`, { status })).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      showToast('Task updated!');
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async (id) => api.delete(`/tasks/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      showToast('Task removed.');
    },
  });

  const logActivityMutation = useMutation({
    mutationFn: async (data) => (await api.post('/activities', data)).data,
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setLogModalOpen(false);
      const isAutoTask =
        (vars.type === 'call' && vars.outcome === 'completed') || vars.type === 'meeting';
      if (isAutoTask) {
        showToast('✅ Activity logged! A follow-up task has been auto-added to your queue, due tomorrow.');
      } else {
        showToast('Activity logged!');
      }
    },
    onError: (err) => showToast(extractError(err), 'error'),
  });

  const overdueTasks = tasks.filter((t) => t.status === 'pending' && new Date(t.dueDate) < new Date());
  const upcomingTasks = tasks.filter((t) => t.status === 'pending' && new Date(t.dueDate) >= new Date());
  const doneTasks = tasks.filter((t) => t.status === 'done');

  return (
    <div className="space-y-6 relative">
      {toast && (
        <div className={cn(
          'fixed top-4 right-4 z-50 max-w-sm w-full p-4 rounded-xl border shadow-xl flex gap-3 items-start',
          toast.type === 'error'
            ? 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900 text-red-800 dark:text-red-200'
            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white'
        )}>
          {toast.type === 'error'
            ? <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            : <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
          }
          <p className="text-sm leading-relaxed flex-1">{toast.message}</p>
          <button onClick={() => setToast(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <CalendarClock className="w-6 h-6 text-blue-500" />
            My Tasks & Follow-ups
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">
            Follow-up tasks are auto-created when you log calls, meetings, or update lead status
          </p>
        </div>
        <button
          onClick={() => setLogModalOpen(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-md shadow-blue-500/20 text-sm"
        >
          <Plus className="w-4 h-4" /> Log Activity
        </button>
      </div>

      {/* Auto-trigger Banner */}
      <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 rounded-xl">
        <Zap className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">Automatic Follow-up Pipeline Active</p>
          <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">
            When you <strong>log a completed call</strong>, <strong>log a meeting</strong>, or <strong>update a lead to Contacted / Qualified</strong> — a follow-up task is automatically added here, due in 24 hours.
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Overdue', count: overdueTasks.length, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900/50' },
          { label: 'Incomplete', count: upcomingTasks.length, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/50' },
          { label: 'Completed', count: doneTasks.length, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/50' },
        ].map(({ label, count, color, bg }) => (
          <div key={label} className={cn('rounded-xl border p-4 flex items-center gap-4', bg)}>
            <span className={cn('text-3xl font-bold', color)}>{count}</span>
            <span className={cn('text-sm font-medium', color)}>{label}</span>
          </div>
        ))}
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2">
        {[{ label: 'Pending', value: 'pending' }, { label: 'Done', value: 'done' }, { label: 'All', value: '' }].map(({ label, value }) => (
          <button
            key={value}
            onClick={() => setFilterStatus(value)}
            className={cn(
              'px-4 py-1.5 rounded-full text-xs font-semibold border transition-colors',
              filterStatus === value
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-blue-300'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Task List */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="text-center text-slate-400 py-12">Loading tasks...</div>
        ) : tasks.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
            <CalendarClock className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <p className="text-slate-500 dark:text-slate-400 font-medium">No tasks here!</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
              Update a lead status to Contacted or Qualified — a follow-up task will appear here automatically.
            </p>
          </div>
        ) : (
          tasks.map((task) => (
            <RepTaskCard
              key={task._id}
              task={task}
              onToggle={(id, status) => updateTaskMutation.mutate({ id, status: status === 'done' ? 'pending' : 'done' })}
              onDelete={(id) => deleteTaskMutation.mutate(id)}
            />
          ))
        )}
      </div>

      {logModalOpen && (
        <LogActivityModal
          leads={leads}
          deals={deals}
          onClose={() => setLogModalOpen(false)}
          onSubmit={(data) => logActivityMutation.mutate(data)}
          isSubmitting={logActivityMutation.isPending}
        />
      )}
    </div>
  );
}

function RepTaskCard({ task, onToggle, onDelete }) {
  const isOverdue = task.status === 'pending' && new Date(task.dueDate) < new Date();
  const isDone = task.status === 'done';

  const dueLabel = (() => {
    const d = new Date(task.dueDate);
    const diffH = Math.round((d - new Date()) / (1000 * 60 * 60));
    if (isDone) return 'Completed';
    if (diffH < 0) return `${Math.abs(diffH)}h overdue`;
    if (diffH < 24) return `Due in ${diffH}h`;
    return `Due ${d.toLocaleDateString()}`;
  })();

  return (
    <div className={cn(
      'flex items-start gap-4 p-4 rounded-xl border bg-white dark:bg-slate-900 transition-all',
      isDone
        ? 'border-slate-100 dark:border-slate-800 opacity-60'
        : isOverdue
          ? 'border-red-200 dark:border-red-900/60 bg-red-50/30 dark:bg-red-950/10'
          : 'border-slate-200 dark:border-slate-800 hover:border-blue-200 dark:hover:border-blue-900'
    )}>
      <button
        onClick={() => onToggle(task._id, task.status)}
        className={cn(
          'w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors',
          isDone
            ? 'bg-emerald-500 border-emerald-500 text-white'
            : isOverdue
              ? 'border-red-400 hover:bg-red-100 dark:hover:bg-red-900/30'
              : 'border-slate-300 dark:border-slate-600 hover:border-blue-500'
        )}
      >
        {isDone && <CheckCircle2 className="w-3 h-3" />}
      </button>

      <div className="flex-1 min-w-0">
        <p className={cn('font-semibold text-sm text-slate-900 dark:text-white', isDone && 'line-through text-slate-400 dark:text-slate-500')}>
          {task.subject}
        </p>
        {task.relatedTo && (
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
            {task.relatedTo.title || task.relatedTo.name || 'Related record'}
          </p>
        )}
        <div className="flex items-center gap-3 mt-2">
          <span className={cn(
            'inline-flex items-center gap-1 text-[11px] font-medium',
            isDone ? 'text-emerald-600 dark:text-emerald-400'
              : isOverdue ? 'text-red-600 dark:text-red-400'
                : 'text-slate-500 dark:text-slate-400'
          )}>
            <Clock className="w-3 h-3" /> {dueLabel}
          </span>
        </div>
      </div>

      <button
        onClick={() => onDelete(task._id)}
        className="text-slate-300 dark:text-slate-700 hover:text-red-500 dark:hover:text-red-400 transition-colors shrink-0"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

// ─── Log Activity Modal ───────────────────────────────────────────────────────
function LogActivityModal({ leads, deals, onClose, onSubmit, isSubmitting }) {
  const { register, handleSubmit, watch } = useForm({
    defaultValues: { type: 'call', outcome: 'completed', onModel: 'Lead' },
  });

  const activityType = watch('type');
  const selectedModel = watch('onModel');
  const relatedOptions = selectedModel === 'Deal' ? deals : leads;

  const handleFormSubmit = (data) => {
    onSubmit({
      type: data.type,
      outcome: data.outcome || null,
      relatedTo: data.relatedTo || undefined,
      onModel: data.relatedTo ? data.onModel : undefined,
    });
  };

  const willAutoCreate =
    (activityType === 'call' && watch('outcome') === 'completed') || activityType === 'meeting';

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 dark:border-slate-800">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Log Activity</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2 uppercase tracking-wide">Activity Type</label>
            <div className="grid grid-cols-3 gap-2">
              {ACTIVITY_TYPES.map(({ value, label, icon: Icon, color }) => (
                <label key={value} className="cursor-pointer">
                  <input type="radio" value={value} {...register('type')} className="sr-only" />
                  <div className={cn(
                    'flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all text-center',
                    watch('type') === value
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40'
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                  )}>
                    <Icon className={cn('w-5 h-5', color)} />
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{label}</span>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {activityType === 'call' && (
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wide">Call Outcome</label>
              <select {...register('outcome')} className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none">
                {CALL_OUTCOMES.map((o) => (
                  <option key={o} value={o}>{o.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</option>
                ))}
              </select>
            </div>
          )}

          {activityType === 'meeting' && (
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wide">Meeting Notes (optional)</label>
              <textarea {...register('outcome')} rows={2} placeholder="Brief summary..." className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none resize-none" />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wide">Relates to</label>
              <select {...register('onModel')} className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none">
                <option value="Lead">Lead</option>
                <option value="Deal">Deal</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wide">Record</label>
              <select {...register('relatedTo')} className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none">
                <option value="">— None —</option>
                {relatedOptions.map((r) => (
                  <option key={r._id} value={r._id}>{r.title || r.name}</option>
                ))}
              </select>
            </div>
          </div>

          {willAutoCreate && (
            <div className="flex items-center gap-2 p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 rounded-lg">
              <Zap className="w-4 h-4 text-emerald-500 shrink-0" />
              <p className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">
                A follow-up task will be auto-created in your queue, due in 24 hours.
              </p>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting} className="flex-1 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors disabled:opacity-60">
              {isSubmitting ? 'Logging...' : 'Log Activity'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Root export (role-based) ─────────────────────────────────────────────────
export default function TasksPage() {
  const { user } = useAuthStore();
  return user?.role === 'admin' ? <AdminTasksView /> : <RepTasksView />;
}
