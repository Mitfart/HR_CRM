"use client";

/**
 * Generic CRM Kanban board component.
 * Used by both LeadsPage and DealsPage.
 */
import { ReactNode, useState } from "react";
import clsx from "clsx";

export type Stage = { id: string; name: string; color?: string | null; is_won?: boolean; is_lost?: boolean; sort_order: number };
export type KanbanItem = { id: string; title: string; stage_id: string | null; amount?: number | null; owner_id?: string | null; created_at: string };

interface Props {
  stages: Stage[];
  items: KanbanItem[];
  onStageChange: (itemId: string, stageId: string) => Promise<void>;
  onCardClick: (item: KanbanItem) => void;
  onAdd: (stageId: string) => void;
  /** Optional custom card body renderer (rendered below the title row) */
  renderCard?: (item: KanbanItem) => ReactNode;
}

export default function KanbanBoard({ stages, items, onStageChange, onCardClick, onAdd, renderCard }: Props) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStageId, setOverStageId] = useState<string | null>(null);

  function itemsByStage(stageId: string) {
    return items.filter((i) => i.stage_id === stageId);
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-4">
      {stages.map((stage) => {
        const stageItems = itemsByStage(stage.id);
        const isOver = overStageId === stage.id;
        return (
          <div
            key={stage.id}
            className={clsx(
              "flex-shrink-0 w-64 rounded-xl border transition",
              isOver ? "border-indigo-400 bg-indigo-50" : "border-slate-200 bg-white"
            )}
            onDragOver={(e) => { e.preventDefault(); setOverStageId(stage.id); }}
            onDragLeave={() => setOverStageId(null)}
            onDrop={async (e) => {
              e.preventDefault();
              setOverStageId(null);
              if (dragId) {
                await onStageChange(dragId, stage.id);
                setDragId(null);
              }
            }}
          >
            {/* Column header */}
            <div className="px-3 py-2.5 flex items-center justify-between border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: stage.color || "#6366f1" }} />
                <span className="text-sm font-semibold text-slate-700">{stage.name}</span>
                <span className="text-xs text-slate-400 ml-1">{stageItems.length}</span>
              </div>
              <button onClick={() => onAdd(stage.id)} className="text-slate-400 hover:text-indigo-600 text-lg leading-none transition" title="Добавить">+</button>
            </div>

            {/* Cards */}
            <div className="p-2 space-y-2 min-h-[80px]">
              {stageItems.map((item) => (
                <div
                  key={item.id}
                  draggable
                  onDragStart={() => setDragId(item.id)}
                  onDragEnd={() => setDragId(null)}
                  onClick={() => onCardClick(item)}
                  className={clsx(
                    "bg-white border border-slate-200 rounded-lg p-3 cursor-pointer hover:border-indigo-300 hover:shadow-sm transition select-none",
                    dragId === item.id && "opacity-40"
                  )}
                >
                  <div className="text-sm font-medium text-slate-800 line-clamp-2 mb-1.5">{item.title}</div>
                  {renderCard ? renderCard(item) : (
                    item.amount != null && (
                      <div className="text-xs text-emerald-600 font-semibold">{item.amount.toLocaleString("ru-RU")} ₽</div>
                    )
                  )}
                  <div className="mt-1 text-xs text-slate-400">{new Date(item.created_at).toLocaleDateString("ru-RU")}</div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
