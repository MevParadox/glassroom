import { useState } from 'react';
import { Project } from '@/lib/types';
import { X, Sparkles, List, Loader2, Download, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { callAI } from '@/lib/ai';

interface ForgeModalProps {
  project: Project;
  onClose: () => void;
}

type ForgeMode = 'narrative' | 'structured' | null;

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function printAsPDF(title: string, htmlContent: string) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    toast.error('Pop-up blocked by browser. Please allow pop-ups and try again.');
    return;
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>${title}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'DM Sans', system-ui, sans-serif; font-size: 11pt; line-height: 1.6; color: #1a1a1a; padding: 40px 48px; max-width: 800px; margin: 0 auto; }
        h1 { font-size: 22pt; font-weight: 600; margin-bottom: 8px; color: #111; }
        h2 { font-size: 14pt; font-weight: 600; margin-top: 28px; margin-bottom: 10px; color: #222; border-bottom: 1px solid #e5e5e5; padding-bottom: 6px; }
        h3 { font-size: 11pt; font-weight: 600; margin-top: 16px; margin-bottom: 6px; color: #333; }
        p { margin-bottom: 8px; }
        ul, ol { padding-left: 20px; margin-bottom: 8px; }
        li { margin-bottom: 4px; }
        strong { font-weight: 600; }
        em { font-style: italic; }
        .meta { font-size: 9pt; color: #888; margin-bottom: 24px; }
        .divider { border: none; border-top: 1px solid #e5e5e5; margin: 20px 0; }
        .status { display: inline-block; font-size: 8pt; padding: 2px 8px; border-radius: 999px; margin-bottom: 8px; }
        .status-todo { background: #f3f4f6; color: #666; }
        .status-in-progress { background: #fef3c7; color: #92400e; }
        .status-done { background: #d1fae5; color: #065f46; }
        .notes { font-style: italic; color: #666; font-size: 9.5pt; border-left: 2px solid #e5e5e5; padding-left: 10px; margin-top: 8px; }
        @media print { body { padding: 20px; } }
      </style>
    </head>
    <body>
      ${htmlContent}
      <script>window.onload = function() { window.print(); }</script>
    </body>
    </html>
  `);
  printWindow.document.close();
}

function buildStructuredHTML(project: Project): string {
  const date = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  let html = `<h1>${project.spark}</h1><p class="meta">Created on ${date} · The Glass Room</p><hr class="divider">`;

  project.boulders.forEach((boulder, bIdx) => {
    html += `<h2>${bIdx + 1}. ${boulder.title}</h2>`;
    boulder.pebbles.forEach((pebble, pIdx) => {
      const statusClass = `status-${pebble.status}`;
      const statusLabel = pebble.status === 'todo' ? 'Not started' : pebble.status === 'in-progress' ? 'In progress' : 'Done';
      html += `<h3>${bIdx + 1}.${pIdx + 1} ${pebble.text}</h3>`;
      html += `<span class="status ${statusClass}">${statusLabel}</span>`;
      if (pebble.content) html += pebble.content;
      if (pebble.notes) html += `<div class="notes">📝 ${pebble.notes}</div>`;
    });
  });

  return html;
}

const ForgeModal = ({ project, onClose }: ForgeModalProps) => {
  const [mode, setMode] = useState<ForgeMode>(null);
  const [isForging, setIsForging] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const forgeNarrative = async () => {
    setIsForging(true);
    try {
      const context = project.boulders.map(b => {
        const pebbleContext = b.pebbles.map(p => {
          let pText = `- ${p.text}`;
          if (p.content) pText += `\n  ${stripHtml(p.content).substring(0, 300)}`;
          return pText;
        }).join('\n');
        return `### ${b.title}\n${pebbleContext}`;
      }).join('\n\n');

      const prompt = `You are a professional document writer. Based on the project planning data below, craft a cohesive, flowing narrative document.

Project: "${project.spark}"

Planning data:
${context}

Write a professional document that:
1. Starts with an executive summary / introduction paragraph
2. Flows naturally from phase to phase
3. Integrates the answers and details into readable prose
4. Ends with a conclusion or next steps

Use the same language as the project title.
Format in clean HTML using: <h1>, <h2>, <h3>, <p>, <ul>, <li>, <ol>, <strong>, <em>
Do NOT use code fences. Raw HTML only.
Make it feel like a real document, not a list dump.`;

      const html = await callAI(prompt, { temperature: 0.7, maxTokens: 8192 });
      setResult(html.replace(/```html|```/g, '').trim());
    } catch (err: unknown) {
      toast.error(`Forge gagal: ${err instanceof Error ? err.message : 'Error'}`);
    } finally {
      setIsForging(false);
    }
  };

  const handleForge = async () => {
    if (mode === 'narrative') await forgeNarrative();
    else if (mode === 'structured') setResult(buildStructuredHTML(project));
  };

  const handleExport = () => {
    if (!result) return;
    const date = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    printAsPDF(`${project.spark} — ${date}`, result);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-lg bg-card border border-border rounded-2xl shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <FileText size={18} className="text-primary" />
            <h2 className="font-display text-lg text-foreground">Forge Final Draft</h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-5">
          {!result ? (
            <>
              <p className="text-sm font-body text-muted-foreground mb-4">
                Choose a format for <strong className="text-foreground">"{project.spark}"</strong>
              </p>

              <div className="space-y-3 mb-6">
                <button onClick={() => setMode('narrative')}
                  className={`w-full text-left p-4 rounded-xl border transition-all ${mode === 'narrative' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'}`}>
                  <div className="flex items-start gap-3">
                    <Sparkles size={18} className="text-primary shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-body font-semibold text-foreground">Narrative — AI Craft</p>
                      <p className="text-xs font-body text-muted-foreground mt-0.5">AI merges all planning into a cohesive, flowing document</p>
                    </div>
                  </div>
                </button>

                <button onClick={() => setMode('structured')}
                  className={`w-full text-left p-4 rounded-xl border transition-all ${mode === 'structured' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'}`}>
                  <div className="flex items-start gap-3">
                    <List size={18} className="text-primary shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-body font-semibold text-foreground">Structured — Export As Is</p>
                      <p className="text-xs font-body text-muted-foreground mt-0.5">Export all boulders, pebbles, and answers in a structured format</p>
                    </div>
                  </div>
                </button>
              </div>

              <button onClick={handleForge} disabled={!mode || isForging}
                className="w-full py-2.5 text-sm font-body bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2">
                {isForging ? (
                  <><Loader2 size={14} className="animate-spin" />{mode === 'narrative' ? 'AI is forging…' : 'Composing…'}</>
                ) : (
                  <><FileText size={14} />Forge</>
                )}
              </button>
            </>
          ) : (
            <>
              <p className="text-xs font-body text-muted-foreground mb-3">✅ Document ready! Click Export to save as PDF.</p>
              <div className="border border-border rounded-lg p-4 max-h-64 overflow-y-auto text-sm font-body text-foreground prose prose-sm max-w-none
                [&>h1]:text-base [&>h1]:font-semibold [&>h1]:mb-2 [&>h2]:text-sm [&>h2]:font-semibold [&>h2]:mt-3 [&>h2]:mb-1 [&>p]:mb-2 [&>ul]:list-disc [&>ul]:pl-4"
                dangerouslySetInnerHTML={{ __html: result }} />
              <div className="flex gap-2 mt-4">
                <button onClick={handleExport}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-body bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity">
                  <Download size={14} />Export PDF
                </button>
                <button onClick={() => setResult(null)}
                  className="px-4 py-2.5 text-sm font-body text-muted-foreground border border-border rounded-lg hover:bg-secondary/50 transition-colors">
                  Start Over
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ForgeModal;