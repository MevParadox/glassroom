import { useRef, useCallback, useState, useEffect } from 'react';
import { Pebble, Attachment } from '@/lib/types';
import { generateId } from '@/lib/store';
import {
  Paperclip, X, FileText, MessageSquare,
  Maximize2, Minimize2, Bold, Italic, Heading2, List, ListOrdered, Plus,
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

interface PebbleEditorProps {
  pebble: Pebble;
  onUpdate: (updates: Partial<Pebble>) => void;
  onFocusMode?: () => void;
  isFocused?: boolean;
}

const PebbleEditor = ({ pebble, onUpdate, onFocusMode, isFocused }: PebbleEditorProps) => {
  const [notes, setNotes] = useState(pebble.notes || '');
  const [attachments, setAttachments] = useState<Attachment[]>(pebble.attachments || []);
  const [previewAttachment, setPreviewAttachment] = useState<Attachment | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
  if (editorRef.current) {
    // Hanya update kalau user tidak sedang aktif ngetik di editor
    if (document.activeElement !== editorRef.current) {
      editorRef.current.innerHTML = pebble.content || '';
    }
  }
}, [pebble.content]); // ← watch pebble.content, update kalau berubah dari luar

  const debouncedUpdate = useCallback((updates: Partial<Pebble>) => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      onUpdate(updates);
    }, 800);
  }, [onUpdate]);

  const handleContentInput = useCallback(() => {
    const value = editorRef.current?.innerHTML || '';
    debouncedUpdate({ content: value });
  }, [debouncedUpdate]);

  const handleNotesChange = useCallback((value: string) => {
    setNotes(value);
    debouncedUpdate({ notes: value });
  }, [debouncedUpdate]);

  const execCommand = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
    handleContentInput();
  };

  const handleFileAdd = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach(file => {
      if (file.size > 5 * 1024 * 1024) return;
      const reader = new FileReader();
      reader.onload = () => {
        const attachment: Attachment = {
          id: generateId(),
          name: file.name,
          type: file.type,
          size: file.size,
          dataUrl: reader.result as string,
        };
        setAttachments(prev => {
          const next = [...prev, attachment];
          onUpdate({ attachments: next });
          return next;
        });
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  }, [onUpdate]);

  const removeAttachment = useCallback((id: string) => {
    setAttachments(prev => {
      const next = prev.filter(a => a.id !== id);
      onUpdate({ attachments: next });
      return next;
    });
  }, [onUpdate]);

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const ToolbarBtn = ({ active, onClick, children, title }: { active?: boolean; onClick: () => void; children: React.ReactNode; title: string }) => (
    <button
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      className={`w-8 h-8 flex items-center justify-center rounded-full transition-colors ${active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/80'}`}
      title={title}
    >
      {children}
    </button>
  );

  return (
    <div className="mt-3 space-y-0">
      {/* Canvas card */}
      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm  bg-white">
        {/* Floating toolbar */}
        <div className="flex items-center justify-center py-3">
          <div className="flex items-center gap-0.5 px-2 py-1 bg-muted/50 rounded-full border border-border">
            <ToolbarBtn onClick={() => execCommand('bold')} title="Bold"><Bold size={14} /></ToolbarBtn>
            <ToolbarBtn onClick={() => execCommand('italic')} title="Italic"><Italic size={14} /></ToolbarBtn>
            <div className="w-px h-4 bg-border mx-1" />
            <ToolbarBtn onClick={() => execCommand('insertUnorderedList')} title="Bullet List"><List size={14} /></ToolbarBtn>
            <ToolbarBtn onClick={() => execCommand('insertOrderedList')} title="Numbered List"><ListOrdered size={14} /></ToolbarBtn>
          </div>
        </div>

        {/* Pebble title + focus */}
        <div className="flex items-start justify-between px-6 pb-2">
          <h3 className="font-display text-2xl text-foreground leading-tight">{pebble.text}</h3>
          {onFocusMode && (
            <button onClick={onFocusMode} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors mt-1" title={isFocused ? 'Exit focus mode' : 'Focus mode'}>
              {isFocused ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
          )}
        </div>

        {/* Editable content area */}
        <div className="px-6 pb-6">
          <div className="border-t border-dashed border-border pt-4">
            {/* ref + useEffect */}
            <div
              ref={editorRef}
              contentEditable
              suppressContentEditableWarning
              onInput={handleContentInput}
              className="min-h-[200px] text-sm leading-relaxed font-body text-foreground focus:outline-none [&>h2]:font-display [&>h2]:text-lg [&>h2]:font-semibold [&>h2]:mt-4 [&>h2]:mb-2 [&>ol]:list-decimal [&>ol]:pl-6 [&>ol]:space-y-1 [&>ul]:list-disc [&>ul]:pl-6 [&>ul]:space-y-1 [&_b]:font-semibold [&_i]:italic empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground/50 empty:before:pointer-events-none"
              data-placeholder="Start writing…"
            />
          </div>
        </div>

        {/* Margin Notes — inside the card */}
        <div className="px-6 pb-5 border-t border-dashed border-border">
          <div className="flex items-center gap-2 pt-4 pb-2">
            <MessageSquare size={12} className="text-muted-foreground" />
            <span className="text-[11px] font-body text-muted-foreground font-semibold tracking-wider uppercase">Margin Notes</span>
          </div>
          <textarea
            value={notes}
            onChange={(e) => handleNotesChange(e.target.value)}
            placeholder="Add a quick note or log entry…"
            rows={2}
            className="w-full px-0 py-1 text-sm bg-transparent font-body text-foreground italic placeholder:text-muted-foreground/50 focus:outline-none resize-none"
          />
        </div>

        {/* References / Attachments — inside the card */}
        <div className="px-6 pb-6 border-t border-dashed border-border">
          <div className="flex items-center justify-between pt-4 pb-3">
            <div className="flex items-center gap-2">
              <Paperclip size={12} className="text-muted-foreground" />
              <span className="text-[11px] font-body text-muted-foreground font-semibold tracking-wider uppercase">References</span>
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1 text-xs font-body text-primary hover:text-primary/80 transition-colors"
            >
              <Plus size={12} />
              Add File
            </button>
          </div>
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-3">
              {attachments.map(att => (
                <div
                  key={att.id}
                  className="relative group/att w-[140px] cursor-pointer"
                  onClick={() => setPreviewAttachment(att)}
                >
                  {att.type.startsWith('image/') ? (
                    <div className="w-full h-[100px] rounded-lg border border-border overflow-hidden bg-muted/30">
                      <img src={att.dataUrl} alt={att.name} className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="w-full h-[100px] rounded-lg border border-border flex items-center justify-center bg-muted/30">
                      <FileText size={28} className="text-muted-foreground" />
                    </div>
                  )}
                  <p className="text-xs font-body text-foreground truncate mt-1.5">{att.name}</p>
                  <p className="text-[10px] font-body text-muted-foreground">{formatFileSize(att.size)}</p>
                  <button
                    onClick={(e) => { e.stopPropagation(); removeAttachment(att.id); }}
                    className="absolute top-1 right-1 p-1 rounded-full bg-card/90 text-muted-foreground hover:text-destructive opacity-0 group-hover/att:opacity-100 transition-opacity shadow-sm"
                  >
                    <X size={10} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <input ref={fileInputRef} type="file" multiple accept="image/*,.pdf,.doc,.docx,.txt,.md" onChange={handleFileAdd} className="hidden" />
        </div>
      </div>

      {/* Attachment Preview Dialog */}
      <Dialog open={!!previewAttachment} onOpenChange={(open) => !open && setPreviewAttachment(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-body text-sm truncate">
              {previewAttachment?.name}
            </DialogTitle>
          </DialogHeader>
          {previewAttachment && (
            <div className="flex flex-col items-center gap-3">
              {previewAttachment.type.startsWith('image/') ? (
                <img
                  src={previewAttachment.dataUrl}
                  alt={previewAttachment.name}
                  className="max-h-[60vh] w-auto rounded-lg object-contain"
                />
              ) : (
                <div className="flex flex-col items-center gap-3 py-8">
                  <FileText size={48} className="text-muted-foreground" />
                  <p className="text-sm font-body text-muted-foreground">Preview not available for this file type</p>
                </div>
              )}
              <p className="text-xs font-body text-muted-foreground">
                {formatFileSize(previewAttachment.size)} · {previewAttachment.type}
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PebbleEditor;