export interface Attachment {
  id: string;
  name: string;
  type: string;
  size: number;
  dataUrl: string; // base64 data URL for local storage
}

export interface Pebble {
  id: string;
  text: string;
  status: 'todo' | 'in-progress' | 'done';
  content?: string; // Tiptap rich text JSON
  notes?: string;
  attachments?: Attachment[];
  focusToday?: boolean;
}

export interface Boulder {
  id: string;
  title: string;
  pebbles: Pebble[];
}

export interface Project {
  id: string;
  spark: string;
  boulders: Boulder[];
  archived: boolean;
  createdAt: string;
}

export interface Idea {
  id: string;
  text: string;
  createdAt: string;
}
