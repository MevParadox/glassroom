import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

// ─── Credit costs per action ──────────────────────────────
export const CREDIT_COSTS = {
  AUTO_HAMMER: 10,
  HAMMER_BOULDER: 3,
  REFINE: 2,
  MORE_PEBBLES: 1,
  ANSWER: 3,
  FORGE_NARRATIVE: 15,
  FORGE_STRUCTURED: 0, // no AI, free
} as const;

export type CreditAction = keyof typeof CREDIT_COSTS;

export function useCredits() {
  const [credits, setCredits] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  // Load credits dari Supabase
  const loadCredits = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Initialize credits kalau belum ada (user baru)
      await supabase.rpc('initialize_user_credits', { p_user_id: user.id });

      // Ambil credits
      const { data, error } = await supabase
        .from('user_credits')
        .select('credits')
        .eq('user_id', user.id)
        .single();

      if (error) throw error;
      setCredits(data.credits);
    } catch (err) {
      console.error('Failed to load credits:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCredits();
  }, [loadCredits]);

  // Deduct credits — returns true kalau berhasil, false kalau tidak cukup
  const deductCredits = useCallback(async (action: CreditAction, description?: string): Promise<boolean> => {
    const cost = CREDIT_COSTS[action];
    if (cost === 0) return true; // free action

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { data, error } = await supabase.rpc('deduct_credits', {
      p_user_id: user.id,
      p_amount: cost,
      p_action: action.toLowerCase(),
      p_description: description || action,
    });

    if (error || !data.success) {
      return false;
    }

    setCredits(data.credits);
    return true;
  }, []);

  // Cek apakah cukup credit untuk action tertentu
  const hasCredits = useCallback((action: CreditAction): boolean => {
    if (credits === null) return false;
    return credits >= CREDIT_COSTS[action];
  }, [credits]);

  // Tambah credits setelah purchase (dipanggil dari webhook/modal)
  const addCredits = useCallback(async (amount: number, description?: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.rpc('add_credits', {
      p_user_id: user.id,
      p_amount: amount,
      p_description: description || 'Credit purchase',
    });

    setCredits(prev => (prev ?? 0) + amount);
  }, []);

  return {
    credits,
    loading,
    deductCredits,
    hasCredits,
    addCredits,
    refreshCredits: loadCredits,
    CREDIT_COSTS,
  };
}