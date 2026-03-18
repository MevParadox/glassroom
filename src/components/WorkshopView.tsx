import { useState } from 'react';
import { Project } from '@/lib/types';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, Snowflake, Archive } from 'lucide-react';
import ProjectCard from './ProjectCard';
import ProjectDetail from './ProjectDetail';
import ConfirmDialog from './ConfirmDialog';

interface WorkshopViewProps {
  projects: Project[];
  onUpdateProject: (project: Project) => void;
  onArchiveProject: (id: string) => void;
  onCreateProject: (spark: string) => void;
  onDeleteProject: (id: string) => void;
  onFreezeProject: (id: string) => void;
  searchQuery?: string;
}

const WorkshopView = ({ projects, onUpdateProject, onArchiveProject, onCreateProject, onDeleteProject, onFreezeProject, searchQuery = '' }: WorkshopViewProps) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showNewInput, setShowNewInput] = useState(false);
  const [newSpark, setNewSpark] = useState('');

  const activeProjects = projects.filter(p => !p.archived);
  const q = searchQuery.toLowerCase();
  const filteredProjects = q
    ? activeProjects.filter(p =>
        p.spark.toLowerCase().includes(q) ||
        p.boulders.some(b =>
          b.title.toLowerCase().includes(q) ||
          b.pebbles.some(pb => pb.text.toLowerCase().includes(q))
        )
      )
    : activeProjects;

  const selected = activeProjects.find(p => p.id === selectedId);

  const handleCreate = () => {
    const spark = newSpark.trim();
    if (!spark) return;
    onCreateProject(spark);
    setNewSpark('');
    setShowNewInput(false);
  };

  if (selected) {
    return (
      <ProjectDetail
        project={selected}
        onBack={() => setSelectedId(null)}
        onUpdate={onUpdateProject}
        onArchive={() => {
          onArchiveProject(selected.id);
          setSelectedId(null);
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground font-body">
          {activeProjects.length} project aktif
        </p>
        <button
          onClick={() => setShowNewInput(true)}
          title="Buat project baru dari ide"
          className="flex items-center gap-2 px-4 py-2 text-sm font-body bg-primary text-primary-foreground rounded-md hover:opacity-90 transition-opacity"
        >
          <Plus size={14} /> Project Baru
        </button>
      </div>

      {showNewInput && (
        <motion.form
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          onSubmit={(e) => { e.preventDefault(); handleCreate(); }}
          className="flex gap-2"
        >
          <input
            type="text"
            value={newSpark}
            onChange={(e) => setNewSpark(e.target.value)}
            placeholder="Apa ide atau projectnya?"
            autoFocus
            className="flex-1 px-4 py-2.5 text-sm bg-card border border-border rounded-lg font-body placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring/30"
          />
          <button type="submit" className="px-4 py-2.5 text-sm font-body bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity">
            Buat
          </button>
          <button type="button" onClick={() => { setShowNewInput(false); setNewSpark(''); }} className="px-3 py-2.5 text-sm font-body text-muted-foreground hover:text-foreground transition-colors">
            Batal
          </button>
        </motion.form>
      )}

      {filteredProjects.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <p className="text-lg font-body">
            {q ? `Tidak ada project yang cocok dengan "${searchQuery}"` : 'Belum ada project aktif. Proses ide atau buat project baru.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <AnimatePresence>
            {filteredProjects.map(project => (
              <motion.div key={project.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="relative group">
                <ProjectCard project={project} onClick={() => setSelectedId(project.id)} />
                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">

                  {/* Archive manual */}
                  <ConfirmDialog
                    trigger={
                      <button
                        onClick={(e) => e.stopPropagation()}
                        title="Arsipkan project yang sudah selesai"
                        className="p-1.5 rounded-md bg-card/80 backdrop-blur border border-border text-muted-foreground hover:text-primary transition-colors"
                      >
                        <Archive size={14} />
                      </button>
                    }
                    title="Arsipkan project?"
                    description={`"${project.spark}" akan dipindah ke Archive.`}
                    confirmLabel="Arsipkan"
                    variant="default"
                    onConfirm={() => onArchiveProject(project.id)}
                  />

                  {/* Freeze */}
                  <ConfirmDialog
                    trigger={
                      <button
                        onClick={(e) => e.stopPropagation()}
                        title="Bekukan ke Cryochamber — simpan untuk nanti"
                        className="p-1.5 rounded-md bg-card/80 backdrop-blur border border-border text-muted-foreground hover:text-blue-400 transition-colors"
                      >
                        <Snowflake size={14} />
                      </button>
                    }
                    title="Bekukan project?"
                    description={`"${project.spark}" akan dipindah ke Cryochamber.`}
                    confirmLabel="Bekukan"
                    variant="default"
                    onConfirm={() => onFreezeProject(project.id)}
                  />

                  {/* Trash — soft delete */}
                  <ConfirmDialog
                    trigger={
                      <button
                        onClick={(e) => e.stopPropagation()}
                        title="Pindah ke Trash — bisa dipulihkan nanti"
                        className="p-1.5 rounded-md bg-card/80 backdrop-blur border border-border text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    }
                    title="Hapus project?"
                    description={`"${project.spark}" akan dipindah ke Trash. Bisa dipulihkan nanti.`}
                    confirmLabel="Hapus"
                    onConfirm={() => onDeleteProject(project.id)}
                  />
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};

export default WorkshopView;