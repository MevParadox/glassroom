import { Idea, Project } from './types';

const IDEAS_KEY = 'glassroom-ideas';
const PROJECTS_KEY = 'glassroom-projects';
const CRYO_KEY = 'glassroom-cryo';

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function save<T>(key: string, data: T) {
  localStorage.setItem(key, JSON.stringify(data));
}

export function getIdeas(): Idea[] {
  return load<Idea[]>(IDEAS_KEY, []);
}

export function saveIdeas(ideas: Idea[]) {
  save(IDEAS_KEY, ideas);
}

export function getProjects(): Project[] {
  return load<Project[]>(PROJECTS_KEY, []);
}

export function saveProjects(projects: Project[]) {
  save(PROJECTS_KEY, projects);
}

export function getCryochamber(): Idea[] {
  return load<Idea[]>(CRYO_KEY, []);
}

export function saveCryochamber(ideas: Idea[]) {
  save(CRYO_KEY, ideas);
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
}
