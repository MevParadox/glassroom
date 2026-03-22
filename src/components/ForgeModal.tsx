import { useState } from 'react';
import { Project, Pebble } from '@/lib/types';
import { X, Sparkles, List, Loader2, Download, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { callAIWithCredit, buildForgeMessages } from '@/lib/ai';

interface ForgeModalProps {
  project: Project;
  onClose: () => void;
  onInsufficientCredits?: () => void;
  onCreditsChanged?: () => void;
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

function getStatusSymbol(status: Pebble['status']): string {
  if (status === 'done') return '✅';
  if (status === 'in-progress') return '🔄';
  return '☐';
}

function printAsPDF(title: string, htmlContent: string) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    toast.error('Pop-up blocked. Please allow pop-ups and try again.');
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
        body { font-family: 'DM Sans', system-ui, sans-serif; font-size: 11pt; line-height: 1.7; color: #1a1a1a; padding: 40px 48px; max-width: 800px; margin: 0 auto; }
        h1 { font-size: 22pt; font-weight: 600; margin-bottom: 6px; color: #111; }
        h2 { font-size: 13pt; font-weight: 600; margin-top: 28px; margin-bottom: 4px; color: #222; border-bottom: 2px solid #111; padding-bottom: 4px; }
        h3 { font-size: 11pt; font-weight: 600; margin-top: 14px; margin-bottom: 4px; color: #333; }
        p { margin-bottom: 6px; }
        ul, ol { padding-left: 20px; margin-bottom: 8px; }
        li { margin-bottom: 3px; }
        strong { font-weight: 600; }
        em { font-style: italic; color: #555; }
        .meta { font-size: 9pt; color: #888; margin-bottom: 20px; }
        .divider { border: none; border-top: 1px solid #ddd; margin: 16px 0; }
        .boulder-summary { font-style: italic; color: #555; font-size: 10pt; margin-bottom: 10px; padding: 8px 12px; background: #f9f9f9; border-left: 3px solid #ddd; border-radius: 2px; }
        .pebble { margin: 8px 0 8px 0; }
        .pebble-title { font-weight: 500; }
        .pebble-answer { margin: 4px 0 4px 16px; font-size: 10pt; color: #444; }
        .pebble-answer ul, .pebble-answer ol { margin: 2px 0; padding-left: 16px; }
        .pebble-answer li { margin-bottom: 2px; }
        .status { display: inline-block; margin-right: 6px; }
        .notes { font-style: italic; color: #888; font-size: 9.5pt; margin-top: 4px; padding-left: 16px; }
        @media print { body { padding: 20px; } h2 { page-break-before: auto; } }
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

// ✅ Structured — printable checklist with boulder summaries
function buildStructuredHTML(project: Project): string {
  const date = new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
  const totalPebbles = project.boulders.reduce((s, b) => s + b.pebbles.length, 0);
  const donePebbles = project.boulders.reduce((s, b) => s + b.pebbles.filter(p => p.status === 'done').length, 0);

  let html = `
    <h1>${project.spark}</h1>
    <p class="meta">Printed on ${date} · The Glass Room · ${donePebbles}/${totalPebbles} tasks done</p>
    <hr class="divider">
  `;

  project.boulders.forEach((boulder, bIdx) => {
    const boulderDone = boulder.pebbles.filter(p => p.status === 'done').length;
    const boulderTotal = boulder.pebbles.length;

    html += `<h2>${bIdx + 1}. ${boulder.title} <span style="font-weight:400; font-size:10pt; color:#888">(${boulderDone}/${boulderTotal})</span></h2>`;

    // Boulder summary — what this phase is about, derived from pebble titles
    if (boulder.pebbles.length > 0) {
      const pebbleTitles = boulder.pebbles.map(p => p.text).join(', ');
      html += `<div class="boulder-summary">This phase covers: ${pebbleTitles}.</div>`;
    }

    boulder.pebbles.forEach((pebble) => {
      const symbol = getStatusSymbol(pebble.status);
      html += `<div class="pebble">`;
      html += `<div class="pebble-title"><span class="status">${symbol}</span>${pebble.text}</div>`;

      if (pebble.content) {
        html += `<div class="pebble-answer">${pebble.content}</div>`;
      }

      if (pebble.notes) {
        html += `<div class="notes">📝 ${pebble.notes}</div>`;
      }

      html += `</div>`;
    });

    if (bIdx < project.boulders.length - 1) {
      html += `<hr class="divider">`;
    }
  });

  return html;
}

const ForgeModal = ({ project, onClose, onInsufficientCredits, onCreditsChanged }: ForgeModalProps) => {
  const [mode, setMode] = useState<ForgeMode>(null);
  const [isForging, setIsForging] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const forgeNarrative = async () => {
    setIsForging(true);
    try {
      const context = project.boulders.map(b => {
        const pebbleContext = b.pebbles.map(p => {
          let pText = `- ${p.text} [${p.status}]`;
          if (p.content) pText += `\n  Answer: ${stripHtml(p.content).substring(0, 400)}`;
          if (p.notes) pText += `\n  Notes: ${p.notes}`;
          return pText;
        }).join('\n');
        return `### ${b.title}\n${pebbleContext}`;
      }).join('\n\n');

      const html = await callAIWithCredit(
        buildForgeMessages(project.spark, context),
        'FORGE_NARRATIVE',
        { temperature: 0.7, maxTokens: 8192 }
      );

      setResult(html.replace(/```html|```/g, '').trim());
      onCreditsChanged?.();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error';
      if (message.startsWith('INSUFFICIENT_CREDITS')) {
        const remaining = message.split(':')[1] || '0';
        toast.error(`Not enough Shards (${remaining} left).`);
        onClose();
        onInsufficientCredits?.();
      } else {
        toast.error(`Forge failed: ${message}`);
      }
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
    const date = new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
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
                Export <strong className="text-foreground">"{project.spark}"</strong> as a document
              </p>

              <div className="space-y-3 mb-6">
                {/* Structured */}
                <button onClick={() => setMode('structured')}
                  className={`w-full text-left p-4 rounded-xl border transition-all ${mode === 'structured' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'}`}>
                  <div className="flex items-start gap-3">
                    <List size={18} className="text-primary shrink-0 mt-0.5" />
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-body font-semibold text-foreground">Structured — Print & Checklist</p>
                        <span className="text-[10px] font-body px-1.5 py-0.5 bg-muted text-muted-foreground rounded-full">Free</span>
                      </div>
                      <p className="text-xs font-body text-muted-foreground mt-0.5">All your brainstorming in one printable sheet — with checkboxes, answers, and phase summaries</p>
                    </div>
                  </div>
                </button>

                {/* Narrative */}
                <button onClick={() => setMode('narrative')}
                  className={`w-full text-left p-4 rounded-xl border transition-all ${mode === 'narrative' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'}`}>
                  <div className="flex items-start gap-3">
                    <Sparkles size={18} className="text-primary shrink-0 mt-0.5" />
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-body font-semibold text-foreground">Narrative — Share-ready Document</p>
                        <span className="text-[10px] font-body px-1.5 py-0.5 bg-primary/10 text-primary rounded-full">15 Shards</span>
                      </div>
                      <p className="text-xs font-body text-muted-foreground mt-0.5">AI expands your planning into a readable document — for sharing with clients, investors, or your team</p>
                    </div>
                  </div>
                </button>
              </div>

              <button onClick={handleForge} disabled={!mode || isForging}
                className="w-full py-2.5 text-sm font-body bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2">
                {isForging ? (
                  <><Loader2 size={14} className="animate-spin" />{mode === 'narrative' ? 'AI is expanding your plan…' : 'Building your checklist…'}</>
                ) : (
                  <><FileText size={14} />Forge</>
                )}
              </button>
            </>
          ) : (
            <>
              <p className="text-xs font-body text-muted-foreground mb-3">
                ✅ Ready! Click Export to open print dialog.
              </p>
              <div className="border border-border rounded-lg p-4 max-h-64 overflow-y-auto text-sm font-body text-foreground prose prose-sm max-w-none
                [&>h1]:text-base [&>h1]:font-semibold [&>h1]:mb-1
                [&>h2]:text-sm [&>h2]:font-semibold [&>h2]:mt-3 [&>h2]:mb-1
                [&>p]:mb-2 [&>ul]:list-disc [&>ul]:pl-4 [&>ol]:list-decimal [&>ol]:pl-4"
                dangerouslySetInnerHTML={{ __html: result }} />
              <div className="flex gap-2 mt-4">
                <button onClick={handleExport}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-body bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity">
                  <Download size={14} />Export / Print
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