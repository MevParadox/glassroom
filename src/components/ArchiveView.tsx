import { Project } from '@/lib/types';
import ProjectCard from './ProjectCard';
import ProjectDetail from './ProjectDetail';
import ConfirmDialog from './ConfirmDialog';
import { useState } from 'react';
import { Trophy, RotateCcw, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ArchiveViewProps {
  projects: Project[];
  searchQuery?: string;
  onRestoreProject: (id: string) => void;
  onDeleteProject: (id: string) => void;
}

const ArchiveView = ({ projects, searchQuery = '', onRestoreProject, onDeleteProject }: ArchiveViewProps) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const archived = projects.filter(p => p.archived);
  const q = searchQuery.toLowerCase();
  const filtered = q
    ? archived.filter(p =>
        p.spark.toLowerCase().includes(q) ||
        p.boulders.some(b =>
          b.title.toLowerCase().includes(q) ||
          b.pebbles.some(pb => pb.text.toLowerCase().includes(q))
        )
      )
    : archived;
  const selected = archived.find(p => p.id === selectedId);

  if (selected) {
    return (
      <div className="space-y-4">
        {/* Action bar di atas detail */}
        <div className="flex items-center gap-2 p-3 bg-muted/50 border border-border rounded-lg">
          <Trophy size={14} className="text-primary shrink-0" />
          <p className="text-xs font-body text-muted-foreground flex-1">Project ini sudah diarsipkan</p>
          <button
            onClick={() => { onRestoreProject(selected.id); setSelectedId(null); }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-body text-foreground hover:bg-secondary/80 border border-border rounded-md transition-colors"
          >
            <RotateCcw size={12} />
            Kembalikan ke Workshop
          </button>
          <ConfirmDialog
            trigger={
              <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-body text-muted-foreground hover:text-destructive hover:bg-destructive/5 border border-border rounded-md transition-colors">
                <Trash2 size={12} />
                Hapus
              </button>
            }
            title="Hapus project ini?"
            description={`"${selected.spark}" akan dipindah ke Trash. Bisa dipulihkan nanti.`}
            confirmLabel="Hapus"
            onConfirm={() => { onDeleteProject(selected.id); setSelectedId(null); }}
          />
        </div>

        <ProjectDetail
          project={selected}
          onBack={() => setSelectedId(null)}
          onUpdate={() => {}}
          onArchive={() => {}}
          readOnly
        />
      </div>
    );
  }

  if (archived.length === 0) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        <Trophy size={32} className="mx-auto mb-3 opacity-40" />
        <p className="text-lg font-body">Belum ada project selesai. Terus semangat!</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground font-body mb-4">
        <Trophy size={14} className="inline mr-1" />
        {archived.length} project selesai
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <AnimatePresence>
          {filtered.map(project => (
            <motion.div
              key={project.id}
              layout
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="relative group"
            >
              <ProjectCard
                project={project}
                onClick={() => setSelectedId(project.id)}
                readOnly
              />

              {/* Action buttons on hover */}
              <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {/* Restore */}
                <button
                  onClick={(e) => { e.stopPropagation(); onRestoreProject(project.id); }}
                  title="Kembalikan ke Workshop"
                  className="p-1.5 rounded-md bg-card/80 backdrop-blur border border-border text-muted-foreground hover:text-primary transition-colors"
                >
                  <RotateCcw size={14} />
                </button>

                {/* Delete */}
                <ConfirmDialog
                  trigger={
                    <button
                      onClick={(e) => e.stopPropagation()}
                      title="Hapus project"
                      className="p-1.5 rounded-md bg-card/80 backdrop-blur border border-border text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  }
                  title="Hapus project ini?"
                  description={`"${project.spark}" akan dipindah ke Trash. Bisa dipulihkan nanti.`}
                  confirmLabel="Hapus"
                  onConfirm={() => onDeleteProject(project.id)}
                />
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default ArchiveView;