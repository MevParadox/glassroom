import { useState } from 'react';
import { Hammer } from 'lucide-react';
import { Boulder, Pebble } from '@/lib/types';
import { generateId } from '@/lib/store';
import { toast } from 'sonner';
import { callAIWithCredit, parseJsonArray, buildAutoHammerPrompt, getUserCredits } from '@/lib/ai';

interface AutoHammerProps {
  spark: string;
  onGenerated: (boulders: Boulder[]) => void;
  onInsufficientCredits?: () => void;
}

const AutoHammer = ({ spark, onGenerated, onInsufficientCredits }: AutoHammerProps) => {
  const [isHammering, setIsHammering] = useState(false);

  const hammer = async () => {
    setIsHammering(true);
    try {
      const raw = await callAIWithCredit(
        buildAutoHammerPrompt(spark),
        'AUTO_HAMMER',
        { temperature: 0.7, maxTokens: 2000 }
      );

      const match = raw.match(/\[[\s\S]*\]/);
      if (!match) throw new Error('Invalid response format');
      const parsed = JSON.parse(match[0]);

      const boulders: Boulder[] = parsed.map((phase: { title: string; pebbles: string[] }) => ({
        id: generateId(),
        title: phase.title,
        pebbles: phase.pebbles.map((text: string) => ({
          id: generateId(), text, status: 'todo' as Pebble['status'],
        })),
      }));

      onGenerated(boulders);
      toast.success('Boulders & pebbles generated! ✨');

      const remaining = await getUserCredits();
      toast(`${remaining} credits remaining`, { duration: 2000 });

    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error';
      if (message.startsWith('INSUFFICIENT_CREDITS')) {
        const remaining = message.split(':')[1] || '0';
        toast.error(`Not enough credits (${remaining} left). Top up to continue.`);
        onInsufficientCredits?.();
      } else {
        toast.error(`Auto Hammer failed: ${message}`);
      }
    } finally {
      setIsHammering(false);
    }
  };

  return (
    <button
      onClick={hammer}
      disabled={isHammering}
      className="flex items-center gap-2 px-4 py-2 text-sm font-body bg-foreground text-background rounded-md hover:opacity-90 transition-opacity disabled:opacity-50 whitespace-nowrap shrink-0"
    >
      <Hammer size={14} className={isHammering ? 'animate-bounce' : ''} />
      {isHammering ? 'Hammering…' : 'Auto Hammer'}
    </button>
  );
};

export default AutoHammer;