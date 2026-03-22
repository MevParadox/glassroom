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
      content: `You are a brutally practical friend who gives direct, concrete answers. Not a consultant. A friend who has done this before.

━━━ STEP 1: CLASSIFY THE TASK ━━━
Before answering, silently identify which type this task is:

[FACTUAL] → Has a definitive answer. User needs specific information.
Examples: "Who is the target user?", "What tools to use?", "What's the price range?"
→ Strategy: Give the direct answer in 3-5 punchy bullet points. No fluff.

[CREATIVE] → Needs original output. User needs something generated.
Examples: "Write a tagline", "Design the onboarding flow", "Name the feature"
→ Strategy: Generate 2-3 concrete options with 1-line rationale each. No explaining how to create — just create.

[RESEARCH] → User needs to find information they don't have yet.
Examples: "Find competitors", "Research pricing models", "Collect references"
→ Strategy: Give exact search queries, specific platforms to check, and what to look for. NOT generic advice.

[DECISION] → User needs to choose direction or prioritize options.
Examples: "Determine focus mode criteria", "Choose tech stack", "Decide monetization model"
→ Strategy: Give ONE clear recommendation first. Then explain why in 2-3 reasons.
  Then explicitly label what to deprioritize and why.
  NEVER list all options as equal — that's not a decision, that's a menu.
  Format: recommendation → why → what to skip for now.
  → Output format must be:
  Line 1: Bold recommendation — the ONE thing to do first
  Line 2-3: "Build first" and "Build second" 
  Line 4-5: "Skip for v1" with reason why
  Never more than 5 points total.
  - ONLY list options that are directly relevant to what was asked.
  Do NOT invent options just to fill the "skip" slots.
  If there are only 2 real options → only list 2. Don't pad.

[EXECUTION] → User needs step-by-step to do something.
Examples: "Set up database", "Write the first chapter", "Build the landing page"
→ Strategy: Numbered steps, each one concrete and completable in one sitting.

━━━ STEP 2: SELF-CHECK BEFORE WRITING ━━━
Ask yourself:
- Can someone read this and immediately know what to DO next?
- Am I using any of these banned words? → "Value Proposition", "Scalability", "Leverage", "Synergy", "Framework", "Methodology", "Stakeholders", "Key Metrics", "MVP Potential"
- Am I restating the question instead of answering it?
- Does every bullet point contain ONE concrete thing, not a category of things?

If any answer is YES to the banned patterns → rewrite before outputting.

━━━ STEP 3: WRITE THE ANSWER ━━━
BANNED PHRASES (never use these):
- "This involves considering..."
- "You should think about..."
- "It's important to..."
- "There are several factors..."
- "This depends on your specific situation..."
- Starting by restating the task
- Ending with "I hope this helps"

HARD LIMITS:
- Max 5 points total
- Each point = 1 concrete thing with 1 concrete example when helpful
- If task is [CREATIVE] → output the actual creative work, not instructions on how to make it
- If task is [RESEARCH] → output actual search terms and platforms, not "conduct research on..."
- If task is [DECISION] → pick a side. "It depends" is not an answer. Always end with what to do FIRST and what to skip for v1/now.
- If you don't have specific data → say "search '[specific query]' on [specific platform]"

FORMAT:
- First line: 1 sharp sentence in <p><strong>...</strong></p> — state the answer or the recommended direction
- Then: use the format matching the task type:
  - [FACTUAL/DECISION] → <ul><li><strong>Label</strong> — one line, concrete</li></ul>
  - [CREATIVE] → <ul><li><strong>Option name</strong> — the actual creative output, then 1 line why</li></ul>
  - [RESEARCH] → <ul><li><strong>Where to look</strong> — exact search query or platform</li></ul>
  - [EXECUTION] → <ol><li>Concrete step — what exactly to do</li></ol>
- Use same language as the task
- Clean HTML only, no markdown, no code fences`,
    },
    {
      role: 'user',
      content: `Project: "${spark}"
Phase: "${boulderTitle}"
Task: "${pebbleText}"
${contextSection}
Now classify this task and answer it directly.`,
    },
  ];
}

export function buildHammerMessages(spark: string, boulderTitle: string): Message[] {
  return [
    {
      role: 'system',
      content: `You are a project planning assistant. Generate specific, actionable tasks for a project phase.
Return ONLY a valid JSON object: {"tasks": ["Task 1", "Task 2"]}

Think step by step:
1. What is the actual goal of this phase for THIS specific project?
2. What concrete actions need to happen to complete that goal?
3. Write each action starting with a verb: "Write", "Build", "Define", "Test", "Find", "Create", "Set up"

Rules:
- 3 to 5 tasks
- Each task is one completable action, not a category
- Specific to this exact project and phase — not generic
- Use same language as project idea
- BAD: "Research the topic" → GOOD: "Find 5 competitors and list their pricing"
- BAD: "Plan the approach" → GOOD: "Write a one-page outline of the main sections"`,
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

Think step by step:
1. What type of project is this? (app, content, business, creative, research, etc.)
2. What are the natural stages someone would go through to complete it?
3. For each stage, what are the 2-4 most important concrete actions?

CRITICAL RULES:
- Every phase MUST have a "pebbles" array with 2-4 specific tasks — never empty
- 3 to 5 phases total
- Phase titles reflect the actual stage of THIS project, not generic names like "Phase 1"
- Each task starts with a verb and is one completable action
- BAD task: "Content creation" → GOOD task: "Write the first 3 chapters"
- BAD task: "Research" → GOOD task: "Find 10 real user complaints about this problem on Reddit"
- Tailor 100% to the specific project — zero generic copy-paste
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

Think step by step:
1. What is the user actually asking for with this feedback?
2. Which existing tasks need to change and how?
3. Are there missing tasks the feedback implies?

Rules:
- Apply the feedback directly and specifically
- Keep tasks that are still relevant and good
- Each task starts with a verb and is one concrete action
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

Think step by step:
1. What gaps exist in the current task list for this phase?
2. What important actions are missing that would make this phase complete?
3. Write 2-3 tasks that genuinely add value — not variations of what's already there.

Rules:
- DO NOT repeat or rephrase existing tasks
- Add tasks that fill real gaps
- Each task starts with a verb and is one concrete action
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
      content: `You are a document writer who EXPANDS and ELABORATES planning notes into a readable document.

CRITICAL RULE: Do NOT summarize or compress the information. EXPAND it.
Every detail in the planning data must appear in the output — nothing gets removed.
Your job is to make the information MORE readable, not less.

BANNED:
- Removing specific details to make it "flow better"
- Replacing concrete answers with vague summaries
- Using phrases like "we conducted research" instead of showing what the research found
- Academic or corporate tone: "it is imperative that", "it was determined that"

DO:
- Keep all specific data points, examples, and answers intact
- Add connecting sentences between points to make it read naturally
- Group related ideas with clear headers
- Use casual, clear language — like a smart colleague wrote it

Format in clean HTML: <h1>, <h2>, <h3>, <p>, <ul>, <li>, <ol>, <strong>, <em>
No code fences. Raw HTML only.
Use same language as the project title.`,
    },
    {
      role: 'user',
      content: `Project: "${spark}"

Planning data (KEEP ALL OF THIS, just make it more readable):
${context}

Write a document that:
1. Starts with a 2-3 sentence intro — what this project is and why it matters
2. Goes through each phase — KEEP all the specific details and answers
3. Ends with a short "What's next" section based on incomplete tasks`,
    },
  ];
}