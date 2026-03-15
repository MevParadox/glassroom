import { Project } from '@/lib/types';
import ProjectCard from './ProjectCard';
import ProjectDetail from './ProjectDetail';
import { useState } from 'react';
import { Trophy } from 'lucide-react';

interface ArchiveViewProps {
  projects: Project[];
  searchQuery?: string;
}

const ArchiveView = ({ projects, searchQuery = '' }: ArchiveViewProps) => {
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
      <ProjectDetail
        project={selected}
        onBack={() => setSelectedId(null)}
        onUpdate={() => {}}
        onArchive={() => {}}
        readOnly
      />
    );
  }

  if (archived.length === 0) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        <Trophy size={32} className="mx-auto mb-3 opacity-40" />
        <p className="text-lg font-body">No completed projects yet. Keep going!</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground font-body mb-4">
        <Trophy size={14} className="inline mr-1" />
        {archived.length} completed project{archived.length !== 1 ? 's' : ''}
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        {filtered.map(project => (
          <ProjectCard key={project.id} project={project} onClick={() => setSelectedId(project.id)} readOnly />
        ))}
      </div>
    </div>
  );
};

export default ArchiveView;
