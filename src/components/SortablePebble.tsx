import { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Pebble } from '@/lib/types';
import { Trash2, GripVertical, Pencil, Check, X, ChevronDown, ChevronRight, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ConfirmDialog from './ConfirmDialog';
import PebbleEditor from './PebbleEditor';
import { toast } from 'sonner';

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
  spark: string;         // ← konteks project
  boulderTitle: string;  // ← konteks phase
  readOnly?: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onEdit: (newText: string) => void;
  onUpdatePebble: (updates: Partial<Pebble>) => void;
  onFocusMode?: () => void;
  isFocused?: boolean;
}

const SortablePebble = ({ pebble, spark, boulderTitle, readOnly, onToggle, onDelete, onEdit, onUpdatePebble, onFocusMode, isFocused }: SortablePebbleProps) => {
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

  // ✅ Fitur Answer: AI elaborasi task ini dan hasilnya masuk ke content pebble
  const handleAnswer = async () => {
    setIsAnswering(true);
    setExpanded(true); // buka editor sekalian

    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      if (!apiKey) throw new Error('API key tidak ditemukan');

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: `You are a knowledgeable assistant. A user is working on a project and needs a DIRECT ANSWER to a specific question or task.

                Project context: "${spark}"
                Current phase: "${boulderTitle}"
                Task/Question: "${pebble.text}"

                IMPORTANT: Do NOT give instructions, steps, or sub-tasks. 
                Give the ACTUAL ANSWER directly — as if you already know the answer and are sharing it.

                Example:
                - Task: "Tentukan poin masalah MBG spesifik" 
                - WRONG answer: "Identifikasi masalah, prioritaskan, tentukan sudut pandang..."
                - RIGHT answer: "Masalah utama MBG yang relevan antara lain: 1. Distribusi yang tidak merata ke daerah terpencil, 2. Kualitas gizi yang belum memenuhi standar, 3. Anggaran yang tidak transparan..."
                
                The length of your answer should match the complexity of the task.
                - Simple tasks (define something, list items): concise, 3-5 points
                - Complex tasks (write a script, create a plan): as long as needed to be complete
                - Never cut off mid-sentence. Always finish completely.
                
                Use the same language as the task.
                Format response in clean HTML using only: <p>, <ul>, <li>, <ol>, <strong>, <em>
                Be direct, specific, and informative. No code fences, raw HTML only.`,
              }],
            }],
            generationConfig: { temperature: 0.7, maxOutputTokens: 8192 },
          }),
        }
      );

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err?.error?.message || 'Request ke Gemini gagal');
      }

      const data = await response.json();
      const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

      // Bersihkan kalau ada code fence
      const html = raw.replace(/```html|```/g, '').trim();

      // Simpan ke content pebble (akan muncul di PebbleEditor)
      onUpdatePebble({ content: html });
      toast.success('AI answer ready!');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Terjadi kesalahan';
      toast.error(`Answer gagal: ${message}`);
    } finally {
      setIsAnswering(false);
    }
  };

  return (
    <div ref={setNodeRef} style={style} className={`bg-card border border-border rounded-lg shadow-sm transition-shadow ${expanded ? 'shadow-md ring-1 ring-primary/10' : 'hover:shadow-md'}`}>
      {/* Collapsed header */}
      <div className="flex items-center gap-3 px-4 py-3 group">
        {!readOnly && (
          <button {...attributes} {...listeners} className="cursor-grab text-muted-foreground hover:text-foreground touch-none shrink-0">
            <GripVertical size={14} />
          </button>
        )}
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-muted-foreground hover:text-foreground shrink-0 transition-colors"
        >
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>

        {editing ? (
          <form onSubmit={(e) => { e.preventDefault(); handleSave(); }} className="flex items-center gap-1.5 flex-1">
            <input
              type="text"
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              autoFocus
              className="flex-1 px-2 py-0.5 text-sm bg-background border border-border rounded font-body focus:outline-none focus:ring-1 focus:ring-ring/30"
            />
            <button type="submit" className="text-primary hover:text-primary/80"><Check size={12} /></button>
            <button type="button" onClick={() => { setEditText(pebble.text); setEditing(false); }} className="text-muted-foreground hover:text-foreground"><X size={12} /></button>
          </form>
        ) : (
          <span
            onClick={() => setExpanded(!expanded)}
            className={`font-body flex-1 cursor-pointer text-sm ${pebble.status === 'done' ? 'line-through text-muted-foreground' : 'text-foreground'}`}
          >
            {pebble.text}
          </span>
        )}

        <button
          onClick={() => !readOnly && onToggle()}
          disabled={readOnly}
          className={`px-2.5 py-1 text-[11px] rounded-full font-body transition-colors shrink-0 ${statusColors[pebble.status]}`}
        >
          {statusLabels[pebble.status]}
        </button>

        {!readOnly && !editing && (
          <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-all shrink-0">
            {/* ✅ Tombol Answer */}
            <button
              onClick={handleAnswer}
              disabled={isAnswering}
              title="Ask AI to answer this task"
              className="flex items-center gap-1 px-2 py-0.5 text-[11px] font-body rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-50"
            >
              <Sparkles size={10} className={isAnswering ? 'animate-pulse' : ''} />
              {isAnswering ? 'Answering…' : 'Answer'}
            </button>

            <button
              onClick={(e) => { e.stopPropagation(); setEditText(pebble.text); setEditing(true); }}
              className="text-muted-foreground hover:text-foreground"
            >
              <Pencil size={12} />
            </button>
            <ConfirmDialog
              trigger={
                <button className="text-muted-foreground hover:text-destructive">
                  <Trash2 size={12} />
                </button>
              }
              title="Delete pebble?"
              description={`"${pebble.text}" will be permanently removed.`}
              confirmLabel="Delete"
              onConfirm={onDelete}
            />
          </div>
        )}
      </div>

      {/* Expanded content */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 border-t border-border pt-3">
              {isAnswering && (
                <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground font-body">
                  <Sparkles size={14} className="animate-pulse text-primary" />
                  AI sedang menjawab task ini…
                </div>
              )}
              <PebbleEditor
                pebble={pebble}
                onUpdate={onUpdatePebble}
                onFocusMode={onFocusMode}
                isFocused={isFocused}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SortablePebble;