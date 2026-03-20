/**
 * Centralized AI helper — via Supabase Edge Function (ai-proxy)
 * Groq API key is safe on server side, never exposed to client
 */

import { supabase } from './supabase';

// ─── Credit costs per action ──────────────────────────────
export const CREDIT_COSTS = {
  AUTO_HAMMER: 10,
  HAMMER_BOULDER: 3,
  REFINE: 2,
  MORE_PEBBLES: 1,
  ANSWER: 3,
  FORGE_NARRATIVE: 15,
  FORGE_STRUCTURED: 0,
} as const;

export type CreditAction = keyof typeof CREDIT_COSTS;

interface CallAIOptions {
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
}

interface Message {
  role: 'system' | 'user';
  content: string;
}

// ─── Call AI via Edge Function ────────────────────────────
export async function callAI(
  messages: Message[] | string,
  options: CallAIOptions = {}
): Promise<string> {
  const normalizedMessages: Message[] = typeof messages === 'string'
    ? [{ role: 'user', content: messages }]
    : messages;

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const functionsUrl = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL;
  if (!functionsUrl) throw new Error('VITE_SUPABASE_FUNCTIONS_URL not found in .env');

  const response = await fetch(`${functionsUrl}/ai-proxy`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({
      messages: normalizedMessages,
      action: 'NONE', // no credit deduction for raw callAI
      options,
    }),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err?.error || `Edge Function error: ${response.status}`);
  }

  const data = await response.json();
  return data.content || '';
}

// ─── Call AI with credit deduction ───────────────────────
export async function callAIWithCredit(
  messages: Message[] | string,
  action: CreditAction,
  options: CallAIOptions = {}
): Promise<string> {
  const normalizedMessages: Message[] = typeof messages === 'string'
    ? [{ role: 'user', content: messages }]
    : messages;

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const functionsUrl = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL;
  if (!functionsUrl) throw new Error('VITE_SUPABASE_FUNCTIONS_URL not found in .env');

  const response = await fetch(`${functionsUrl}/ai-proxy`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({
      messages: normalizedMessages,
      action,
      options,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    if (data?.error === 'INSUFFICIENT_CREDITS') {
      throw new Error(`INSUFFICIENT_CREDITS:${data.credits ?? 0}`);
    }
    throw new Error(data?.error || `Edge Function error: ${response.status}`);
  }

  return data.content || '';
}

// ─── Get current user credits ─────────────────────────────
export async function getUserCredits(): Promise<number> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 0;

  await supabase.rpc('initialize_user_credits', { p_user_id: user.id });

  const { data } = await supabase
    .from('user_credits')
    .select('credits')
    .eq('user_id', user.id)
    .single();

  return data?.credits ?? 0;
}

// ─── Parse JSON array (fallback) ─────────────────────────
export function parseJsonArray(raw: string): string[] {
  const match = raw.match(/\[[\s\S]*\]/);
  if (!match) throw new Error('No JSON array found in response');
  try {
    return JSON.parse(match[0]);
  } catch {
    return match[0]
      .replace(/[\[\]]/g, '')
      .split('\n')
      .map(line => line.replace(/^[\s,"]+|[\s,"]+$/g, '').trim())
      .filter(line => line.length > 5);
  }
}

// ─── Prompt builders ──────────────────────────────────────

export function buildAnswerMessages(
  spark: string,
  boulderTitle: string,
  pebbleText: string,
  contextSection: string
): Message[] {
  return [
    {
      role: 'system',
      content: `You are a practical assistant that answers directly like a smart friend — not a consultant writing a report.

RULES:
1. Answer ONLY what is asked. Don't add unrelated topics.
2. NEVER fabricate data or statistics. If you don't have specific data:
   - For references/sources → give search keywords and platforms, not fake names
   - For numbers → use "generally..." or rough estimates with disclaimer
3. Match length to task type:
   - Factual/list tasks → 5-7 short punchy points
   - Creative/conceptual tasks → 1-2 sentences per point, stay focused
   - Technical tasks → detail as needed, nothing more
4. Write like a smart friend giving quick notes, NOT a consultant writing a report.
5. Avoid openers: "Sure!", "Here is...", "As an assistant...".
6. If task needs action → give actionable guidance, not placeholders.

FORMAT:
- 1 sentence summary wrapped in <p><strong>...</strong></p>
- Details using <ul><li> or <ol><li>
- Format: <li><strong>Label</strong> — short explanation</li>
- Use same language as the task
- Clean HTML, no code fences`,
    },
    {
      role: 'user',
      content: `Project: "${spark}"
Phase: "${boulderTitle}"
Task: "${pebbleText}"
${contextSection}`,
    },
  ];
}

export function buildHammerMessages(spark: string, boulderTitle: string): Message[] {
  return [
    {
      role: 'system',
      content: `You are a project planning assistant. Generate specific, actionable tasks for a project phase.
Return ONLY a valid JSON object: {"tasks": ["Task 1", "Task 2"]}
Rules:
- 3 to 5 tasks
- Specific to project and phase
- Use same language as project idea
- No generic tasks`,
    },
    {
      role: 'user',
      content: `Project: "${spark}"\nPhase: "${boulderTitle}"`,
    },
  ];
}

export function buildAutoHammerMessages(spark: string): Message[] {
  return [
    {
      role: 'system',
      content: `You are an expert project planner. Break down project ideas into phases with specific tasks.
Return ONLY this exact JSON structure:
{"phases": [{"title": "Phase name", "pebbles": ["Task 1", "Task 2", "Task 3"]}]}

CRITICAL: Every phase MUST have a "pebbles" array with 2-4 specific tasks.
Rules:
- 3 to 5 phases
- 2 to 4 tasks per phase — THIS IS MANDATORY, never leave pebbles empty
- Tailor everything to the specific project
- Use same language as project idea
- Be specific, not generic`,
    },
    {
      role: 'user',
      content: `Project idea: "${spark}"`,
    },
  ];
}

export function buildRefineMessages(
  spark: string,
  boulderTitle: string,
  existingTasks: string,
  feedback: string
): Message[] {
  return [
    {
      role: 'system',
      content: `You are a project planning assistant. Revise task lists based on user feedback.
Return ONLY a valid JSON object: {"tasks": ["Revised Task 1", "Revised Task 2"]}
Use same language as the project idea.`,
    },
    {
      role: 'user',
      content: `Project: "${spark}", Phase: "${boulderTitle}"
Current tasks:
${existingTasks}
User feedback: "${feedback}"`,
    },
  ];
}

export function buildMorePebblesMessages(
  spark: string,
  boulderTitle: string,
  existingTasks: string
): Message[] {
  return [
    {
      role: 'system',
      content: `You are a project planning assistant. Add complementary tasks to an existing task list.
Return ONLY a valid JSON object: {"tasks": ["New Task 1", "New Task 2"]}
DO NOT repeat existing tasks. Use same language as project idea.`,
    },
    {
      role: 'user',
      content: `Project: "${spark}", Phase: "${boulderTitle}"
Existing tasks (DO NOT repeat):
${existingTasks}
Add 2-3 new complementary tasks.`,
    },
  ];
}

export function buildForgeMessages(spark: string, context: string): Message[] {
  return [
    {
      role: 'system',
      content: `You are a professional document writer. Transform project planning data into a cohesive narrative document.
Format in clean HTML using: <h1>, <h2>, <h3>, <p>, <ul>, <li>, <ol>, <strong>, <em>
No code fences. Raw HTML only.
Make it feel like a real document, not a list dump.
Use same language as the project title.`,
    },
    {
      role: 'user',
      content: `Project: "${spark}"

Planning data:
${context}

Write a professional document that:
1. Starts with an executive summary
2. Flows naturally from phase to phase
3. Integrates answers and details into readable prose
4. Ends with conclusion or next steps`,
    },
  ];
}