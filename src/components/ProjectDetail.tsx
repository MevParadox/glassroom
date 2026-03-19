import { useState } from 'react';
import { Project, Boulder, Pebble } from '@/lib/types';
import { generateId } from '@/lib/store';
import { ArrowLeft, Archive, Plus, Pencil, Check, X, Flame } from 'lucide-react';
import { motion } from 'framer-motion';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import AutoHammer from './AutoHammer';
import SortableBoulder from './SortableBoulder';
import ForgeModal from './ForgeModal';

interface ProjectDetailProps {
  project: Project;
  onBack: () => void;
  onUpdate: (project: Project) => void;
  onArchive: () => void;
  readOnly?: boolean;
}

const nextStatus: Record<Pebble['status'], Pebble['status']> = {
  'todo': 'in-progress',
  'in-progress': 'done',
  'done': 'todo',
};

const ProjectDetail = ({ project, onBack, onUpdate, onArchive, readOnly }: ProjectDetailProps) => {
  const [newBoulderTitle, setNewBoulderTitle] = useState('');
  const [newPebbleTexts, setNewPebbleTexts] = useState<Record<string, string>>({});
  const [editingSpark, setEditingSpark] = useState(false);
  const [sparkText, setSparkText] = useState(project.spark);
  const [focusedPebbleId, setFocusedPebbleId] = useState<string | null>(null);
  const [showForge, setShowForge] = useState(false);

  const totalPebbles = project.boulders.reduce((sum, b) => sum + b.pebbles.length, 0);
  const donePebbles = project.boulders.reduce((sum, b) => sum + b.pebbles.filter(p => p.status === 'done').length, 0);
  const allDone = totalPebbles > 0 && donePebbles === totalPebbles;

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const addBoulder = () => {
    const title = newBoulderTitle.trim();
    if (!title) return;
    const boulder: Boulder = { id: generateId(), title, pebbles: [] };
    onUpdate({ ...project, boulders: [...project.boulders, boulder] });
    setNewBoulderTitle('');
  };

  const deleteBoulder = (boulderId: string) => {
    onUpdate({ ...project, boulders: project.boulders.filter(b => b.id !== boulderId) });
  };

  const addPebble = (boulderId: string) => {
    const text = (newPebbleTexts[boulderId] || '').trim();
    if (!text) return;
    const pebble: Pebble = { id: generateId(), text, status: 'todo' };
    onUpdate({
      ...project,
      boulders: project.boulders.map(b =>
        b.id === boulderId ? { ...b, pebbles: [...b.pebbles, pebble] } : b
      ),
    });
    setNewPebbleTexts(prev => ({ ...prev, [boulderId]: '' }));
  };

  const togglePebble = (boulderId: string, pebbleId: string) => {
    onUpdate({
      ...project,
      boulders: project.boulders.map(b =>
        b.id === boulderId
          ? { ...b, pebbles: b.pebbles.map(p => p.id === pebbleId ? { ...p, status: nextStatus[p.status] } : p) }
          : b
      ),
    });
  };

  const deletePebble = (boulderId: string, pebbleId: string) => {
    onUpdate({
      ...project,
      boulders: project.boulders.map(b =>
        b.id === boulderId ? { ...b, pebbles: b.pebbles.filter(p => p.id !== pebbleId) } : b
      ),
    });
  };

  const editPebble = (boulderId: string, pebbleId: string, newText: string) => {
    onUpdate({
      ...project,
      boulders: project.boulders.map(b =>
        b.id === boulderId
          ? { ...b, pebbles: b.pebbles.map(p => p.id === pebbleId ? { ...p, text: newText } : p) }
          : b
      ),
    });
  };

  const editBoulder = (boulderId: string, newTitle: string) => {
    onUpdate({
      ...project,
      boulders: project.boulders.map(b =>
        b.id === boulderId ? { ...b, title: newTitle } : b
      ),
    });
  };

  const updatePebble = (boulderId: string, pebbleId: string, updates: Partial<Pebble>) => {
    onUpdate({
      ...project,
      boulders: project.boulders.map(b =>
        b.id === boulderId
          ? { ...b, pebbles: b.pebbles.map(p => p.id === pebbleId ? { ...p, ...updates } : p) }
          : b
      ),
    });
  };

  const replacePebbles = (boulderId: string, pebbles: Pebble[]) => {
    onUpdate({
      ...project,
      boulders: project.boulders.map(b =>
        b.id === boulderId ? { ...b, pebbles } : b
      ),
    });
  };

  const addPebbles = (boulderId: string, newPebbles: Pebble[]) => {
    onUpdate({
      ...project,
      boulders: project.boulders.map(b =>
        b.id === boulderId ? { ...b, pebbles: [...b.pebbles, ...newPebbles] } : b
      ),
    });
  };

  const handleBoulderDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = project.boulders.findIndex(b => b.id === active.id);
      const newIndex = project.boulders.findIndex(b => b.id === over.id);
      onUpdate({ ...project, boulders: arrayMove(project.boulders, oldIndex, newIndex) });
    }
  };

  const handleReorderPebbles = (boulderId: string, pebbles: Pebble[]) => {
    onUpdate({
      ...project,
      boulders: project.boulders.map(b => b.id === boulderId ? { ...b, pebbles } : b),
    });
  };

  const focusedBoulderId = focusedPebbleId
    ? project.boulders.find(b => b.pebbles.some(p => p.id === focusedPebbleId))?.id || null
    : null;

  return (
    <div className="space-y-4">
      {/* Back + Archive */}
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground font-body transition-colors">
          <ArrowLeft size={16} /> Back
        </button>
        <div className="flex items-center gap-2">
          {/* ✅ Forge button — selalu tampil kalau ada boulder */}
          {!readOnly && project.boulders.length > 0 && (
            <button
              onClick={() => setShowForge(true)}
              title="Forge Final Draft — export project jadi dokumen"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-body text-primary border border-primary/30 bg-primary/5 hover:bg-primary/10 rounded-md transition-colors"
            >
              <Flame size={13} />
              Forge
            </button>
          )}
          {!readOnly && allDone && (
            <button onClick={onArchive} className="flex items-center gap-2 px-3 py-1.5 text-xs sm:text-sm font-body bg-primary text-primary-foreground rounded-md hover:opacity-90 transition-opacity">
              <Archive size={13} /> Archive
            </button>
          )}
        </div>
      </div>

      {/* Spark title + Auto Hammer */}
      <div>
        <div className="flex items-start justify-between gap-3">
          {editingSpark && !readOnly ? (
            <form onSubmit={(e) => { e.preventDefault(); const t = sparkText.trim(); if (t) { onUpdate({ ...project, spark: t }); } setEditingSpark(false); }} className="flex items-center gap-2 flex-1">
              <input type="text" value={sparkText} onChange={(e) => setSparkText(e.target.value)} autoFocus className="flex-1 px-2 py-1 text-xl bg-background border border-border rounded font-display focus:outline-none focus:ring-1 focus:ring-ring/30" />
              <button type="submit" className="text-primary hover:text-primary/80 transition-colors"><Check size={16} /></button>
              <button type="button" onClick={() => { setSparkText(project.spark); setEditingSpark(false); }} className="text-muted-foreground hover:text-foreground transition-colors"><X size={16} /></button>
            </form>
          ) : (
            <div className="flex items-start gap-2 group/spark flex-1 min-w-0">
              <h2 className="font-display text-xl sm:text-3xl text-foreground leading-snug">{project.spark}</h2>
              {!readOnly && (
                <button onClick={() => { setSparkText(project.spark); setEditingSpark(true); }} className="text-muted-foreground hover:text-foreground opacity-0 group-hover/spark:opacity-100 transition-opacity shrink-0 mt-1">
                  <Pencil size={13} />
                </button>
              )}
            </div>
          )}

          {!readOnly && !editingSpark && (
            <div className="shrink-0">
              <AutoHammer spark={project.spark} onGenerated={(boulders) => onUpdate({ ...project, boulders })} />
            </div>
          )}
        </div>

        {/* Progress bar */}
        {totalPebbles > 0 && (
          <div className="mt-3">
            <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
              <motion.div className="h-full bg-primary rounded-full" initial={{ width: 0 }} animate={{ width: `${(donePebbles / totalPebbles) * 100}%` }} transition={{ duration: 0.5 }} />
            </div>
            <p className="text-xs text-muted-foreground font-body mt-1">{donePebbles}/{totalPebbles} pebbles done</p>
          </div>
        )}
      </div>

      {/* Boulders */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleBoulderDragEnd}>
        <SortableContext items={project.boulders.map(b => b.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-4">
            {project.boulders.map((boulder) => (
              <SortableBoulder
                key={boulder.id}
                boulder={boulder}
                spark={project.spark}
                readOnly={readOnly}
                newPebbleText={newPebbleTexts[boulder.id] || ''}
                onNewPebbleTextChange={(text) => setNewPebbleTexts(prev => ({ ...prev, [boulder.id]: text }))}
                onAddPebble={() => addPebble(boulder.id)}
                onDeleteBoulder={() => deleteBoulder(boulder.id)}
                onEditBoulder={(newTitle) => editBoulder(boulder.id, newTitle)}
                onTogglePebble={(pebbleId) => togglePebble(boulder.id, pebbleId)}
                onDeletePebble={(pebbleId) => deletePebble(boulder.id, pebbleId)}
                onEditPebble={(pebbleId, newText) => editPebble(boulder.id, pebbleId, newText)}
                onUpdatePebble={(pebbleId, updates) => updatePebble(boulder.id, pebbleId, updates)}
                onReorderPebbles={handleReorderPebbles}
                onReplacePebbles={replacePebbles}
                onAddPebbles={addPebbles}
                hidden={focusedPebbleId !== null && focusedBoulderId !== boulder.id}
                onFocusPebble={setFocusedPebbleId}
                focusedPebbleId={focusedPebbleId}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {/* Add boulder */}
      {!readOnly && (
        <form onSubmit={(e) => { e.preventDefault(); addBoulder(); }} className="flex gap-2">
          <input type="text" value={newBoulderTitle} onChange={(e) => setNewBoulderTitle(e.target.value)} placeholder="Tambah boulder (fase)…" className="flex-1 px-3 py-2 text-sm bg-card border border-border rounded-lg font-body placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring/30" />
          <button type="submit" className="px-3 py-2 text-sm font-body bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity whitespace-nowrap">Tambah</button>
        </form>
      )}

      {/* Forge Modal */}
      {showForge && (
        <ForgeModal project={project} onClose={() => setShowForge(false)} />
      )}
    </div>
  );
};

export default ProjectDetail;