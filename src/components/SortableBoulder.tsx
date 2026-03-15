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

Generate specific, actionable tasks for this phase of the project.

Return ONLY a valid JSON array of task strings, no explanation, no markdown, no backticks:
["Task 1", "Task 2", "Task 3", "Task 4"]

Rules:
- 3 to 5 tasks
- Each task must be specific to both the project idea AND this phase
- Use the same language as the project idea
- No generic tasks`);

      const tasks = parseJsonArray(raw);
      const pebbles: Pebble[] = tasks.map((text: string) => ({
        id: generateId(), text, status: 'todo' as Pebble['status'],
      }));
      onReplacePebbles(boulder.id, pebbles);
      toast.success(`Pebbles generated for "${boulder.title}"!`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Terjadi kesalahan';
      toast.error(`Hammer gagal: ${message}`);
    } finally {
      setIsHammering(false);
    }
  };

  const refinePebbles = async () => {
    if (!refinePrompt.trim()) return;
    setIsRefining(true);
    try {
      const existingTasks = boulder.pebbles.map(p => p.text).join('\n');
      const raw = await callGemini(`You are a project planning assistant.

Project idea: "${spark}"
Phase/Boulder: "${boulder.title}"
Current tasks:
${existingTasks}

User feedback: "${refinePrompt}"

Revise the task list based on the feedback above.

Return ONLY a valid JSON array of task strings, no explanation, no markdown, no backticks:
["Task 1", "Task 2", "Task 3"]

Rules:
- Apply the user's feedback to improve the tasks
- Keep tasks specific to the project and phase
- Use the same language as the project idea`);

      const tasks = parseJsonArray(raw);
      const pebbles: Pebble[] = tasks.map((text: string) => ({
        id: generateId(), text, status: 'todo' as Pebble['status'],
      }));
      onReplacePebbles(boulder.id, pebbles);
      setRefinePrompt('');
      setShowRefineInput(false);
      toast.success('Pebbles refined!');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Terjadi kesalahan';
      toast.error(`Refinement gagal: ${message}`);
    } finally {
      setIsRefining(false);
    }
  };

  const addMorePebbles = async () => {
    setIsAdding(true);
    try {
      const existingTasks = boulder.pebbles.map(p => p.text).join('\n');
      const raw = await callGemini(`You are a project planning assistant.

Project idea: "${spark}"
Phase/Boulder: "${boulder.title}"
Existing tasks (DO NOT repeat these):
${existingTasks}

Generate additional tasks for this phase that complement the existing ones.

Return ONLY a valid JSON array of task strings, no explanation, no markdown, no backticks:
["New Task 1", "New Task 2"]

Rules:
- 2 to 3 new tasks only
- Must be different from existing tasks
- Must be specific to the project and phase
- Use the same language as the project idea`);

      const tasks = parseJsonArray(raw);
      const pebbles: Pebble[] = tasks.map((text: string) => ({
        id: generateId(), text, status: 'todo' as Pebble['status'],
      }));
      onAddPebbles(boulder.id, pebbles);
      toast.success(`${pebbles.length} pebbles added!`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Terjadi kesalahan';
      toast.error(`Gagal tambah pebbles: ${message}`);
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
    <div ref={setNodeRef} style={style} className="bg-card border border-border rounded-lg p-5">
      {/* Boulder header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {!readOnly && (
            <button {...attributes} {...listeners} className="cursor-grab text-muted-foreground hover:text-foreground touch-none">
              <GripVertical size={16} />
            </button>
          )}
          {editingTitle ? (
            <form onSubmit={(e) => { e.preventDefault(); const t = titleText.trim(); if (t && t !== boulder.title) onEditBoulder(t); setEditingTitle(false); }} className="flex items-center gap-1">
              <input type="text" value={titleText} onChange={(e) => setTitleText(e.target.value)} autoFocus className="px-2 py-0.5 text-xl bg-background border border-border rounded font-display focus:outline-none focus:ring-1 focus:ring-ring/30" />
              <button type="submit" className="text-primary hover:text-primary/80"><Check size={14} /></button>
              <button type="button" onClick={() => { setTitleText(boulder.title); setEditingTitle(false); }} className="text-muted-foreground hover:text-foreground"><X size={14} /></button>
            </form>
          ) : (
            <div className="flex items-center gap-1 group/title">
              <h3 className="font-display text-xl text-foreground">{boulder.title}</h3>
              {!readOnly && (
                <button onClick={() => { setTitleText(boulder.title); setEditingTitle(true); }} className="text-muted-foreground hover:text-foreground opacity-0 group-hover/title:opacity-100 transition-opacity">
                  <Pencil size={12} />
                </button>
              )}
            </div>
          )}
        </div>

        {!readOnly && (
          <div className="flex items-center gap-1.5">
            <button onClick={hammerBoulder} disabled={isHammering} title="Generate pebbles with AI"
              className="flex items-center gap-1 px-2 py-1 text-xs font-body text-muted-foreground hover:text-foreground hover:bg-secondary/80 rounded-md transition-colors disabled:opacity-50">
              <Hammer size={12} className={isHammering ? 'animate-bounce' : ''} />
              {isHammering ? 'Hammering…' : 'Hammer'}
            </button>

            {boulder.pebbles.length > 0 && (
              <button onClick={() => setShowRefineInput(!showRefineInput)} title="Refine pebbles with feedback"
                className="flex items-center gap-1 px-2 py-1 text-xs font-body text-muted-foreground hover:text-foreground hover:bg-secondary/80 rounded-md transition-colors">
                <RefreshCw size={12} />
                Refine
              </button>
            )}

            {boulder.pebbles.length > 0 && (
              <button onClick={addMorePebbles} disabled={isAdding} title="Add more pebbles with AI"
                className="flex items-center gap-1 px-2 py-1 text-xs font-body text-muted-foreground hover:text-foreground hover:bg-secondary/80 rounded-md transition-colors disabled:opacity-50">
                <Sparkles size={12} className={isAdding ? 'animate-pulse' : ''} />
                {isAdding ? 'Adding…' : 'More'}
              </button>
            )}

            <ConfirmDialog
              trigger={
                <button className="text-muted-foreground hover:text-destructive transition-colors p-1">
                  <Trash2 size={14} />
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

      {/* Refine input */}
      {showRefineInput && (
        <div className="mb-3 flex gap-2">
          <input type="text" value={refinePrompt} onChange={(e) => setRefinePrompt(e.target.value)}
            placeholder="Describe what to change, e.g. 'more technical', 'focus on design'…"
            className="flex-1 px-3 py-1.5 text-sm bg-background border border-border rounded-md font-body placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring/30"
            onKeyDown={(e) => e.key === 'Enter' && refinePebbles()} autoFocus />
          <button onClick={refinePebbles} disabled={isRefining || !refinePrompt.trim()}
            className="px-3 py-1.5 text-sm font-body bg-primary text-primary-foreground rounded-md hover:opacity-90 transition-opacity disabled:opacity-50">
            {isRefining ? 'Refining…' : 'Apply'}
          </button>
          <button onClick={() => { setShowRefineInput(false); setRefinePrompt(''); }}
            className="px-2 py-1.5 text-sm font-body text-muted-foreground hover:text-foreground">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Pebble list */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handlePebbleDragEnd}>
        <SortableContext items={boulder.pebbles.map(p => p.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {boulder.pebbles.map(pebble => (
              <SortablePebble
                key={pebble.id}
                pebble={pebble}
                spark={spark}                  // ✅ pass spark
                boulderTitle={boulder.title}   // ✅ pass boulder title
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

      {/* Add pebble manual */}
      {!readOnly && (
        <form onSubmit={(e) => { e.preventDefault(); onAddPebble(); }} className="mt-3 flex gap-2">
          <input type="text" value={newPebbleText} onChange={(e) => onNewPebbleTextChange(e.target.value)}
            placeholder="Add a pebble…"
            className="flex-1 px-3 py-1.5 text-sm bg-background border border-border rounded-md font-body placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring/30" />
          <button type="submit" className="px-3 py-1.5 text-sm font-body bg-secondary text-secondary-foreground rounded-md hover:opacity-80 transition-opacity">
            <Plus size={14} />
          </button>
        </form>
      )}
    </div>
  );
};

export default SortableBoulder;