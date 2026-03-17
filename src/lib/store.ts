import { supabase } from './supabase';
import { Idea, Project, Pebble, Boulder } from './types';

export function generateId(): string {
  return crypto.randomUUID();
}

async function getUserId(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  return user.id;
}

// ─── IDEAS ────────────────────────────────────────────────

export async function getIdeas(): Promise<Idea[]> {
  const userId = await getUserId();
  const { data, error } = await supabase
    .from('ideas')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(row => ({
    id: row.id,
    text: row.text,
    createdAt: row.created_at,
  }));
}

export async function saveIdeas(ideas: Idea[]): Promise<void> {
  const userId = await getUserId();

  // Hapus semua idea user, lalu insert ulang
  await supabase.from('ideas').delete().eq('user_id', userId);

  if (ideas.length > 0) {
  const { error: insertError } = await supabase.from('ideas').insert(
    ideas.map(idea => ({
      id: idea.id,
      user_id: userId,
      text: idea.text,
    }))
  );
  if (insertError) console.error('Insert error detail:', insertError);
}
}

// ─── CRYOCHAMBER (sama struktur sama ideas) ───────────────

const CRYO_KEY = 'glassroom-cryo'; // tetap localStorage untuk sekarang

export function getCryochamber(): Idea[] {
  try {
    const raw = localStorage.getItem(CRYO_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function saveCryochamber(ideas: Idea[]): void {
  localStorage.setItem(CRYO_KEY, JSON.stringify(ideas));
}

// ─── PROJECTS (dengan nested boulders + pebbles) ──────────

export async function getProjects(): Promise<Project[]> {
  const userId = await getUserId();

  const { data: projectRows, error } = await supabase
    .from('projects')
    .select(`
      *,
      boulders (
        *,
        pebbles (*)
      )
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;

  return (projectRows || []).map(p => ({
    id: p.id,
    spark: p.spark,
    archived: p.archived,
    createdAt: p.created_at,
    boulders: (p.boulders || [])
      .sort((a: any, b: any) => a.position - b.position)
      .map((b: any) => ({
        id: b.id,
        title: b.title,
        pebbles: (b.pebbles || [])
          .sort((x: any, y: any) => x.position - y.position)
          .map((pebble: any) => ({
            id: pebble.id,
            text: pebble.text,
            status: pebble.status as Pebble['status'],
            content: pebble.content,
            notes: pebble.notes,
            attachments: pebble.attachments || [],
          })),
      })),
  }));
}

export async function saveProjects(projects: Project[]): Promise<void> {
  const userId = await getUserId();

  for (const project of projects) {
    // Upsert project
    await supabase.from('projects').upsert({
      id: project.id,
      user_id: userId,
      spark: project.spark,
      archived: project.archived,
      created_at: project.createdAt,
    });

    // Ambil boulder IDs yang ada di DB untuk project ini
    const { data: existingBoulders } = await supabase
      .from('boulders')
      .select('id')
      .eq('project_id', project.id);

    const existingBoulderIds = new Set((existingBoulders || []).map((b: any) => b.id));
    const currentBoulderIds = new Set(project.boulders.map(b => b.id));

    // Hapus boulder yang sudah tidak ada
    const bouldersToDelete = [...existingBoulderIds].filter(id => !currentBoulderIds.has(id));
    if (bouldersToDelete.length > 0) {
      await supabase.from('boulders').delete().in('id', bouldersToDelete);
    }

    // Upsert boulders
    for (let bIdx = 0; bIdx < project.boulders.length; bIdx++) {
      const boulder = project.boulders[bIdx];

      await supabase.from('boulders').upsert({
        id: boulder.id,
        project_id: project.id,
        title: boulder.title,
        position: bIdx,
      });

      // Ambil pebble IDs yang ada di DB untuk boulder ini
      const { data: existingPebbles } = await supabase
        .from('pebbles')
        .select('id')
        .eq('boulder_id', boulder.id);

      const existingPebbleIds = new Set((existingPebbles || []).map((p: any) => p.id));
      const currentPebbleIds = new Set(boulder.pebbles.map(p => p.id));

      // Hapus pebble yang sudah tidak ada
      const pepblesToDelete = [...existingPebbleIds].filter(id => !currentPebbleIds.has(id));
      if (pepblesToDelete.length > 0) {
        await supabase.from('pebbles').delete().in('id', pepblesToDelete);
      }

      // Upsert pebbles
      for (let pIdx = 0; pIdx < boulder.pebbles.length; pIdx++) {
        const pebble = boulder.pebbles[pIdx];
        await supabase.from('pebbles').upsert({
          id: pebble.id,
          boulder_id: boulder.id,
          text: pebble.text,
          status: pebble.status,
          content: pebble.content || null,
          notes: pebble.notes || null,
          attachments: pebble.attachments || [],
          position: pIdx,
        });
      }
    }
  }

  // Hapus projects yang sudah tidak ada
  const { data: existingProjects } = await supabase
    .from('projects')
    .select('id')
    .eq('user_id', userId);

  const existingProjectIds = new Set((existingProjects || []).map((p: any) => p.id));
  const currentProjectIds = new Set(projects.map(p => p.id));
  const projectsToDelete = [...existingProjectIds].filter(id => !currentProjectIds.has(id));

  if (projectsToDelete.length > 0) {
    await supabase.from('projects').delete().in('id', projectsToDelete);
  }
}