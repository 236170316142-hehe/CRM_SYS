import React from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../lib/axios';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export default function ReportsPage() {
  const { data: pipelineData, isLoading: pipeLoading } = useQuery({
    queryKey: ['report-pipeline'],
    queryFn: async () => {
      const res = await api.get('/reports/pipeline');
      return res.data;
    },
  });

  const { data: activityData, isLoading: actLoading } = useQuery({
    queryKey: ['report-activity'],
    queryFn: async () => {
      const res = await api.get('/reports/activity');
      return res.data;
    },
  });

  return (
    <div className="space-y-8 h-full">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Reports & Analytics</h1>
        <p className="text-slate-500 dark:text-slate-400">Insights into your sales pipeline and team activity</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-[400px]">
        {/* Pipeline Chart */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-6">Pipeline Value by Stage</h2>
          <div className="flex-1 min-h-0">
            {pipeLoading ? (
              <div className="h-full flex items-center justify-center text-slate-400">Loading chart...</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={pipelineData} margin={{ top: 10, right: 10, left: 20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="_id" tick={{ fill: '#64748b' }} tickLine={false} axisLine={false} dy={10} style={{ textTransform: 'capitalize' }} />
                  <YAxis tickFormatter={(val) => `$${val/1000}k`} tick={{ fill: '#64748b' }} tickLine={false} axisLine={false} dx={-10} />
                  <Tooltip 
                    cursor={{ fill: 'rgba(241, 245, 249, 0.5)' }} 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    formatter={(value) => [`$${value.toLocaleString()}`, 'Total Value']}
                    labelStyle={{ textTransform: 'capitalize', color: '#0f172a', fontWeight: 'bold' }}
                  />
                  <Bar dataKey="totalValue" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={40} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Activity Chart */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-6">Weekly Rep Activity</h2>
          <div className="flex-1 min-h-0">
            {actLoading ? (
              <div className="h-full flex items-center justify-center text-slate-400">Loading chart...</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={activityData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="repName" tick={{ fill: '#64748b' }} tickLine={false} axisLine={false} dy={10} />
                  <YAxis tick={{ fill: '#64748b' }} tickLine={false} axisLine={false} dx={-10} />
                  <Tooltip 
                    cursor={{ fill: 'rgba(241, 245, 249, 0.5)' }} 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    formatter={(value) => [value, 'Activities']}
                    labelStyle={{ color: '#0f172a', fontWeight: 'bold' }}
                  />
                  <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} barSize={40} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
