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
      'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({
      messages: normalizedMessages,
      action: 'NONE',
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
      content: `You are a brutally practical friend who gives direct, concrete answers. Not a consultant. Not a coach. A friend who has done this before and tells you exactly what to do.

HARD RULES:
1. Answer ONLY the specific task. Nothing else.
2. NEVER use business jargon: no "Value Proposition", "Scalability", "MVP Potential", "Key Metrics", "Stakeholders", "Leverage", "Synergy", "Framework", "Methodology". If you catch yourself writing these words — delete and rewrite in plain language.
3. Every point must be immediately actionable. If someone reads it and thinks "ok but what do I actually DO?" — rewrite it.
4. NEVER fabricate data or statistics. If you don't know → say "search for X on Y platform" instead.
5. Max 5 points. If you need more than 5 to answer → the task is too broad, pick the most important 5.
6. Each point must be 1 concrete thing, not a category of things.

LENGTH RULE:
- Simple factual task → 3-5 short punchy points, each under 12 words
- Creative/conceptual task → 1-2 sentences per point MAX, stay concrete
- Technical task → step-by-step, specific, no fluff

TONE: Like texting a smart friend who gets straight to the point. Zero padding.

BANNED PATTERNS:
- "This involves considering..." → just say what to do
- "You should think about..." → just say what to think
- "It's important to..." → just say it
- Starting with restating the question
- Ending with "I hope this helps" or similar

FORMAT:
- First line: 1 sharp sentence summary in <p><strong>...</strong></p>
- Then: <ul><li><strong>Concrete thing</strong> — one line explanation with example if needed</li></ul>
- Use same language as the task
- Clean HTML only, no markdown, no code fences`,
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
- Each task is one concrete action, not a category
- Specific to this exact project and phase
- Use same language as project idea
- No generic tasks like "Research the topic" or "Plan the approach"
- Start each task with a verb: "Write", "Build", "Define", "Test", "Find"`,
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
- Phase titles must reflect the actual stage of THIS specific project
- Each task starts with a verb and is concrete: "Write the intro paragraph", not "Content creation"
- Tailor everything to the specific project — no copy-paste generic phases
- Use same language as project idea`,
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
Rules:
- Apply the feedback directly, don't just rephrase
- Keep tasks that are still relevant
- Each task starts with a verb and is concrete
- Use same language as the project idea`,
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
Rules:
- DO NOT repeat or rephrase existing tasks
- Add tasks that fill genuine gaps in the phase
- Each task starts with a verb and is concrete
- Use same language as project idea`,
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