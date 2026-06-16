"use client";

/**
 * Generic CRM Kanban board component.
 * Used by both LeadsPage and DealsPage.
 */
import { ReactNode, useState } from "react";
import clsx from "clsx";
import { GripVertical, Pencil, Plus, Trash2 } from "lucide-react";

export type Stage = { id: string; name: string; color?: string | null; is_won?: boolean; is_lost?: boolean; sort_order: number };
export type KanbanItem = { id: string; title: string; stage_id: string | null; amount?: number | null; owner_id?: string | null; created_at: string };

interface Props {
  stages: Stage[];
  items: KanbanItem[];
  onStageChange: (itemId: string, stageId: string) => Promise<void>;
  onCardClick: (item: KanbanItem) => void;
  onAdd: (stageId: string) => void;
  onStageCreate?: () => void;
  onStageUpdate?: (stageId: string, patch: Partial<Pick<Stage, "name" | "color" | "sort_order">>) => Promise<void>;
  onStageDelete?: (stageId: string) => Promise<void>;
  onStageReorder?: (stageId: string, targetStageId: string) => Promise<void>;
  /** Optional custom card body renderer (rendered below the title row) */
  renderCard?: (item: KanbanItem) => ReactNode;
}

export default function KanbanBoard({
  stages,
  items,
  onStageChange,
  onCardClick,
  onAdd,
  onStageCreate,
  onStageUpdate,
  onStageDelete,
  onStageReorder,
  renderCard,
}: Props) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragStageId, setDragStageId] = useState<string | null>(null);
  const [overStageId, setOverStageId] = useState<string | null>(null);
  const [editingStageId, setEditingStageId] = useState<string | null>(null);
  const [editingStageName, setEditingStageName] = useState("");

  function itemsByStage(stageId: string) {
    return items.filter((i) => i.stage_id === stageId);
  }

  async function saveStageName(stage: Stage) {
    const nextName = editingStageName.trim();
    setEditingStageId(null);
    if (!nextName || nextName === stage.name || !onStageUpdate) return;
    await onStageUpdate(stage.id, { name: nextName });
  }

  async function dropOnStage(stageId: string) {
    setOverStageId(null);
    if (dragStageId && dragStageId !== stageId && onStageReorder) {
      await onStageReorder(dragStageId, stageId);
      setDragStageId(null);
      return;
    }
    if (dragId) {
      await onStageChange(dragId, stageId);
      setDragId(null);
    }
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
              await dropOnStage(stage.id);
            }}
          >
            {/* Column header */}
            <div className="px-3 py-2.5 border-b border-slate-100">
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  {onStageReorder && (
                    <button
                      draggable
                      onDragStart={() => setDragStageId(stage.id)}
                      onDragEnd={() => setDragStageId(null)}
                      className="cursor-grab text-slate-300 hover:text-slate-500"
                      title="Перетащить этап"
                      type="button"
                    >
                      <GripVertical className="h-4 w-4" />
                    </button>
                  )}
                  <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ backgroundColor: stage.color || "#6366f1" }} />
                  {editingStageId === stage.id ? (
                    <input
                      autoFocus
                      value={editingStageName}
                      onChange={(e) => setEditingStageName(e.target.value)}
                      onBlur={() => saveStageName(stage)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          saveStageName(stage);
                        }
                        if (e.key === "Escape") {
                          e.preventDefault();
                          setEditingStageId(null);
                        }
                      }}
                      className="min-w-0 flex-1 rounded border border-indigo-200 px-1.5 py-0.5 text-sm font-semibold text-slate-700"
                    />
                  ) : (
                    <span className="truncate text-sm font-semibold text-slate-700">{stage.name}</span>
                  )}
                </div>
                <span className="text-xs text-slate-400 ml-1">{stageItems.length}</span>
              </div>
              <div className="mt-2 flex items-center justify-between gap-1">
                <button
                  onClick={() => onAdd(stage.id)}
                  className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-slate-500 transition hover:bg-indigo-50 hover:text-indigo-700"
                  title="Добавить карточку"
                  type="button"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Сделка
                </button>
                {(onStageUpdate || onStageDelete) && (
                  <div className="flex items-center gap-1">
                    {onStageUpdate && (
                      <button
                        onClick={() => {
                          setEditingStageId(stage.id);
                          setEditingStageName(stage.name);
                        }}
                        className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                        title="Переименовать этап"
                        type="button"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {onStageDelete && stages.length > 1 && (
                      <button
                        onClick={() => onStageDelete(stage.id)}
                        className="rounded-md p-1 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                        title="Удалить этап"
                        type="button"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                )}
              </div>
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
      {onStageCreate && (
        <button
          onClick={onStageCreate}
          className="flex h-[132px] w-56 flex-shrink-0 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white text-sm font-semibold text-slate-500 transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700"
          title="Создать колонку"
          type="button"
        >
          <Plus className="h-5 w-5" />
          Добавить этап
        </button>
      )}
    </div>
  );
}
