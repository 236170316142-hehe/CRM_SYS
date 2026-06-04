import React, { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/axios';
import { DndContext, closestCenter, DragOverlay, defaultDropAnimationSideEffects } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const COLUMNS = [
  { id: 'prospect', title: 'Prospect' },
  { id: 'proposal', title: 'Proposal' },
  { id: 'negotiation', title: 'Negotiation' },
  { id: 'closed-won', title: 'Closed Won' },
  { id: 'closed-lost', title: 'Closed Lost' },
];

export default function PipelinePage() {
  const queryClient = useQueryClient();

  const { data: deals, isLoading } = useQuery({
    queryKey: ['deals'],
    queryFn: async () => {
      const res = await api.get('/deals');
      return res.data;
    },
  });

  const updateDealStage = useMutation({
    mutationFn: async ({ id, stage }) => {
      const res = await api.put(`/deals/${id}`, { stage });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals'] });
    },
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
    const newStage = over.id.split('-column')[0]; // Simple hack: we give column droppables an id like `prospect-column`
    const currentDeal = deals.find(d => d._id === dealId);

    if (currentDeal && currentDeal.stage !== newStage && COLUMNS.some(c => c.id === newStage)) {
      updateDealStage.mutate({ id: dealId, stage: newStage });
    }
  };

  if (isLoading) {
    return <div className="p-8 text-slate-500">Loading pipeline...</div>;
  }

  return (
    <div className="h-full flex flex-col">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Pipeline</h1>
        <p className="text-slate-500 dark:text-slate-400">Track and manage your deals</p>
      </div>

      <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <div className="flex gap-6 overflow-x-auto pb-4 flex-1">
          {COLUMNS.map((column) => (
            <KanbanColumn
              key={column.id}
              column={column}
              deals={dealsByStage[column.id] || []}
            />
          ))}
        </div>
      </DndContext>
    </div>
  );
}

import { useDroppable } from '@dnd-kit/core';

function KanbanColumn({ column, deals }) {
  const { setNodeRef } = useDroppable({
    id: `${column.id}-column`,
  });

  const totalValue = deals.reduce((sum, d) => sum + d.value, 0);

  return (
    <div className="flex flex-col w-80 shrink-0 bg-slate-50/50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800">
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-white/50 dark:bg-slate-950/50 rounded-t-xl">
        <h3 className="font-semibold text-slate-700 dark:text-slate-200">{column.title}</h3>
        <span className="text-sm font-medium text-slate-500 bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 rounded-full">
          ${totalValue.toLocaleString()}
        </span>
      </div>
      <div
        ref={setNodeRef}
        className="flex-1 p-3 flex flex-col gap-3 min-h-[200px]"
      >
        <SortableContext items={deals.map(d => d._id)} strategy={verticalListSortingStrategy}>
          {deals.map((deal) => (
            <DealCard key={deal._id} deal={deal} />
          ))}
        </SortableContext>
      </div>
    </div>
  );
}

function DealCard({ deal }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: deal._id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="bg-white dark:bg-slate-950 p-4 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800 cursor-grab active:cursor-grabbing hover:border-blue-300 dark:hover:border-blue-700 transition-colors"
    >
      <div className="font-medium text-slate-900 dark:text-slate-100 mb-1">{deal.title}</div>
      <div className="text-sm text-slate-500 dark:text-slate-400 mb-3">{deal.contact?.name || 'Unknown Contact'}</div>
      
      <div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
          ${deal.value.toLocaleString()}
        </span>
        {deal.isStale && (
          <span className="text-xs text-red-600 bg-red-50 dark:bg-red-900/30 dark:text-red-400 px-2 py-0.5 rounded-full font-medium">
            Stale
          </span>
        )}
      </div>
    </div>
  );
}
