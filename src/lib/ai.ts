/**
 * Centralized AI helper — Groq (Llama 3.3 70B)
 * Ganti API key di .env: VITE_GROQ_API_KEY=gsk_xxxxxxxx
 */

const GROQ_MODEL = 'llama-3.3-70b-versatile';
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

interface CallAIOptions {
  temperature?: number;
  maxTokens?: number;
}

// ─── General text completion ──────────────────────────────
export async function callAI(prompt: string, options: CallAIOptions = {}): Promise<string> {
  const apiKey = import.meta.env.VITE_GROQ_API_KEY;
  if (!apiKey) throw new Error('VITE_GROQ_API_KEY tidak ditemukan di .env');

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

// ─── Parse JSON array dari response AI ───────────────────
export function parseJsonArray(raw: string): string[] {
  const match = raw.match(/\[[\s\S]*\]/);
  if (!match) throw new Error('Tidak ada JSON array ditemukan di response');

  try {
    return JSON.parse(match[0]);
  } catch {
    // Fallback: extract teks per baris kalau JSON invalid
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
  return `Kamu adalah asisten yang memberikan jawaban langsung dan praktis. Pengguna sedang mengerjakan sebuah project dan butuh jawaban KONKRET untuk task berikut.

Project: "${spark}"
Fase saat ini: "${boulderTitle}"
Task: "${pebbleText}"
${contextSection}
ATURAN KETAT:
1. Jawab HANYA apa yang ditanyakan di task. Jangan tambah topik lain yang tidak diminta.
2. JANGAN mengarang data, statistik, atau hasil riset. Kalau tidak punya data spesifik, gunakan "secara umum..." atau "berdasarkan tren yang ada...".
3. JANGAN beri framework atau cara berpikir — langsung kasih jawabannya.
4. Maksimal 5-7 poin kecuali task memang membutuhkan output panjang (misal: script, rencana lengkap).
5. Kalau task ambigu, jawab dengan asumsi paling masuk akal dan sebutkan asumsinya.
6. Tulis seperti teman pintar yang kasih catatan cepat, BUKAN konsultan yang bikin laporan.
7. Setiap poin maksimal 8-10 kata. Padat. Scannable. Tanpa basa-basi.
8. Hindari kalimat pembuka seperti "Tentu saja...", "Berikut adalah...", "Sebagai asisten...".

FORMAT:
- Mulai dengan 1 kalimat summary singkat dibungkus <p><strong>...</strong></p>
- Gunakan <ul><li> untuk poin-poin — setiap li maksimal 10 kata
- Format poin: <li><strong>Label singkat</strong> — penjelasan pendek</li>
- Gunakan bahasa yang sama dengan task
- HTML bersih tanpa code fences

CONTOH BENAR untuk task "Tentukan target user aplikasi Fix My Landing Page":
<p><strong>Pemilik bisnis kecil & freelancer yang landing page-nya tidak convert.</strong></p>
<ul>
<li><strong>Freelancer/solopreneur</strong> — jual jasa digital, ga punya budget agensi</li>
<li><strong>UMKM baru online</strong> — bikin landing page sendiri, hasilnya kurang optimal</li>
<li><strong>Startup early-stage</strong> — butuh feedback cepat sebelum scale</li>
</ul>

CONTOH SALAH (jangan lakukan ini):
- Mengarang "riset menunjukkan bahwa 80% UMKM mengalami..."
- Menjawab soal kompetitor padahal task hanya tanya target user
- Memberi framework "untuk menentukan target user, pertimbangkan..."`;
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
- No generic tasks like "Research existing solutions" unless truly relevant
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