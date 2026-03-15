import { Project } from '@/lib/types';

interface ProjectCardProps {
  project: Project;
  onClick: () => void;
  readOnly?: boolean;
}

const ProjectCard = ({ project, onClick, readOnly }: ProjectCardProps) => {
  const totalPebbles = project.boulders.reduce((sum, b) => sum + b.pebbles.length, 0);
  const donePebbles = project.boulders.reduce((sum, b) => sum + b.pebbles.filter(p => p.status === 'done').length, 0);
  const progress = totalPebbles > 0 ? Math.round((donePebbles / totalPebbles) * 100) : 0;

  return (
    <button
      onClick={onClick}
      disabled={readOnly}
      className="w-full text-left p-5 bg-card border border-border rounded-lg hover:border-primary/30 transition-colors disabled:hover:border-border"
    >
      <h3 className="font-display text-xl text-foreground mb-2">{project.spark}</h3>
      <p className="text-sm text-muted-foreground font-body mb-3">
        {project.boulders.length} boulder{project.boulders.length !== 1 ? 's' : ''} · {totalPebbles} pebble{totalPebbles !== 1 ? 's' : ''}
      </p>
      <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground font-body mt-1.5">{progress}% complete</p>
    </button>
  );
};

export default ProjectCard;
