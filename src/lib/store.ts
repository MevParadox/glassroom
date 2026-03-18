import { supabase } from './supabase';
import { Idea, Project, Pebble } from './types';

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
  await supabase.from('ideas').delete().eq('user_id', userId);
  if (ideas.length > 0) {
    const { error } = await supabase.from('ideas').insert(
      ideas.map(idea => ({ id: idea.id, user_id: userId, text: idea.text }))
    );
    if (error) console.error('Insert ideas error:', error);
  }
}

// ─── CRYOCHAMBER ──────────────────────────────────────────

export async function getCryochamber(): Promise<Idea[]> {
  const userId = await getUserId();
  const { data, error } = await supabase
    .from('cryochamber')
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

export async function saveCryochamber(ideas: Idea[]): Promise<void> {
  const userId = await getUserId();
  await supabase.from('cryochamber').delete().eq('user_id', userId);
  if (ideas.length > 0) {
    await supabase.from('cryochamber').insert(
      ideas.map(idea => ({ id: idea.id, user_id: userId, text: idea.text }))
    );
  }
}

// ─── TRASH ────────────────────────────────────────────────

export interface TrashItem {
  id: string;
  type: 'idea' | 'project';
  data: Idea | Project;
  deletedAt: string;
}

export async function getTrash(): Promise<TrashItem[]> {
  const userId = await getUserId();
  const { data, error } = await supabase
    .from('trash')
    .select('*')
    .eq('user_id', userId)
    .order('deleted_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(row => ({
    id: row.id,
    type: row.type,
    data: row.data,
    deletedAt: row.deleted_at,
  }));
}

export async function moveToTrash(type: 'idea' | 'project', data: Idea | Project): Promise<void> {
  const userId = await getUserId();
  await supabase.from('trash').insert({
    user_id: userId,
    type,
    data,
  });
}

export async function restoreFromTrash(trashId: string): Promise<TrashItem | null> {
  const userId = await getUserId();
  const { data, error } = await supabase
    .from('trash')
    .select('*')
    .eq('id', trashId)
    .eq('user_id', userId)
    .single();
  if (error || !data) return null;
  await supabase.from('trash').delete().eq('id', trashId);
  return {
    id: data.id,
    type: data.type,
    data: data.data,
    deletedAt: data.deleted_at,
  };
}

export async function deleteFromTrash(trashId: string): Promise<void> {
  await supabase.from('trash').delete().eq('id', trashId);
}

export async function emptyTrash(): Promise<void> {
  const userId = await getUserId();
  await supabase.from('trash').delete().eq('user_id', userId);
}

// ─── PROJECTS ─────────────────────────────────────────────

export async function getProjects(): Promise<Project[]> {
  const userId = await getUserId();
  const { data: projectRows, error } = await supabase
    .from('projects')
    .select(`*, boulders (*, pebbles (*))`)
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
            focusToday: pebble.focus_today || false,
          })),
      })),
  }));
}

export async function saveProjects(projects: Project[]): Promise<void> {
  const userId = await getUserId();

  for (const project of projects) {
    await supabase.from('projects').upsert({
      id: project.id,
      user_id: userId,
      spark: project.spark,
      archived: project.archived,
      created_at: project.createdAt,
    });

    const { data: existingBoulders } = await supabase
      .from('boulders').select('id').eq('project_id', project.id);
    const existingBoulderIds = new Set((existingBoulders || []).map((b: any) => b.id));
    const currentBoulderIds = new Set(project.boulders.map(b => b.id));
    const bouldersToDelete = [...existingBoulderIds].filter(id => !currentBoulderIds.has(id));
    if (bouldersToDelete.length > 0) {
      await supabase.from('boulders').delete().in('id', bouldersToDelete);
    }

    for (let bIdx = 0; bIdx < project.boulders.length; bIdx++) {
      const boulder = project.boulders[bIdx];
      await supabase.from('boulders').upsert({
        id: boulder.id,
        project_id: project.id,
        title: boulder.title,
        position: bIdx,
      });

      const { data: existingPebbles } = await supabase
        .from('pebbles').select('id').eq('boulder_id', boulder.id);
      const existingPebbleIds = new Set((existingPebbles || []).map((p: any) => p.id));
      const currentPebbleIds = new Set(boulder.pebbles.map(p => p.id));
      const pebblesToDelete = [...existingPebbleIds].filter(id => !currentPebbleIds.has(id));
      if (pebblesToDelete.length > 0) {
        await supabase.from('pebbles').delete().in('id', pebblesToDelete);
      }

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
          focus_today: pebble.focusToday || false,
        });
      }
    }
  }

  const { data: existingProjects } = await supabase
    .from('projects').select('id').eq('user_id', userId);
  const existingProjectIds = new Set((existingProjects || []).map((p: any) => p.id));
  const currentProjectIds = new Set(projects.map(p => p.id));
  const projectsToDelete = [...existingProjectIds].filter(id => !currentProjectIds.has(id));
  if (projectsToDelete.length > 0) {
    await supabase.from('projects').delete().in('id', projectsToDelete);
  }
}