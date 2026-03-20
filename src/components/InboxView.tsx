import { Idea } from '@/lib/types';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Trash2, Snowflake } from 'lucide-react';

interface InboxViewProps {
  ideas: Idea[];
  onProcess: (idea: Idea) => void;
  onDelete: (id: string) => void;
  onBankruptcy: () => void;
  onFreeze: (idea: Idea) => void;
  searchQuery?: string;
}

const InboxView = ({ ideas, onProcess, onDelete, onBankruptcy, onFreeze, searchQuery = '' }: InboxViewProps) => {
  const q = searchQuery.toLowerCase();
  const filtered = q ? ideas.filter(i => i.text.toLowerCase().includes(q)) : ideas;

  if (ideas.length === 0) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        <p className="text-lg font-body">Your inbox is empty. Capture something above!</p>
      </div>
    );
  }

  if (filtered.length === 0 && q) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between mb-6">
          <p className="text-sm text-muted-foreground font-body">{ideas.length} idea{ideas.length !== 1 ? 's' : ''} waiting</p>
        </div>
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-sm font-body">No ideas match "{searchQuery}"</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm text-muted-foreground font-body">{ideas.length} idea{ideas.length !== 1 ? 's' : ''} waiting</p>
        <button
          onClick={onBankruptcy}
          title="Move all ideas to Cryochamber for later"
          className="flex items-center gap-2 px-4 py-2 text-sm font-body text-destructive hover:bg-destructive/10 rounded-md transition-colors"
        >
          <Snowflake size={14} />
          Bankruptcy
        </button>
      </div>

      <AnimatePresence mode="popLayout">
        {filtered.map((idea) => (
          <motion.div
            key={idea.id}
            layout
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, filter: 'blur(4px)' }}
            className="flex items-center justify-between p-4 bg-card border border-border rounded-lg group"
          >
            <p className="font-body text-foreground flex-1 mr-4 text-sm">{idea.text}</p>
            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => onProcess(idea)}
                title="Process this idea — break it down in Workshop"
                className="flex items-center gap-1 px-3 py-1.5 text-sm font-body bg-primary text-primary-foreground rounded-md hover:opacity-90 transition-opacity"
              >
                Process <ArrowRight size={14} />
              </button>
              <button
                onClick={() => onFreeze(idea)}
                title="Freeze to Cryochamber — save for later"
                className="p-1.5 text-muted-foreground hover:text-blue-400 transition-colors"
              >
                <Snowflake size={16} />
              </button>
              <button
                onClick={() => onDelete(idea.id)}
                title="Move to Trash — can be restored later"
                className="p-1.5 text-muted-foreground hover:text-destructive transition-colors"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

export default InboxView;