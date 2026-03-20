/**
 * Centralized AI helper — Groq (Llama 3.3 70B)
 * With credit system integration via Supabase
 */

import { supabase } from './supabase';

const GROQ_MODEL = 'llama-3.3-70b-versatile';
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

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
}

// ─── Raw AI call (no credit check) ───────────────────────
export async function callAI(prompt: string, options: CallAIOptions = {}): Promise<string> {
  const apiKey = import.meta.env.VITE_GROQ_API_KEY;
  if (!apiKey) throw new Error('VITE_GROQ_API_KEY not found in .env');

  const response = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: options.temperature ?? 0.5,
      max_tokens: options.maxTokens ?? 8192,
    }),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err?.error?.message || `Groq API error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

// ─── AI call WITH credit check & deduct ──────────────────
export async function callAIWithCredit(
  prompt: string,
  action: CreditAction,
  options: CallAIOptions = {}
): Promise<string> {
  const cost = CREDIT_COSTS[action];

  // Free actions skip credit check
  if (cost > 0) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Deduct credits
    const { data, error } = await supabase.rpc('deduct_credits', {
      p_user_id: user.id,
      p_amount: cost,
      p_action: action.toLowerCase(),
      p_description: action,
    });

    if (error) throw new Error('Failed to process credits');
    if (!data.success) {
      throw new Error(`INSUFFICIENT_CREDITS:${data.credits ?? 0}`);
    }
  }

  return callAI(prompt, options);
}

// ─── Get current credits ──────────────────────────────────
export async function getUserCredits(): Promise<number> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 0;

  // Initialize if new user
  await supabase.rpc('initialize_user_credits', { p_user_id: user.id });

  const { data } = await supabase
    .from('user_credits')
    .select('credits')
    .eq('user_id', user.id)
    .single();

  return data?.credits ?? 0;
}

// ─── Parse JSON array dari response AI ───────────────────
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

// ─── Prompt templates ─────────────────────────────────────

export function buildAnswerPrompt(
  spark: string,
  boulderTitle: string,
  pebbleText: string,
  contextSection: string
): string {
  return `You are a practical assistant that answers directly like a smart friend — not a consultant writing a report.

Project: "${spark}"
Phase: "${boulderTitle}"
Task: "${pebbleText}"
${contextSection}
RULES:
1. Answer ONLY what is asked. Don't add unrelated topics.
2. NEVER fabricate data or statistics. If you don't have specific data:
   - For references/sources → give search keywords and platforms, not fake names
   - For numbers → use "generally..." or rough estimates with disclaimer
   - For specific facts → acknowledge limitation and suggest how to find it
3. Match length to task type:
   - Factual/list tasks → 5-7 short punchy points
   - Creative/conceptual tasks → 1-2 sentences per point, stay focused
   - Technical tasks → detail as needed, nothing more
4. Write like a smart friend giving quick notes, NOT a consultant writing a report.
5. Avoid openers: "Sure!", "Here is...", "As an assistant...".
6. If task needs action (search, buy, contact) → give actionable guidance, not placeholders.

FORMAT:
- 1 sentence summary wrapped in <p><strong>...</strong></p>
- Details using <ul><li> or <ol><li>
- Format: <li><strong>Label</strong> — short explanation</li>
- Use same language as the task
- Clean HTML, no code fences

EXAMPLE for "Determine target users for Fix My Landing Page app":
<p><strong>Small business owners & freelancers whose landing pages don't convert.</strong></p>
<ul>
<li><strong>Freelancers/solopreneurs</strong> — sell digital services, no agency budget</li>
<li><strong>New online SMBs</strong> — built their own landing page, results suboptimal</li>
<li><strong>Early-stage startups</strong> — need quick feedback before scaling</li>
</ul>

EXAMPLE for "Collect academic journal references":
<p><strong>Search Google Scholar and PubMed with these specific keywords.</strong></p>
<ul>
<li><strong>Search keywords</strong> — "cognitive overload", "ADHD executive function", "mind wandering", "mental noise"</li>
<li><strong>Google Scholar</strong> — scholar.google.com, filter by year 2018-present</li>
<li><strong>PubMed</strong> — pubmed.ncbi.nlm.nih.gov, free and peer-reviewed</li>
<li><strong>Frontiers in Psychology</strong> — open access, many cognitive flexibility articles</li>
</ul>`;
}

export function buildHammerPrompt(spark: string, boulderTitle: string): string {
  return `You are a project planning assistant.
Project idea: "${spark}"
Phase/Boulder: "${boulderTitle}"
Generate specific, actionable tasks for this phase.
Return ONLY a valid JSON array of task strings, no explanation, no markdown, no backticks:
["Task 1", "Task 2", "Task 3"]
Rules:
- 3 to 5 tasks
- Specific to project and phase
- Use same language as project idea
- No generic tasks`;
}

export function buildAutoHammerPrompt(spark: string): string {
  return `You are an expert project planner. Break down this project idea into concrete, actionable phases and tasks.

Project idea: "${spark}"

IMPORTANT RULES:
- Tailor EVERYTHING specifically to this project idea
- Phase titles must reflect actual stages of THIS specific project
- Tasks must be concrete actions for THIS project
- No generic tasks unless truly relevant
- Use the same language as the project idea
- Be specific: instead of "Build core features", say what the actual feature is

Return ONLY a valid JSON array, no explanation, no markdown, no backticks:
[
  {
    "title": "Phase name specific to this project",
    "pebbles": ["Specific task 1", "Specific task 2", "Specific task 3"]
  }
]

Constraints:
- 3 to 5 phases
- 2 to 4 tasks per phase
- Every item must be directly relevant to: "${spark}"`;
}

export function buildRefinePrompt(spark: string, boulderTitle: string, existingTasks: string, feedback: string): string {
  return `Project: "${spark}", Phase: "${boulderTitle}"
Current tasks:
${existingTasks}
User feedback: "${feedback}"
Revise tasks based on feedback. Return ONLY JSON array: ["Task 1", "Task 2"]
Use same language as project idea.`;
}

export function buildMorePebblesPrompt(spark: string, boulderTitle: string, existingTasks: string): string {
  return `Project: "${spark}", Phase: "${boulderTitle}"
Existing tasks (DO NOT repeat): ${existingTasks}
Add 2-3 new complementary tasks. Return ONLY JSON array: ["New Task 1", "New Task 2"]
Use same language as project idea.`;
}