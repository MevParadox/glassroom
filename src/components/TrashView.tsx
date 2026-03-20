import { Trash2, RotateCcw, AlertTriangle } from 'lucide-react';
import { TrashItem } from '@/lib/store';
import { motion, AnimatePresence } from 'framer-motion';
import ConfirmDialog from './ConfirmDialog';

interface TrashViewProps {
  items: TrashItem[];
  onRestore: (trashId: string, item: TrashItem) => void;
  onDelete: (trashId: string) => void;
  onEmptyTrash: () => void;
}

const TrashView = ({ items, onRestore, onDelete, onEmptyTrash }: TrashViewProps) => {
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  if (items.length === 0) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        <Trash2 size={32} className="mx-auto mb-3 opacity-40" />
        <p className="font-body text-base">Trash is empty.</p>
        <p className="font-body text-sm mt-1 opacity-70">Deleted items will appear here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground font-body">
          <AlertTriangle size={13} className="text-orange-400" />
          <span>{items.length} item{items.length !== 1 ? 's' : ''} in trash</span>
        </div>
        <ConfirmDialog
          trigger={
            <button className="text-xs font-body text-destructive hover:text-destructive/80 transition-colors">
              Empty Trash
            </button>
          }
          title="Empty trash?"
          description="All items in trash will be permanently deleted and cannot be recovered."
          confirmLabel="Empty"
          onConfirm={onEmptyTrash}
        />
      </div>

      <AnimatePresence>
        {items.map(item => {
          const name = item.type === 'idea' ? (item.data as any).text : (item.data as any).spark;
          return (
            <motion.div key={item.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
              className="flex items-center justify-between p-4 bg-card border border-border rounded-lg opacity-70 hover:opacity-100 transition-opacity">
              <div className="flex-1 min-w-0 mr-3">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className={`text-[10px] font-body px-1.5 py-0.5 rounded-full ${
                    item.type === 'idea' ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary'
                  }`}>
                    {item.type === 'idea' ? 'Idea' : 'Project'}
                  </span>
                  <span className="text-[10px] font-body text-muted-foreground">{formatDate(item.deletedAt)}</span>
                </div>
                <p className="font-body text-sm text-foreground truncate">{name}</p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button onClick={() => onRestore(item.id, item)} title="Restore"
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-body text-muted-foreground hover:text-foreground hover:bg-secondary/80 rounded-md transition-colors">
                  <RotateCcw size={12} />
                  Restore
                </button>
                <ConfirmDialog
                  trigger={
                    <button title="Delete permanently" className="p-1.5 text-muted-foreground hover:text-destructive transition-colors">
                      <Trash2 size={13} />
                    </button>
                  }
                  title="Delete permanently?"
                  description={`"${name}" will be deleted forever and cannot be recovered.`}
                  confirmLabel="Delete Forever"
                  onConfirm={() => onDelete(item.id)}
                />
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};

export default TrashView;