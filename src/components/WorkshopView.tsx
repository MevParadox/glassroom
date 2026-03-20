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
          {activeProjects.length} active project{activeProjects.length !== 1 ? 's' : ''}
        </p>
        <button
          onClick={() => setShowNewInput(true)}
          title="Create a new project from an idea"
          className="flex items-center gap-2 px-4 py-2 text-sm font-body bg-primary text-primary-foreground rounded-md hover:opacity-90 transition-opacity"
        >
          <Plus size={14} /> New Project
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
            placeholder="What's the idea or project?"
            autoFocus
            className="flex-1 px-4 py-2.5 text-sm bg-card border border-border rounded-lg font-body placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring/30"
          />
          <button type="submit" className="px-4 py-2.5 text-sm font-body bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity">
            Create
          </button>
          <button type="button" onClick={() => { setShowNewInput(false); setNewSpark(''); }} className="px-3 py-2.5 text-sm font-body text-muted-foreground hover:text-foreground transition-colors">
            Cancel
          </button>
        </motion.form>
      )}

      {filteredProjects.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <p className="text-lg font-body">
            {q ? `No projects match "${searchQuery}"` : 'No active projects. Process an idea or create one.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <AnimatePresence>
            {filteredProjects.map(project => (
              <motion.div key={project.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="relative group">
                <ProjectCard project={project} onClick={() => setSelectedId(project.id)} />
                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <ConfirmDialog
                    trigger={
                      <button onClick={(e) => e.stopPropagation()} title="Archive this project"
                        className="p-1.5 rounded-md bg-card/80 backdrop-blur border border-border text-muted-foreground hover:text-primary transition-colors">
                        <Archive size={14} />
                      </button>
                    }
                    title="Archive project?"
                    description={`"${project.spark}" will be moved to Archive.`}
                    confirmLabel="Archive"
                    variant="default"
                    onConfirm={() => onArchiveProject(project.id)}
                  />
                  <ConfirmDialog
                    trigger={
                      <button onClick={(e) => e.stopPropagation()} title="Freeze to Cryochamber — save for later"
                        className="p-1.5 rounded-md bg-card/80 backdrop-blur border border-border text-muted-foreground hover:text-blue-400 transition-colors">
                        <Snowflake size={14} />
                      </button>
                    }
                    title="Freeze project?"
                    description={`"${project.spark}" will be moved to Cryochamber.`}
                    confirmLabel="Freeze"
                    variant="default"
                    onConfirm={() => onFreezeProject(project.id)}
                  />
                  <ConfirmDialog
                    trigger={
                      <button onClick={(e) => e.stopPropagation()} title="Move to Trash — can be restored later"
                        className="p-1.5 rounded-md bg-card/80 backdrop-blur border border-border text-muted-foreground hover:text-destructive transition-colors">
                        <Trash2 size={14} />
                      </button>
                    }
                    title="Delete project?"
                    description={`"${project.spark}" will be moved to Trash. You can restore it later.`}
                    confirmLabel="Delete"
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