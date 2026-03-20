import { useState } from 'react';
import { Project, Pebble } from '@/lib/types';
import { Hammer, ChevronDown, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface AnvilPebble {
  pebble: Pebble;
  spark: string;
  boulderTitle: string;
  projectId: string;
  boulderId: string;
}

interface AnvilViewProps {
  projects: Project[];
  onUpdatePebble: (projectId: string, boulderId: string, pebbleId: string, updates: Partial<Pebble>) => void;
  onTogglePebble: (projectId: string, boulderId: string, pebbleId: string) => void;
}

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

const AnvilCard = ({ pebble, spark, boulderTitle, projectId, boulderId, onUpdatePebble, onTogglePebble }: AnvilPebble & {
  onUpdatePebble: AnvilViewProps['onUpdatePebble'];
  onTogglePebble: AnvilViewProps['onTogglePebble'];
}) => {
  const [expanded, setExpanded] = useState(false);
  const hasContent = pebble.content || pebble.notes;

  return (
    <div className={`border rounded-lg transition-all ${
      pebble.status === 'done' ? 'border-primary/20 opacity-60' : 'border-primary/30 bg-primary/5'
    }`}>
      <div className="p-4">
        <p className="text-[10px] font-body text-muted-foreground mb-1.5 truncate">
          {spark} → {boulderTitle}
        </p>
        <div className="flex items-start gap-2 cursor-pointer" onClick={() => hasContent && setExpanded(!expanded)}>
          {hasContent && (
            <button className="text-muted-foreground shrink-0 mt-0.5">
              {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            </button>
          )}
          <p className={`font-body text-sm leading-snug flex-1 ${
            pebble.status === 'done' ? 'line-through text-muted-foreground' : 'text-foreground'
          }`}>
            {pebble.text}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap mt-3">
          <button
            onClick={() => onTogglePebble(projectId, boulderId, pebble.id)}
            className={`px-2.5 py-1 text-xs rounded-full font-body transition-colors ${statusColors[pebble.status]}`}>
            {statusLabels[pebble.status]}
          </button>
          <button
            onClick={() => onUpdatePebble(projectId, boulderId, pebble.id, { focusToday: false })}
            className="px-2.5 py-1 text-xs font-body text-muted-foreground hover:text-foreground hover:bg-secondary/80 rounded-full transition-colors">
            Remove from Anvil
          </button>
        </div>
      </div>

      <AnimatePresence>
        {expanded && hasContent && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 border-t border-border/50 pt-3 space-y-3">
              {pebble.content && (
                <div className="text-sm font-body text-foreground leading-relaxed prose prose-sm max-w-none
                  [&>p]:mb-2 [&>ul]:list-disc [&>ul]:pl-4 [&>ul]:mb-2 [&>ol]:list-decimal [&>ol]:pl-4
                  [&>ol]:mb-2 [&>li]:mb-1 [&>h2]:font-semibold [&>h2]:text-base [&>h2]:mb-2
                  [&>strong]:font-semibold [&>em]:italic"
                  dangerouslySetInnerHTML={{ __html: pebble.content }}
                />
              )}
              {pebble.notes && (
                <div className="border-t border-border/50 pt-3">
                  <p className="text-[11px] font-body text-muted-foreground uppercase tracking-wider mb-1">Notes</p>
                  <p className="text-sm font-body text-foreground italic">{pebble.notes}</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const AnvilView = ({ projects, onUpdatePebble, onTogglePebble }: AnvilViewProps) => {
  const anvilPebbles: AnvilPebble[] = [];
  projects.filter(p => !p.archived).forEach(project => {
    project.boulders.forEach(boulder => {
      boulder.pebbles.filter(pebble => pebble.focusToday).forEach(pebble => {
        anvilPebbles.push({ pebble, spark: project.spark, boulderTitle: boulder.title, projectId: project.id, boulderId: boulder.id });
      });
    });
  });

  const done = anvilPebbles.filter(p => p.pebble.status === 'done').length;
  const total = anvilPebbles.length;

  if (total === 0) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        <Hammer size={32} className="mx-auto mb-3 opacity-40" />
        <p className="font-body text-base">The Anvil is empty.</p>
        <p className="font-body text-sm mt-1 opacity-70">
          Mark pebbles with 🔨 Anvil from Workshop to focus on them today.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-body text-muted-foreground">{done}/{total} done today</p>
          {done === total && (
            <motion.span initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="text-sm font-body text-primary">
              🎉 All done!
            </motion.span>
          )}
        </div>
        <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
          <motion.div className="h-full bg-primary rounded-full" initial={{ width: 0 }}
            animate={{ width: total > 0 ? `${(done / total) * 100}%` : '0%' }}
            transition={{ duration: 0.5 }} />
        </div>
      </div>

      <div className="space-y-2">
        {anvilPebbles.map(({ pebble, spark, boulderTitle, projectId, boulderId }) => (
          <AnvilCard key={pebble.id} pebble={pebble} spark={spark} boulderTitle={boulderTitle}
            projectId={projectId} boulderId={boulderId}
            onUpdatePebble={onUpdatePebble} onTogglePebble={onTogglePebble} />
        ))}
      </div>
    </div>
  );
};

export default AnvilView;