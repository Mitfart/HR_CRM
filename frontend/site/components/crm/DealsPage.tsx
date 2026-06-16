"use client";

import { useEffect, useMemo, useState } from "react";
import CrmNav from "@/components/CrmNav";
import KanbanBoard, { KanbanItem, Stage } from "@/components/crm/KanbanBoard";

const DEALS_GID = "1396224654";

type DealKanbanItem = KanbanItem & {
  source?: string;
  source_row?: number;
  client?: string;
  description?: string;
};

type SheetArchiveState = {
  auto_item_ids?: string[];
  restored_item_ids?: string[];
};

function rowTone(clientRaw: string) {
  if (clientRaw.includes("‼️")) return "bg-orange-50";
  if (clientRaw.includes("✅")) return "bg-emerald-50";
  if (clientRaw.includes("🔵")) return "bg-sky-50";
  return "bg-white";
}

function isGrayFill(hex?: string) {
  if (!hex) return false;
  const value = hex.trim().toLowerCase().replace("#", "");
  const rgb = value.length === 8 ? value.slice(2) : value;
  if (rgb.length !== 6) return false;
  const red = Number.parseInt(rgb.slice(0, 2), 16);
  const green = Number.parseInt(rgb.slice(2, 4), 16);
  const blue = Number.parseInt(rgb.slice(4, 6), 16);
  if ([red, green, blue].some((channel) => Number.isNaN(channel))) return false;
  const spread = Math.max(red, green, blue) - Math.min(red, green, blue);
  const brightness = (red + green + blue) / 3;
  return spread <= 22 && brightness >= 70 && brightness <= 245;
}

export default function DealsPage() {
  const [sheetRows, setSheetRows] = useState<string[][]>([]);
  const [sheetNotes, setSheetNotes] = useState<Record<string, string>>({});
  const [sheetStyles, setSheetStyles] = useState<Record<string, { bg?: string; fg?: string }>>({});
  const [localComments, setLocalComments] = useState<Record<string, Array<{ text: string; author: string; created_at: string }>>>({});
  const [localOverrides, setLocalOverrides] = useState<Record<string, string>>({});
  const [sheetArchive, setSheetArchive] = useState<SheetArchiveState>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [savingComment, setSavingComment] = useState(false);
  const [savingCell, setSavingCell] = useState(false);
  const [editMode, setEditMode] = useState<"value" | "comment">("value");
  const [viewMode, setViewMode] = useState<"kanban" | "table" | "archive">("kanban");
  const [kanbanStages, setKanbanStages] = useState<Stage[]>([]);
  const [kanbanItems, setKanbanItems] = useState<DealKanbanItem[]>([]);
  const [kanbanLoading, setKanbanLoading] = useState(true);
  const [savingKanban, setSavingKanban] = useState(false);
  const [activeCell, setActiveCell] = useState<{ row: number; col: number } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [error, setError] = useState("");

  async function loadDeals() {
    try {
      const res = await fetch(`/api/crm/deals?mode=sheet&gid=${DEALS_GID}`, { cache: "no-store" });
      if (!res.ok) throw new Error("load failed");
      const data = (await res.json()) as {
        rows?: string[][];
        notes?: Record<string, string>;
        styles?: Record<string, { bg?: string; fg?: string }>;
        local_comments?: Record<string, Array<{ text: string; author: string; created_at: string }>>;
        local_overrides?: Record<string, string>;
        archive?: SheetArchiveState;
      };
      const rows = Array.isArray(data.rows) ? data.rows : [];
      setSheetRows(rows);
      setSheetNotes(data.notes && typeof data.notes === "object" ? data.notes : {});
      setSheetStyles(data.styles && typeof data.styles === "object" ? data.styles : {});
      setLocalComments(data.local_comments && typeof data.local_comments === "object" ? data.local_comments : {});
      setLocalOverrides(data.local_overrides && typeof data.local_overrides === "object" ? data.local_overrides : {});
      setSheetArchive(data.archive && typeof data.archive === "object" ? data.archive : {});
      setError("");
    } catch {
      setError("Не удалось загрузить сделки");
    } finally {
      setLoading(false);
    }
  }

  async function loadKanban() {
    try {
      const res = await fetch(`/api/crm/deals/kanban?gid=${DEALS_GID}`, { cache: "no-store" });
      if (!res.ok) throw new Error("kanban failed");
      const data = (await res.json()) as { stages?: Stage[]; items?: DealKanbanItem[] };
      setKanbanStages(Array.isArray(data.stages) ? data.stages : []);
      setKanbanItems(Array.isArray(data.items) ? data.items : []);
      setError("");
    } catch {
      setError("Не удалось загрузить воронку сделок");
    } finally {
      setKanbanLoading(false);
    }
  }

  async function runSyncNow() {
    setSyncing(true);
    try {
      const res = await fetch("/api/crm/deals", { method: "POST" });
      if (!res.ok) throw new Error("sync failed");
      await loadDeals();
      await loadKanban();
    } catch {
      setError("Не удалось запустить синхронизацию");
    } finally {
      setSyncing(false);
    }
  }

  async function addComment(rowIdx: number, colIdx: number) {
    const text = window.prompt("Комментарий к ячейке:");
    if (!text || !text.trim()) return;
    setSavingComment(true);
    try {
      const res = await fetch("/api/crm/deals/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gid: DEALS_GID,
          row: rowIdx,
          col: colIdx,
          text: text.trim(),
        }),
      });
      if (!res.ok) throw new Error("comment failed");
      await loadDeals();
    } catch {
      setError("Не удалось сохранить комментарий");
    } finally {
      setSavingComment(false);
    }
  }

  async function saveCellValue(rowIdx: number, colIdx: number, nextValue: string) {
    setSavingCell(true);
    try {
      const res = await fetch("/api/crm/deals/cells", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gid: DEALS_GID,
          row: rowIdx,
          col: colIdx,
          value: nextValue,
        }),
      });
      if (!res.ok) throw new Error("cell update failed");
      setActiveCell(null);
      await loadDeals();
    } catch {
      setError("Не удалось сохранить значение ячейки");
    } finally {
      setSavingCell(false);
    }
  }

  async function restoreArchiveRow(sourceIdx: number) {
    setSavingCell(true);
    try {
      const res = await fetch("/api/crm/deals/archive/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gid: DEALS_GID,
          item_id: rowItemId(sourceIdx),
          restored: true,
        }),
      });
      if (!res.ok) throw new Error("archive restore failed");
      await loadDeals();
      await loadKanban();
      setViewMode("table");
    } catch {
      setError("Не удалось вернуть сделку в работу");
    } finally {
      setSavingCell(false);
    }
  }

  async function createStage() {
    const name = window.prompt("Название нового этапа:");
    if (!name?.trim()) return;
    setSavingKanban(true);
    try {
      const res = await fetch("/api/crm/deals/kanban/stages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gid: DEALS_GID, name: name.trim() }),
      });
      if (!res.ok) throw new Error("stage create failed");
      await loadKanban();
    } catch {
      setError("Не удалось создать этап");
    } finally {
      setSavingKanban(false);
    }
  }

  async function updateStage(stageId: string, patch: Partial<Pick<Stage, "name" | "color" | "sort_order">>) {
    setSavingKanban(true);
    const prevStages = kanbanStages;
    setKanbanStages((current) =>
      current
        .map((stage) => (stage.id === stageId ? { ...stage, ...patch } : stage))
        .sort((a, b) => a.sort_order - b.sort_order),
    );
    try {
      const res = await fetch(`/api/crm/deals/kanban/stages/${encodeURIComponent(stageId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gid: DEALS_GID, ...patch }),
      });
      if (!res.ok) throw new Error("stage update failed");
      await loadKanban();
    } catch {
      setKanbanStages(prevStages);
      setError("Не удалось обновить этап");
    } finally {
      setSavingKanban(false);
    }
  }

  async function deleteStage(stageId: string) {
    const stage = kanbanStages.find((item) => item.id === stageId);
    if (!stage) return;
    const confirmed = window.confirm(`Удалить этап «${stage.name}»? Карточки будут перенесены в первый доступный этап.`);
    if (!confirmed) return;
    setSavingKanban(true);
    try {
      const res = await fetch(`/api/crm/deals/kanban/stages/${encodeURIComponent(stageId)}?gid=${DEALS_GID}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("stage delete failed");
      await loadKanban();
    } catch {
      setError("Не удалось удалить этап");
    } finally {
      setSavingKanban(false);
    }
  }

  async function moveKanbanItem(itemId: string, stageId: string) {
    const prevItems = kanbanItems;
    setKanbanItems((current) => current.map((item) => (item.id === itemId ? { ...item, stage_id: stageId } : item)));
    try {
      const res = await fetch(`/api/crm/deals/kanban/items/${encodeURIComponent(itemId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gid: DEALS_GID, stage_id: stageId }),
      });
      if (!res.ok) throw new Error("item move failed");
    } catch {
      setKanbanItems(prevItems);
      setError("Не удалось перенести карточку");
    }
  }

  async function reorderStage(stageId: string, targetStageId: string) {
    const current = [...kanbanStages].sort((a, b) => a.sort_order - b.sort_order);
    const fromIndex = current.findIndex((stage) => stage.id === stageId);
    const toIndex = current.findIndex((stage) => stage.id === targetStageId);
    if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return;
    const prevStages = kanbanStages;
    const [moved] = current.splice(fromIndex, 1);
    current.splice(toIndex, 0, moved);
    const nextStages = current.map((stage, index) => ({ ...stage, sort_order: index }));
    setKanbanStages(nextStages);
    setSavingKanban(true);
    try {
      const res = await fetch(`/api/crm/deals/kanban/stages/${encodeURIComponent(stageId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gid: DEALS_GID, sort_order: toIndex }),
      });
      if (!res.ok) throw new Error("stage reorder failed");
      await loadKanban();
    } catch {
      setKanbanStages(prevStages);
      setError("Не удалось переставить этап");
    } finally {
      setSavingKanban(false);
    }
  }

  function showCardSource(item: DealKanbanItem) {
    if (!item.source_row) return "";
    return `Строка таблицы #${item.source_row + 1}`;
  }

  function rowItemId(sourceIdx: number) {
    return `sheet:${DEALS_GID}:${sourceIdx}`;
  }

  function rowHasGrayFill(sourceIdx: number) {
    return Object.entries(sheetStyles).some(([key, style]) => {
      const [rowText] = key.split(":");
      return Number(rowText) === sourceIdx && isGrayFill(style.bg);
    });
  }

  function isAutoArchiveRow(sourceIdx: number) {
    if (sourceIdx <= 0) return false;
    const itemId = rowItemId(sourceIdx);
    return Boolean(sheetArchive.auto_item_ids?.includes(itemId)) || rowHasGrayFill(sourceIdx);
  }

  function isRestoredRow(sourceIdx: number) {
    return Boolean(sheetArchive.restored_item_ids?.includes(rowItemId(sourceIdx)));
  }

  function isArchiveRow(sourceIdx: number) {
    return isAutoArchiveRow(sourceIdx) && !isRestoredRow(sourceIdx);
  }

  async function refreshDealsData() {
    await loadDeals();
    await loadKanban();
  }

  useEffect(() => {
    refreshDealsData();
    const timer = window.setInterval(() => {
      refreshDealsData();
    }, 60000);
    return () => window.clearInterval(timer);
  }, []);

  const indexedSheetRows = useMemo(() => {
    const indexed = sheetRows.map((row, sourceIdx) => ({ row, sourceIdx }));
    return indexed;
  }, [sheetRows]);

  const visibleSheetRows = useMemo(() => {
    const activeRows = indexedSheetRows.filter(({ sourceIdx }) => sourceIdx === 0 || !isArchiveRow(sourceIdx));
    if (!search.trim()) return activeRows;
    const q = search.trim().toLowerCase();
    return activeRows.filter(({ row, sourceIdx }) => sourceIdx === 0 || row.join(" ").toLowerCase().includes(q));
  }, [indexedSheetRows, search, sheetArchive, sheetStyles]);

  const archivedSheetRows = useMemo(() => {
    const archivedRows = indexedSheetRows.filter(({ sourceIdx }) => sourceIdx > 0 && isArchiveRow(sourceIdx));
    if (!search.trim()) return archivedRows;
    const q = search.trim().toLowerCase();
    return archivedRows.filter(({ row }) => row.join(" ").toLowerCase().includes(q));
  }, [indexedSheetRows, search, sheetArchive, sheetStyles]);

  const archiveCount = indexedSheetRows.filter(({ sourceIdx }) => sourceIdx > 0 && isArchiveRow(sourceIdx)).length;

  return (
    <div className="min-h-screen bg-slate-50">
      <CrmNav title="Сделки" />
      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 py-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 mb-4 flex gap-3 flex-wrap">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по клиенту, описанию и архиву..."
            className="input-field max-w-md"
          />
          <button onClick={runSyncNow} disabled={syncing} className="btn-secondary">
            {syncing ? "Синхронизация..." : "Синхронизировать сейчас"}
          </button>
          <div className="flex items-center gap-1 rounded-lg border border-slate-200 p-1 bg-slate-50">
            <button
              onClick={() => setViewMode("kanban")}
              className={`px-2 py-1 text-xs rounded ${viewMode === "kanban" ? "bg-slate-900 text-white" : "text-slate-600"}`}
            >
              Воронка
            </button>
            <button
              onClick={() => setViewMode("table")}
              className={`px-2 py-1 text-xs rounded ${viewMode === "table" ? "bg-slate-900 text-white" : "text-slate-600"}`}
            >
              Таблица
            </button>
            <button
              onClick={() => setViewMode("archive")}
              className={`px-2 py-1 text-xs rounded ${viewMode === "archive" ? "bg-slate-900 text-white" : "text-slate-600"}`}
            >
              Архив{archiveCount ? ` ${archiveCount}` : ""}
            </button>
          </div>
          <div className="flex items-center gap-1 rounded-lg border border-slate-200 p-1 bg-slate-50">
            <button
              onClick={() => setEditMode("value")}
              className={`px-2 py-1 text-xs rounded ${editMode === "value" ? "bg-indigo-600 text-white" : "text-slate-600"}`}
            >
              Режим: ячейки
            </button>
            <button
              onClick={() => setEditMode("comment")}
              className={`px-2 py-1 text-xs rounded ${editMode === "comment" ? "bg-indigo-600 text-white" : "text-slate-600"}`}
            >
              Режим: комментарии
            </button>
          </div>
          <div className="text-xs text-slate-500 self-center">
            Автообновление раз в минуту, поиск работает сразу по таблице и архиву
          </div>
          {(savingComment || savingCell) && (
            <div className="text-xs text-indigo-600 self-center">
              {savingComment ? "Сохраняю комментарий..." : "Сохраняю изменения..."}
            </div>
          )}
          {savingKanban && (
            <div className="text-xs text-indigo-600 self-center">Сохраняю воронку...</div>
          )}
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 text-red-700 px-4 py-2 text-sm">
            {error}
          </div>
        )}

        {viewMode === "kanban" && (
          <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-slate-900">CPM-воронка клиентов</h2>
                <p className="text-xs text-slate-500">
                  Этапы скопированы из Bitrix24. Колонки можно переименовывать, удалять, добавлять и перетаскивать.
                </p>
              </div>
              <button onClick={createStage} className="btn-primary inline-flex items-center gap-2" type="button">
                + Добавить колонку
              </button>
            </div>
            {kanbanLoading ? (
              <div className="p-4 text-sm text-slate-500">Загрузка воронки...</div>
            ) : (
              <KanbanBoard
                stages={kanbanStages}
                items={kanbanItems}
                onStageChange={moveKanbanItem}
                onCardClick={(item) => {
                  const dealItem = item as DealKanbanItem;
                  if (typeof dealItem.source_row === "number") {
                    setViewMode("table");
                    setSearch(dealItem.title);
                  }
                }}
                onAdd={() => setError("Новые сделки пока создаются через таблицу или синхронизацию. Колонки уже можно создавать кнопкой «Добавить колонку».")}
                onStageCreate={createStage}
                onStageUpdate={updateStage}
                onStageDelete={deleteStage}
                onStageReorder={reorderStage}
                renderCard={(item) => {
                  const dealItem = item as DealKanbanItem;
                  return (
                    <>
                      {dealItem.amount != null && (
                        <div className="text-xs font-semibold text-emerald-600">{dealItem.amount.toLocaleString("ru-RU")} ₽</div>
                      )}
                      {(dealItem.client || dealItem.description) && (
                        <div className="mt-1 line-clamp-2 text-xs text-slate-500">{dealItem.client || dealItem.description}</div>
                      )}
                      {showCardSource(dealItem) && (
                        <div className="mt-2 text-[11px] font-medium text-slate-400">{showCardSource(dealItem)}</div>
                      )}
                    </>
                  );
                }}
              />
            )}
          </div>
        )}

        <div className={`${viewMode === "table" ? "block" : "hidden"} bg-white rounded-2xl border border-slate-200 overflow-hidden`}>
          {loading ? (
            <div className="p-4 text-sm text-slate-500">Загрузка сделок...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[12px] leading-tight min-w-[2140px]">
                <tbody>
                  {visibleSheetRows.map(({ row, sourceIdx }) => (
                    <tr
                      key={`${sourceIdx}-${row.join("|")}`}
                      className={sourceIdx === 0 ? "bg-sky-100 text-slate-900 font-semibold" : rowTone(row[2] ?? "")}
                    >
                      <td className="px-2 py-1.5 border border-slate-200 text-slate-500 bg-slate-100 font-medium text-center sticky left-0 z-10">
                        {sourceIdx + 1}
                      </td>
                      {Array.from({ length: 37 }).map((_, colIdx) => (
                        (() => {
                          const noteKey = `${sourceIdx}:${colIdx}`;
                          const localKey = `${DEALS_GID}:${sourceIdx}:${colIdx}`;
                          const nativeNote = sheetNotes[noteKey];
                          const customNotes = localComments[localKey] ?? [];
                          const overrideValue = localOverrides[localKey];
                          const tooltip = [
                            nativeNote ? `Комментарий таблицы:\n${nativeNote}` : "",
                            ...customNotes.map((c) => `${c.author} (${new Date(c.created_at).toLocaleString("ru-RU")}):\n${c.text}`),
                          ]
                            .filter(Boolean)
                            .join("\n\n");
                          const hasComments = Boolean(nativeNote) || customNotes.length > 0;
                          return (
                        <td
                          key={`${sourceIdx}-${colIdx}`}
                          className="px-2 py-1.5 border border-slate-200 text-slate-700 whitespace-nowrap relative"
                          title={tooltip}
                          style={{
                            backgroundColor: sheetStyles[noteKey]?.bg,
                            color: sheetStyles[noteKey]?.fg,
                          }}
                          onDoubleClick={() => {
                            if (editMode === "comment") addComment(sourceIdx, colIdx);
                          }}
                          onClick={() => {
                            if (editMode !== "value" || sourceIdx === 0) return;
                            setActiveCell({ row: sourceIdx, col: colIdx });
                            setEditValue(String(overrideValue ?? row[colIdx] ?? ""));
                          }}
                        >
                          {activeCell?.row === sourceIdx && activeCell?.col === colIdx && editMode === "value" ? (
                            <input
                              autoFocus
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                              onBlur={() => saveCellValue(sourceIdx, colIdx, editValue)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  saveCellValue(sourceIdx, colIdx, editValue);
                                }
                                if (e.key === "Escape") {
                                  e.preventDefault();
                                  setActiveCell(null);
                                }
                              }}
                              className="w-full min-w-[80px] bg-white border border-indigo-300 rounded px-1 py-0.5 text-[12px] text-slate-800"
                            />
                          ) : (
                            <>{overrideValue ?? row[colIdx] ?? ""}</>
                          )}
                          {typeof overrideValue === "string" && (
                            <span className="ml-1 text-[10px] text-violet-600 align-top">✎</span>
                          )}
                          {hasComments && (
                            <>
                              <span className="absolute top-0 right-0 w-0 h-0 border-l-[8px] border-l-transparent border-t-[8px] border-t-indigo-500" />
                              <span className="ml-1 text-[10px] text-indigo-600 align-top">💬</span>
                            </>
                          )}
                        </td>
                          );
                        })()
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className={`${viewMode === "archive" ? "block" : "hidden"} bg-white rounded-2xl border border-slate-200 overflow-hidden`}>
          {loading ? (
            <div className="p-4 text-sm text-slate-500">Загрузка архива...</div>
          ) : archivedSheetRows.length === 0 ? (
            <div className="p-6 text-sm text-slate-500">
              В архиве нет строк по текущему поиску. Серые строки из таблицы будут попадать сюда автоматически.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[12px] leading-tight min-w-[2260px]">
                <tbody>
                  {archivedSheetRows.map(({ row, sourceIdx }) => (
                    <tr key={`archive-${sourceIdx}-${row.join("|")}`} className="bg-slate-100 text-slate-600">
                      <td className="sticky left-0 z-10 border border-slate-200 bg-slate-200 px-2 py-1.5 text-center font-medium text-slate-600">
                        {sourceIdx + 1}
                      </td>
                      <td className="sticky left-10 z-10 border border-slate-200 bg-slate-100 px-2 py-1.5">
                        <button
                          onClick={() => restoreArchiveRow(sourceIdx)}
                          className="rounded-md border border-emerald-200 bg-white px-2 py-1 text-[11px] font-semibold text-emerald-700 transition hover:bg-emerald-50"
                          type="button"
                        >
                          Вернуть в работу
                        </button>
                      </td>
                      {Array.from({ length: 37 }).map((_, colIdx) => {
                        const noteKey = `${sourceIdx}:${colIdx}`;
                        const localKey = `${DEALS_GID}:${sourceIdx}:${colIdx}`;
                        const nativeNote = sheetNotes[noteKey];
                        const customNotes = localComments[localKey] ?? [];
                        const overrideValue = localOverrides[localKey];
                        const tooltip = [
                          nativeNote ? `Комментарий таблицы:\n${nativeNote}` : "",
                          ...customNotes.map((c) => `${c.author} (${new Date(c.created_at).toLocaleString("ru-RU")}):\n${c.text}`),
                        ]
                          .filter(Boolean)
                          .join("\n\n");
                        const hasComments = Boolean(nativeNote) || customNotes.length > 0;
                        return (
                          <td
                            key={`archive-${sourceIdx}-${colIdx}`}
                            className="relative whitespace-nowrap border border-slate-200 px-2 py-1.5 text-slate-600"
                            title={tooltip}
                            style={{
                              backgroundColor: sheetStyles[noteKey]?.bg ?? "#f1f5f9",
                              color: sheetStyles[noteKey]?.fg,
                            }}
                          >
                            {overrideValue ?? row[colIdx] ?? ""}
                            {typeof overrideValue === "string" && (
                              <span className="ml-1 text-[10px] text-violet-600 align-top">✎</span>
                            )}
                            {hasComments && (
                              <span className="ml-1 text-[10px] text-indigo-600 align-top">💬</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
