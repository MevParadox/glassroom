import { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Pebble } from '@/lib/types';
import { Trash2, GripVertical, Pencil, Check, X, ChevronDown, ChevronRight, Sparkles, Hammer } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ConfirmDialog from './ConfirmDialog';
import PebbleEditor from './PebbleEditor';
import { toast } from 'sonner';
import { callAIWithCredit, buildAnswerMessages } from '@/lib/ai';

const statusColors: Record<Pebble['status'], string> = {
  'todo': 'bg-muted text-muted-foreground',
  'in-progress': 'bg-primary/20 text-primary',
  'done': 'bg-primary text-primary-foreground',
};

const statusLabels: Record<Pebble['status'], string> = {
  'todo': 'To Do',
  'in-progress': 'In Progress',
  'done': 'Done',
};

interface SortablePebbleProps {
  pebble: Pebble;
  spark: string;
  boulderTitle: string;
  boulderPebbles: Pebble[];
  readOnly?: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onEdit: (newText: string) => void;
  onUpdatePebble: (updates: Partial<Pebble>) => void;
  onFocusMode?: () => void;
  isFocused?: boolean;
  onInsufficientCredits?: () => void;
  onCreditsChanged?: () => void;
}

const SortablePebble = ({
  pebble, spark, boulderTitle, boulderPebbles, readOnly,
  onToggle, onDelete, onEdit, onUpdatePebble, onFocusMode, isFocused,
  onInsufficientCredits, onCreditsChanged,
}: SortablePebbleProps) => {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(pebble.text);
  const [expanded, setExpanded] = useState(false);
  const [isAnswering, setIsAnswering] = useState(false);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: pebble.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  const handleSave = () => {
    const trimmed = editText.trim();
    if (trimmed && trimmed !== pebble.text) onEdit(trimmed);
    setEditing(false);
  };

  const handleToggleFocus = () => {
    const next = !pebble.focusToday;
    onUpdatePebble({ focusToday: next });
    toast(next ? '🔨 Added to The Anvil!' : 'Removed from The Anvil');
  };

  const handleAnswer = async () => {
    setIsAnswering(true);
    setExpanded(true);
    try {
      const contextPebbles = boulderPebbles
        .filter(p => p.id !== pebble.id && p.content)
        .map(p => `- "${p.text}": ${p.content?.substring(0, 150)}...`)
        .join('\n');

      const contextSection = contextPebbles
        ? `\nContext from other completed tasks in this phase:\n${contextPebbles}\n`
        : '';

      const messages = buildAnswerMessages(spark, boulderTitle, pebble.text, contextSection);
      const raw = await callAIWithCredit(messages, 'ANSWER', { temperature: 0.5, maxTokens: 8192 });
      const html = raw.replace(/```html|```/g, '').trim();
      onUpdatePebble({ content: html });
      toast.success('AI answer ready!');
      onCreditsChanged?.(); // ✅ refresh credit badge

    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error';
      if (message.startsWith('INSUFFICIENT_CREDITS')) {
        const remaining = message.split(':')[1] || '0';
        toast.error(`Not enough credits (${remaining} left).`);
        onInsufficientCredits?.();
      } else {
        toast.error(`Answer failed: ${message}`);
      }
    } finally {
      setIsAnswering(false);
    }
  };

  return (
    <div ref={setNodeRef} style={style} className={`border border-border rounded-lg shadow-sm transition-all ${
      pebble.focusToday ? 'bg-primary/5 border-primary/30 shadow-primary/10' : 'bg-card hover:shadow-md'
    } ${expanded ? 'shadow-md ring-1 ring-primary/10' : ''}`}>

      <div className="px-3 py-2.5">
        <div className="flex items-start gap-2">
          {!readOnly && (
            <button {...attributes} {...listeners} className="cursor-grab text-muted-foreground hover:text-foreground touch-none shrink-0 mt-0.5">
              <GripVertical size={13} />
            </button>
          )}
          <button onClick={() => setExpanded(!expanded)} className="text-muted-foreground hover:text-foreground shrink-0 transition-colors mt-0.5">
            {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          </button>

          {editing ? (
            <form onSubmit={(e) => { e.preventDefault(); handleSave(); }} className="flex items-center gap-1.5 flex-1">
              <input type="text" value={editText} onChange={(e) => setEditText(e.target.value)} autoFocus
                className="flex-1 min-w-0 px-2 py-0.5 text-sm bg-background border border-border rounded font-body focus:outline-none focus:ring-1 focus:ring-ring/30" />
              <button type="submit" className="text-primary shrink-0"><Check size={12} /></button>
              <button type="button" onClick={() => { setEditText(pebble.text); setEditing(false); }} className="text-muted-foreground shrink-0"><X size={12} /></button>
            </form>
          ) : (
            <span onClick={() => setExpanded(!expanded)}
              className={`font-body flex-1 cursor-pointer text-sm leading-snug ${pebble.status === 'done' ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
              {pebble.text}
            </span>
          )}
        </div>

        {!editing && (
          <div className="flex items-center gap-1.5 mt-2 ml-8 flex-wrap">
            <button onClick={() => !readOnly && onToggle()} disabled={readOnly}
              className={`px-2 py-0.5 text-[11px] rounded-full font-body transition-colors ${statusColors[pebble.status]}`}>
              {statusLabels[pebble.status]}
            </button>

            {!readOnly && (
              <button onClick={handleToggleFocus}
                title={pebble.focusToday ? 'Remove from The Anvil' : 'Add to The Anvil'}
                className={`flex items-center gap-1 px-2 py-0.5 text-[11px] font-body rounded-full transition-colors ${
                  pebble.focusToday ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary'
                }`}>
                <Hammer size={10} />
                {pebble.focusToday ? 'Anvil ✓' : 'Anvil'}
              </button>
            )}

            {!readOnly && (
              <button onClick={handleAnswer} disabled={isAnswering}
                className="flex items-center gap-1 px-2 py-0.5 text-[11px] font-body rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-50">
                <Sparkles size={10} className={isAnswering ? 'animate-pulse' : ''} />
                {isAnswering ? 'Answering…' : 'Answer'}
              </button>
            )}

            {!readOnly && (
              <>
                <button onClick={() => { setEditText(pebble.text); setEditing(true); }} className="text-muted-foreground hover:text-foreground p-0.5">
                  <Pencil size={11} />
                </button>
                <ConfirmDialog
                  trigger={<button className="text-muted-foreground hover:text-destructive p-0.5"><Trash2 size={11} /></button>}
                  title="Delete pebble?"
                  description={`"${pebble.text}" will be permanently removed.`}
                  confirmLabel="Delete"
                  onConfirm={onDelete}
                />
              </>
            )}
          </div>
        )}
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
            <div className="px-4 pb-4 border-t border-border pt-3">
              {isAnswering && (
                <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground font-body">
                  <Sparkles size={14} className="animate-pulse text-primary" />
                  AI is answering this task…
                </div>
              )}
              <PebbleEditor pebble={pebble} onUpdate={onUpdatePebble} onFocusMode={onFocusMode} isFocused={isFocused} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SortablePebble;