import { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Boulder, Pebble } from '@/lib/types';
import { Trash2, Plus, GripVertical, Pencil, Check, X, Hammer, RefreshCw, Sparkles } from 'lucide-react';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import SortablePebble from './SortablePebble';
import ConfirmDialog from './ConfirmDialog';
import { generateId } from '@/lib/store';
import { toast } from 'sonner';

interface SortableBoulderProps {
  boulder: Boulder;
  spark: string;
  readOnly?: boolean;
  newPebbleText: string;
  onNewPebbleTextChange: (text: string) => void;
  onAddPebble: () => void;
  onDeleteBoulder: () => void;
  onEditBoulder: (newTitle: string) => void;
  onTogglePebble: (pebbleId: string) => void;
  onDeletePebble: (pebbleId: string) => void;
  onEditPebble: (pebbleId: string, newText: string) => void;
  onUpdatePebble: (pebbleId: string, updates: Partial<Pebble>) => void;
  onReorderPebbles: (boulderId: string, pebbles: Pebble[]) => void;
  onReplacePebbles: (boulderId: string, pebbles: Pebble[]) => void;
  onAddPebbles: (boulderId: string, pebbles: Pebble[]) => void;
  hidden?: boolean;
  onFocusPebble?: (pebbleId: string | null) => void;
  focusedPebbleId?: string | null;
}

async function callGemini(prompt: string): Promise<string> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) throw new Error('API key tidak ditemukan. Cek file .env kamu!');

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 2000 },
      }),
    }
  );

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err?.error?.message || 'Request ke Gemini API gagal');
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

function parseJsonArray(raw: string): string[] {
  const match = raw.match(/\[[\s\S]*\]/);
  if (!match) throw new Error('Tidak ada JSON array ditemukan di response');
  return JSON.parse(match[0]);
}

const SortableBoulder = ({
  boulder, spark, readOnly, newPebbleText, onNewPebbleTextChange,
  onAddPebble, onDeleteBoulder, onEditBoulder, onTogglePebble, onDeletePebble, onEditPebble,
  onUpdatePebble, onReorderPebbles, onReplacePebbles, onAddPebbles, hidden, onFocusPebble, focusedPebbleId,
}: SortableBoulderProps) => {
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleText, setTitleText] = useState(boulder.title);
  const [isHammering, setIsHammering] = useState(false);
  const [isRefining, setIsRefining] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [refinePrompt, setRefinePrompt] = useState('');
  const [showRefineInput, setShowRefineInput] = useState(false);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: boulder.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const hammerBoulder = async () => {
    setIsHammering(true);
    try {
      const raw = await callGemini(`You are a project planning assistant.
Project idea: "${spark}"
Phase/Boulder: "${boulder.title}"
Generate specific, actionable tasks for this phase.
Return ONLY a valid JSON array of task strings, no explanation, no markdown, no backticks:
["Task 1", "Task 2", "Task 3"]
Rules: 3-5 tasks, specific to project and phase, use same language as project idea.`);
      const tasks = parseJsonArray(raw);
      const pebbles: Pebble[] = tasks.map((text: string) => ({ id: generateId(), text, status: 'todo' as Pebble['status'] }));
      onReplacePebbles(boulder.id, pebbles);
      toast.success('Pebbles generated!');
    } catch (err: unknown) {
      toast.error(`Hammer gagal: ${err instanceof Error ? err.message : 'Error'}`);
    } finally {
      setIsHammering(false);
    }
  };

  const refinePebbles = async () => {
    if (!refinePrompt.trim()) return;
    setIsRefining(true);
    try {
      const existingTasks = boulder.pebbles.map(p => p.text).join('\n');
      const raw = await callGemini(`Project: "${spark}", Phase: "${boulder.title}"
Current tasks:\n${existingTasks}
User feedback: "${refinePrompt}"
Revise tasks based on feedback. Return ONLY JSON array: ["Task 1", "Task 2"]
Use same language as project idea.`);
      const tasks = parseJsonArray(raw);
      const pebbles: Pebble[] = tasks.map((text: string) => ({ id: generateId(), text, status: 'todo' as Pebble['status'] }));
      onReplacePebbles(boulder.id, pebbles);
      setRefinePrompt('');
      setShowRefineInput(false);
      toast.success('Pebbles refined!');
    } catch (err: unknown) {
      toast.error(`Refinement gagal: ${err instanceof Error ? err.message : 'Error'}`);
    } finally {
      setIsRefining(false);
    }
  };

  const addMorePebbles = async () => {
    setIsAdding(true);
    try {
      const existingTasks = boulder.pebbles.map(p => p.text).join('\n');
      const raw = await callGemini(`Project: "${spark}", Phase: "${boulder.title}"
Existing tasks (DO NOT repeat): ${existingTasks}
Add 2-3 new complementary tasks. Return ONLY JSON array: ["New Task 1", "New Task 2"]
Use same language as project idea.`);
      const tasks = parseJsonArray(raw);
      const pebbles: Pebble[] = tasks.map((text: string) => ({ id: generateId(), text, status: 'todo' as Pebble['status'] }));
      onAddPebbles(boulder.id, pebbles);
      toast.success(`${pebbles.length} pebbles added!`);
    } catch (err: unknown) {
      toast.error(`Gagal: ${err instanceof Error ? err.message : 'Error'}`);
    } finally {
      setIsAdding(false);
    }
  };

  const handlePebbleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = boulder.pebbles.findIndex(p => p.id === active.id);
      const newIndex = boulder.pebbles.findIndex(p => p.id === over.id);
      onReorderPebbles(boulder.id, arrayMove(boulder.pebbles, oldIndex, newIndex));
    }
  };

  if (hidden) return null;

  return (
    <div ref={setNodeRef} style={style} className="bg-card border border-border rounded-lg p-4">

      <div className="mb-3">
        <div className="flex items-start gap-2 w-full">
          {!readOnly && (
            <button {...attributes} {...listeners} className="cursor-grab text-muted-foreground hover:text-foreground touch-none mt-1 shrink-0">
              <GripVertical size={15} />
            </button>
          )}
          {editingTitle ? (
            <form onSubmit={(e) => { e.preventDefault(); const t = titleText.trim(); if (t && t !== boulder.title) onEditBoulder(t); setEditingTitle(false); }} className="flex items-center gap-1 flex-1">
              <input type="text" value={titleText} onChange={(e) => setTitleText(e.target.value)} autoFocus className="flex-1 min-w-0 px-2 py-0.5 text-base bg-background border border-border rounded font-display focus:outline-none focus:ring-1 focus:ring-ring/30" />
              <button type="submit" className="text-primary shrink-0"><Check size={14} /></button>
              <button type="button" onClick={() => { setTitleText(boulder.title); setEditingTitle(false); }} className="text-muted-foreground shrink-0"><X size={14} /></button>
            </form>
          ) : (
            <div className="flex items-start gap-1 group/title flex-1">
              <h3 className="font-display text-base sm:text-xl text-foreground leading-snug flex-1">{boulder.title}</h3>
              {!readOnly && (
                <button onClick={() => { setTitleText(boulder.title); setEditingTitle(true); }} className="text-muted-foreground hover:text-foreground opacity-0 group-hover/title:opacity-100 transition-opacity shrink-0 mt-0.5">
                  <Pencil size={11} />
                </button>
              )}
            </div>
          )}
        </div>

        {!readOnly && (
          <div className="flex items-center gap-1 mt-2 ml-5">
            <button onClick={hammerBoulder} disabled={isHammering}
              className="flex items-center gap-1 px-2 py-1 text-[11px] font-body text-muted-foreground hover:text-foreground hover:bg-secondary/80 rounded-md transition-colors disabled:opacity-50">
              <Hammer size={11} className={isHammering ? 'animate-bounce' : ''} />
              {isHammering ? 'Hammering…' : 'Hammer'}
            </button>

            {boulder.pebbles.length > 0 && (
              <button onClick={() => setShowRefineInput(!showRefineInput)}
                className="flex items-center gap-1 px-2 py-1 text-[11px] font-body text-muted-foreground hover:text-foreground hover:bg-secondary/80 rounded-md transition-colors">
                <RefreshCw size={11} />
                Refine
              </button>
            )}

            {boulder.pebbles.length > 0 && (
              <button onClick={addMorePebbles} disabled={isAdding}
                className="flex items-center gap-1 px-2 py-1 text-[11px] font-body text-muted-foreground hover:text-foreground hover:bg-secondary/80 rounded-md transition-colors disabled:opacity-50">
                <Sparkles size={11} className={isAdding ? 'animate-pulse' : ''} />
                {isAdding ? 'Adding…' : 'More'}
              </button>
            )}

            <ConfirmDialog
              trigger={
                <button className="text-muted-foreground hover:text-destructive transition-colors p-1 ml-auto">
                  <Trash2 size={12} />
                </button>
              }
              title="Delete boulder?"
              description={`"${boulder.title}" and all its pebbles will be permanently removed.`}
              confirmLabel="Delete"
              onConfirm={onDeleteBoulder}
            />
          </div>
        )}
      </div>

      {showRefineInput && (
        <div className="mb-3 flex gap-2">
          <input type="text" value={refinePrompt} onChange={(e) => setRefinePrompt(e.target.value)}
            placeholder="e.g. 'more technical', 'focus on design'…"
            className="flex-1 min-w-0 px-3 py-1.5 text-sm bg-background border border-border rounded-md font-body placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring/30"
            onKeyDown={(e) => e.key === 'Enter' && refinePebbles()} autoFocus />
          <button onClick={refinePebbles} disabled={isRefining || !refinePrompt.trim()}
            className="px-3 py-1.5 text-xs font-body bg-primary text-primary-foreground rounded-md hover:opacity-90 disabled:opacity-50 whitespace-nowrap shrink-0">
            {isRefining ? '…' : 'Apply'}
          </button>
          <button onClick={() => { setShowRefineInput(false); setRefinePrompt(''); }} className="shrink-0 text-muted-foreground hover:text-foreground">
            <X size={14} />
          </button>
        </div>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handlePebbleDragEnd}>
        <SortableContext items={boulder.pebbles.map(p => p.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {boulder.pebbles.map(pebble => (
              <SortablePebble
                key={pebble.id}
                pebble={pebble}
                spark={spark}
                boulderTitle={boulder.title}
                boulderPebbles={boulder.pebbles} // ✅ pass semua pebble di boulder ini
                readOnly={readOnly}
                onToggle={() => onTogglePebble(pebble.id)}
                onDelete={() => onDeletePebble(pebble.id)}
                onEdit={(newText) => onEditPebble(pebble.id, newText)}
                onUpdatePebble={(updates) => onUpdatePebble(pebble.id, updates)}
                onFocusMode={onFocusPebble ? () => onFocusPebble(focusedPebbleId === pebble.id ? null : pebble.id) : undefined}
                isFocused={focusedPebbleId === pebble.id}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {!readOnly && (
        <form onSubmit={(e) => { e.preventDefault(); onAddPebble(); }} className="mt-3 flex gap-2">
          <input type="text" value={newPebbleText} onChange={(e) => onNewPebbleTextChange(e.target.value)}
            placeholder="Add a pebble…"
            className="flex-1 min-w-0 px-3 py-1.5 text-sm bg-background border border-border rounded-md font-body placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring/30" />
          <button type="submit" className="px-3 py-1.5 text-sm font-body bg-secondary text-secondary-foreground rounded-md hover:opacity-80 shrink-0">
            <Plus size={14} />
          </button>
        </form>
      )}
    </div>
  );
};

export default SortableBoulder;