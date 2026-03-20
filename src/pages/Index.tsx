import { useState, useEffect, useCallback, useRef } from 'react';
import { Idea, Project, Pebble } from '@/lib/types';
import {
  getIdeas, saveIdeas, getProjects, saveProjects,
  getCryochamber, saveCryochamber, generateId,
  getTrash, moveToTrash, restoreFromTrash, deleteFromTrash, emptyTrash,
  TrashItem
} from '@/lib/store';
import { getUserCredits } from '@/lib/ai';
import QuickCapture from '@/components/QuickCapture';
import InboxView from '@/components/InboxView';
import WorkshopView from '@/components/WorkshopView';
import ArchiveView from '@/components/ArchiveView';
import AnvilView from '@/components/AnvilView';
import TrashView from '@/components/TrashView';
import TopUpModal from '@/components/TopUpModal';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { Inbox, Wrench, Trophy, Snowflake, Trash2, Search, X, Zap, LogOut, Hammer, ChevronDown, Moon, Sun } from 'lucide-react';
import ConfirmDialog from '@/components/ConfirmDialog';
import { supabase } from '@/lib/supabase';
import { useDarkMode } from '@/hooks/useDarkMode';

type Tab = 'inbox' | 'workshop' | 'anvil' | 'archive' | 'cryo' | 'trash';

const tabs: { id: Tab; label: string; icon: typeof Inbox; tooltip: string }[] = [
  { id: 'inbox', label: 'Inbox', icon: Inbox, tooltip: 'Capture all your raw ideas here' },
  { id: 'workshop', label: 'Workshop', icon: Wrench, tooltip: 'Break ideas into boulders & pebbles' },
  { id: 'anvil', label: 'The Anvil', icon: Hammer, tooltip: 'Tasks you\'re focusing on today' },
  { id: 'archive', label: 'Archive', icon: Trophy, tooltip: 'Completed projects' },
  { id: 'cryo', label: 'Cryo', icon: Snowflake, tooltip: 'Ideas frozen for later' },
  { id: 'trash', label: 'Trash', icon: Trash2, tooltip: 'Deleted items — can be restored' },
];

const nextStatus: Record<Pebble['status'], Pebble['status']> = {
  'todo': 'in-progress',
  'in-progress': 'done',
  'done': 'todo',
};

const Index = () => {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [cryochamber, setCryochamber] = useState<Idea[]>([]);
  const [trashItems, setTrashItems] = useState<TrashItem[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>('inbox');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [showTopUp, setShowTopUp] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showDropdown, setShowDropdown] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [credits, setCredits] = useState<number | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { isDark, toggle: toggleDark } = useDarkMode();

  useEffect(() => {
    const loadData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.email) setUserEmail(user.email);

        const [ideasData, projectsData, cryoData, trashData, userCredits] = await Promise.all([
          getIdeas(), getProjects(), getCryochamber(), getTrash(), getUserCredits(),
        ]);
        setIdeas(ideasData);
        setProjects(projectsData);
        setCryochamber(cryoData);
        setTrashItems(trashData);
        setCredits(userCredits);
      } catch (err) {
        console.error('Failed to load data:', err);
        toast.error('Failed to load data');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const refreshCredits = useCallback(async () => {
    const c = await getUserCredits();
    setCredits(c);
  }, []);

  const updateIdeas = useCallback(async (next: Idea[]) => {
    setIdeas(next);
    try { await saveIdeas(next); } catch (err) { console.error(err); }
  }, []);

  const updateProjects = useCallback(async (next: Project[]) => {
    setProjects(next);
    try { await saveProjects(next); } catch (err) { console.error(err); }
  }, []);

  const updateCryo = useCallback(async (next: Idea[]) => {
    setCryochamber(next);
    try { await saveCryochamber(next); } catch (err) { console.error(err); }
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast('Logged out');
  };

  const handleCapture = (text: string) => {
    const idea: Idea = { id: generateId(), text, createdAt: new Date().toISOString() };
    updateIdeas([idea, ...ideas]);
    toast.success('Idea captured!');
  };

  const handleProcess = (idea: Idea) => {
    const project: Project = {
      id: generateId(), spark: idea.text, boulders: [], archived: false, createdAt: new Date().toISOString(),
    };
    updateProjects([project, ...projects]);
    updateIdeas(ideas.filter(i => i.id !== idea.id));
    setActiveTab('workshop');
    toast.success('Moved to Workshop');
  };

  const handleDeleteIdea = async (id: string) => {
    const idea = ideas.find(i => i.id === id);
    if (!idea) return;
    await moveToTrash('idea', idea);
    const newTrash = await getTrash();
    setTrashItems(newTrash);
    updateIdeas(ideas.filter(i => i.id !== id));
    toast('Idea moved to Trash', { action: { label: 'View', onClick: () => setActiveTab('trash') } });
  };

  const handleFreezeIdea = (idea: Idea) => {
    updateCryo([idea, ...cryochamber]);
    updateIdeas(ideas.filter(i => i.id !== idea.id));
    toast('Idea frozen to Cryo ❄️');
  };

  const handleBankruptcy = () => {
    updateCryo([...ideas, ...cryochamber]);
    updateIdeas([]);
    toast('Inbox cleared → Cryochamber ❄️');
  };

  const handleUpdateProject = (updated: Project) => {
    updateProjects(projects.map(p => p.id === updated.id ? updated : p));
  };

  const handleArchiveProject = (id: string) => {
    updateProjects(projects.map(p => p.id === id ? { ...p, archived: true } : p));
    toast.success('Project archived! 🏆');
  };

  const handleCreateProject = (spark: string) => {
    const project: Project = {
      id: generateId(), spark, boulders: [], archived: false, createdAt: new Date().toISOString(),
    };
    updateProjects([project, ...projects]);
  };

  const handleDeleteProject = async (id: string) => {
    const project = projects.find(p => p.id === id);
    if (!project) return;
    await moveToTrash('project', project);
    const newTrash = await getTrash();
    setTrashItems(newTrash);
    updateProjects(projects.filter(p => p.id !== id));
    toast('Project moved to Trash', { action: { label: 'View', onClick: () => setActiveTab('trash') } });
  };

  const handleFreezeProject = (id: string) => {
    const project = projects.find(p => p.id === id);
    if (!project) return;
    const idea: Idea = { id: generateId(), text: project.spark, createdAt: project.createdAt };
    updateCryo([idea, ...cryochamber]);
    updateProjects(projects.filter(p => p.id !== id));
    toast('Project frozen to Cryo ❄️');
  };

  const handleRestoreProject = (id: string) => {
    updateProjects(projects.map(p => p.id === id ? { ...p, archived: false } : p));
    toast.success('Project restored to Workshop!');
  };

  const handleDeleteArchivedProject = async (id: string) => {
    const project = projects.find(p => p.id === id);
    if (!project) return;
    await moveToTrash('project', project);
    const newTrash = await getTrash();
    setTrashItems(newTrash);
    updateProjects(projects.filter(p => p.id !== id));
    toast('Project moved to Trash');
  };

  const handleRestore = async (trashId: string, item: TrashItem) => {
    const restored = await restoreFromTrash(trashId);
    if (!restored) return;
    setTrashItems(prev => prev.filter(t => t.id !== trashId));
    if (restored.type === 'idea') {
      updateIdeas([restored.data as Idea, ...ideas]);
      toast.success('Idea restored to Inbox');
    } else {
      updateProjects([restored.data as Project, ...projects]);
      toast.success('Project restored to Workshop');
    }
  };

  const handleDeleteFromTrash = async (trashId: string) => {
    await deleteFromTrash(trashId);
    setTrashItems(prev => prev.filter(t => t.id !== trashId));
    toast('Permanently deleted');
  };

  const handleEmptyTrash = async () => {
    await emptyTrash();
    setTrashItems([]);
    toast('Trash emptied');
  };

  const handleAnvilUpdatePebble = (projectId: string, boulderId: string, pebbleId: string, updates: Partial<Pebble>) => {
    const next = projects.map(p =>
      p.id === projectId ? {
        ...p, boulders: p.boulders.map(b =>
          b.id === boulderId ? {
            ...b, pebbles: b.pebbles.map(pebble =>
              pebble.id === pebbleId ? { ...pebble, ...updates } : pebble
            )
          } : b
        )
      } : p
    );
    updateProjects(next);
  };

  const handleAnvilTogglePebble = (projectId: string, boulderId: string, pebbleId: string) => {
    const next = projects.map(p =>
      p.id === projectId ? {
        ...p, boulders: p.boulders.map(b =>
          b.id === boulderId ? {
            ...b, pebbles: b.pebbles.map(pebble =>
              pebble.id === pebbleId ? { ...pebble, status: nextStatus[pebble.status] } : pebble
            )
          } : b
        )
      } : p
    );
    updateProjects(next);
  };

  const anvilCount = projects
    .filter(p => !p.archived)
    .reduce((sum, p) => sum + p.boulders.reduce((s, b) => s + b.pebbles.filter(pebble => pebble.focusToday).length, 0), 0);

  const avatarInitial = userEmail ? userEmail[0].toUpperCase() : '?';

   // Tambah fungsi ini (sudah ada refreshCredits)
  const handleCreditsChanged = useCallback(() => {
    refreshCredits();
  }, [refreshCredits]);

  const creditColor = credits === null ? '' :
    credits === 0 ? 'text-destructive bg-destructive/10 border-destructive/30' :
    credits < 10 ? 'text-orange-600 bg-orange-50 border-orange-200 dark:bg-orange-950 dark:border-orange-800' :
    'text-primary bg-primary/10 border-primary/20';

 
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-body text-muted-foreground">Loading your workspace…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-6 sm:py-12">

        {/* Header */}
        <header className="mb-6 flex flex-row items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl sm:text-5xl text-foreground tracking-tight">The Glass Room</h1>
            <p className="font-body text-muted-foreground mt-1 text-xs sm:text-sm">Capture. Organize. Finish.</p>
          </div>

          <div className="flex items-center gap-2 shrink-0 mt-1">
            {/* Credits badge */}
            {credits !== null && (
              <button onClick={() => setShowTopUp(true)} title="Click to top up credits"
                className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-body rounded-lg border transition-colors whitespace-nowrap ${creditColor}`}>
                <Zap size={10} />
                {credits} ◆
              </button>
            )}

            {/* Avatar dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button onClick={() => setShowDropdown(!showDropdown)} className="flex items-center gap-1">
                <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center text-sm font-display font-semibold">
                  {avatarInitial}
                </div>
                <ChevronDown size={12} className={`text-muted-foreground transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
              </button>

              <AnimatePresence>
                {showDropdown && (
                  <motion.div
                    initial={{ opacity: 0, y: -8, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-10 w-52 bg-card border border-border rounded-xl shadow-lg z-50 overflow-hidden"
                  >
                    <div className="px-4 py-3 border-b border-border">
                      <p className="text-xs font-body text-muted-foreground truncate">{userEmail}</p>
                      <p className="text-xs font-body text-primary mt-0.5">{credits ?? 0} Shards remaining</p>
                    </div>
                    <button onClick={() => { setShowTopUp(true); setShowDropdown(false); }}
                      className="w-full flex items-center gap-2 px-4 py-3 text-sm font-body text-foreground hover:bg-secondary/50 transition-colors text-left">
                      <Zap size={14} className="text-primary" />
                      Top Up Shards
                    </button>
                    <button onClick={() => { toggleDark(); setShowDropdown(false); }}
                      className="w-full flex items-center gap-2 px-4 py-3 text-sm font-body text-foreground hover:bg-secondary/50 transition-colors text-left">
                      {isDark ? <Sun size={14} className="text-primary" /> : <Moon size={14} className="text-primary" />}
                      {isDark ? 'Light Mode' : 'Dark Mode'}
                    </button>
                    <button onClick={() => { handleLogout(); setShowDropdown(false); }}
                      className="w-full flex items-center gap-2 px-4 py-3 text-sm font-body text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors text-left border-t border-border">
                      <LogOut size={14} />
                      Logout
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>

        {/* Quick Capture + Search */}
        <div className="mb-6 flex items-center gap-2">
          <div className="flex-1">
            <QuickCapture onCapture={handleCapture} />
          </div>
          {searchOpen ? (
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search…" autoFocus
                className="w-full pl-9 pr-9 py-2 text-sm bg-card border border-border rounded-lg font-body placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring/30" />
              <button onClick={() => { setSearchOpen(false); setSearchQuery(''); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                <X size={14} />
              </button>
            </div>
          ) : (
            <button onClick={() => setSearchOpen(true)} title="Search ideas, projects, or tasks"
              className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors shrink-0">
              <Search size={16} />
            </button>
          )}
        </div>

        {/* Tabs */}
        <nav className="flex gap-1 mb-6 border-b border-border overflow-x-auto scrollbar-none">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            const count = tab.id === 'inbox' ? ideas.length
              : tab.id === 'workshop' ? projects.filter(p => !p.archived).length
              : tab.id === 'anvil' ? anvilCount
              : tab.id === 'archive' ? projects.filter(p => p.archived).length
              : tab.id === 'cryo' ? cryochamber.length
              : trashItems.length;

            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} title={tab.tooltip}
                className={`relative flex items-center gap-1.5 px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-body transition-colors whitespace-nowrap shrink-0 ${
                  isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}>
                <Icon size={13} />
                {tab.label}
                {count > 0 && (
                  <span className={`ml-1 px-1.5 py-0.5 text-xs rounded-full ${
                    tab.id === 'anvil' ? 'bg-primary/20 text-primary' :
                    tab.id === 'trash' ? 'bg-destructive/10 text-destructive' :
                    'bg-muted text-muted-foreground'
                  }`}>{count}</span>
                )}
                {isActive && <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-foreground" />}
              </button>
            );
          })}
        </nav>

        {/* Content */}
        <main>
          {activeTab === 'inbox' && (
            <InboxView ideas={ideas} onProcess={handleProcess} onDelete={handleDeleteIdea}
              onBankruptcy={handleBankruptcy} onFreeze={handleFreezeIdea} searchQuery={searchQuery} />
          )}
          {activeTab === 'workshop' && (
            <WorkshopView
              projects={projects}
              onUpdateProject={handleUpdateProject}
              onArchiveProject={handleArchiveProject}
              onCreateProject={handleCreateProject}
              onDeleteProject={handleDeleteProject}
              onFreezeProject={handleFreezeProject}
              searchQuery={searchQuery}
              onInsufficientCredits={() => setShowTopUp(true)}
              onCreditsChanged={handleCreditsChanged}
            />
          )}
          {activeTab === 'anvil' && (
            <AnvilView projects={projects} onUpdatePebble={handleAnvilUpdatePebble}
              onTogglePebble={handleAnvilTogglePebble} />
          )}
          {activeTab === 'archive' && (
            <ArchiveView projects={projects} searchQuery={searchQuery}
              onRestoreProject={handleRestoreProject} onDeleteProject={handleDeleteArchivedProject} />
          )}
          {activeTab === 'cryo' && (
            <div className="space-y-2">
              {cryochamber.length === 0 ? (
                <div className="text-center py-20 text-muted-foreground">
                  <Snowflake size={32} className="mx-auto mb-3 opacity-40" />
                  <p className="text-lg font-body">Cryochamber is empty.</p>
                  <p className="text-sm font-body mt-1 opacity-70">Freeze ideas you're not ready to work on yet.</p>
                </div>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground font-body mb-4">
                    ❄️ {cryochamber.length} frozen idea{cryochamber.length !== 1 ? 's' : ''}
                  </p>
                  {cryochamber.map(idea => (
                    <div key={idea.id} className="flex items-center justify-between p-4 bg-card border border-border rounded-lg opacity-60 hover:opacity-100 transition-opacity">
                      <p className="font-body text-foreground flex-1 text-sm">{idea.text}</p>
                      <div className="flex items-center gap-2 ml-3 shrink-0">
                        <button onClick={() => { updateIdeas([idea, ...ideas]); updateCryo(cryochamber.filter(i => i.id !== idea.id)); toast('Idea restored to Inbox 🔄'); }}
                          title="Restore to Inbox"
                          className="text-xs text-muted-foreground hover:text-foreground font-body transition-colors">
                          Restore
                        </button>
                        <ConfirmDialog
                          trigger={<button title="Delete permanently" className="text-muted-foreground hover:text-destructive transition-colors"><Trash2 size={14} /></button>}
                          title="Delete this idea?"
                          description={`"${idea.text}" will be permanently deleted.`}
                          confirmLabel="Delete"
                          onConfirm={() => updateCryo(cryochamber.filter(i => i.id !== idea.id))}
                        />
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
          {activeTab === 'trash' && (
            <TrashView items={trashItems} onRestore={handleRestore}
              onDelete={handleDeleteFromTrash} onEmptyTrash={handleEmptyTrash} />
          )}
        </main>
      </div>

      {showTopUp && (
        <TopUpModal
          currentCredits={credits ?? 0}
          onClose={() => { setShowTopUp(false); refreshCredits(); }}
        />
      )}
    </div>
  );
};

export default Index;