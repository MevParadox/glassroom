import { useState, useEffect, useCallback } from 'react';
import { Idea, Project } from '@/lib/types';
import { getIdeas, saveIdeas, getProjects, saveProjects, getCryochamber, saveCryochamber, generateId } from '@/lib/store';
import QuickCapture from '@/components/QuickCapture';
import InboxView from '@/components/InboxView';
import WorkshopView from '@/components/WorkshopView';
import ArchiveView from '@/components/ArchiveView';
import UpgradeModal from '@/components/UpgradeModal';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { Inbox, Wrench, Trophy, Snowflake, Trash2, Search, X, Zap, LogOut } from 'lucide-react';
import ConfirmDialog from '@/components/ConfirmDialog';
import { useProStatus } from '@/hooks/useProStatus';
import { supabase } from '@/lib/supabase';

type Tab = 'inbox' | 'workshop' | 'archive' | 'cryo';

const tabs: { id: Tab; label: string; icon: typeof Inbox }[] = [
  { id: 'inbox', label: 'Inbox', icon: Inbox },
  { id: 'workshop', label: 'Workshop', icon: Wrench },
  { id: 'archive', label: 'Archive', icon: Trophy },
  { id: 'cryo', label: 'Cryo', icon: Snowflake },
];

const Index = () => {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [cryochamber, setCryochamber] = useState<Idea[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>('inbox');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [loading, setLoading] = useState(true);

  const { isPro, isTrialing, trialDaysLeft, activatePro } = useProStatus();

  // ✅ Load data dari Supabase saat mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const [ideasData, projectsData] = await Promise.all([
          getIdeas(),
          getProjects(),
        ]);
        setIdeas(ideasData);
        setProjects(projectsData);
        setCryochamber(getCryochamber()); // cryo masih localStorage
      } catch (err) {
        console.error('Failed to load data:', err);
        toast.error('Gagal load data');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  // ✅ updateIdeas — async ke Supabase
  const updateIdeas = useCallback(async (next: Idea[]) => {
    setIdeas(next);
    try {
      await saveIdeas(next);
    } catch (err) {
      console.error('Failed to save ideas:', err);
    }
  }, []);

  // ✅ updateProjects — async ke Supabase
  const updateProjects = useCallback(async (next: Project[]) => {
    setProjects(next);
    try {
      await saveProjects(next);
    } catch (err) {
      console.error('Failed to save projects:', err);
    }
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast('Logged out');
  };

  const handleCapture = (text: string) => {
    const idea: Idea = { id: generateId(), text, createdAt: new Date().toISOString() };
    updateIdeas([idea, ...ideas]);
    toast.success('Idea captured');
  };

  const handleProcess = (idea: Idea) => {
    const project: Project = {
      id: generateId(),
      spark: idea.text,
      boulders: [],
      archived: false,
      createdAt: new Date().toISOString(),
    };
    updateProjects([project, ...projects]);
    updateIdeas(ideas.filter(i => i.id !== idea.id));
    setActiveTab('workshop');
    toast.success('Moved to Workshop');
  };

  const handleDeleteIdea = (id: string) => {
    updateIdeas(ideas.filter(i => i.id !== id));
    toast('Idea deleted');
  };

  const handleBankruptcy = () => {
    const newCryo = [...ideas, ...cryochamber];
    setCryochamber(newCryo);
    saveCryochamber(newCryo);
    updateIdeas([]);
    toast('Inbox cleared → Cryochamber', { icon: '❄️' });
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
      id: generateId(),
      spark,
      boulders: [],
      archived: false,
      createdAt: new Date().toISOString(),
    };
    updateProjects([project, ...projects]);
  };

  const handleDeleteProject = (id: string) => {
    updateProjects(projects.filter(p => p.id !== id));
    toast('Project deleted');
  };

  const handleFreezeProject = (id: string) => {
    const project = projects.find(p => p.id === id);
    if (!project) return;
    const idea: Idea = { id: generateId(), text: project.spark, createdAt: project.createdAt };
    const newCryo = [idea, ...cryochamber];
    setCryochamber(newCryo);
    saveCryochamber(newCryo);
    updateProjects(projects.filter(p => p.id !== id));
    toast('Project frozen → Cryochamber', { icon: '❄️' });
  };

  // Loading state
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
      <div className="max-w-2xl mx-auto px-4 py-6 sm:py-12">

        {/* Header */}
        <header className="mb-6 flex flex-row items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl sm:text-5xl text-foreground tracking-tight">
              The Glass Room
            </h1>
            <p className="font-body text-muted-foreground mt-1 text-xs sm:text-sm">
              Capture. Organize. Finish.
            </p>
          </div>

          {/* Pro status + buttons */}
          <div className="flex flex-col items-end gap-1.5 shrink-0 mt-1">
            {isTrialing ? (
              <span className="text-[10px] font-body text-primary bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20 whitespace-nowrap">
                Pro Trial · {trialDaysLeft}h
              </span>
            ) : isPro ? (
              <span className="text-[10px] font-body text-primary bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20">
                ✓ Pro
              </span>
            ) : null}

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setShowUpgrade(true)}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-body bg-primary/10 text-primary border border-primary/20 rounded-lg hover:bg-primary/20 transition-colors whitespace-nowrap"
              >
                <Zap size={10} />
                {isPro && !isTrialing ? 'Kelola' : 'Upgrade Pro'}
              </button>
              <button
                onClick={handleLogout}
                title="Logout"
                className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary/80 rounded-lg transition-colors"
              >
                <LogOut size={13} />
              </button>
            </div>
          </div>
        </header>

        {/* Quick Capture */}
        <div className="mb-6">
          <QuickCapture onCapture={handleCapture} />
        </div>

        {/* Search Toggle */}
        <div className="mb-4 flex justify-end">
          {searchOpen ? (
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search…"
                autoFocus
                className="w-full pl-9 pr-9 py-2 text-sm bg-card border border-border rounded-lg font-body placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring/30"
              />
              <button onClick={() => { setSearchOpen(false); setSearchQuery(''); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                <X size={14} />
              </button>
            </div>
          ) : (
            <button onClick={() => setSearchOpen(true)} className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors">
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
              : tab.id === 'archive' ? projects.filter(p => p.archived).length
              : cryochamber.length;

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex items-center gap-1.5 px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-body transition-colors whitespace-nowrap shrink-0 ${
                  isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon size={13} />
                {tab.label}
                {count > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 text-xs bg-muted text-muted-foreground rounded-full">
                    {count}
                  </span>
                )}
                {isActive && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-foreground"
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Content */}
        <main>
          {activeTab === 'inbox' && (
            <InboxView
              ideas={ideas}
              onProcess={handleProcess}
              onDelete={handleDeleteIdea}
              onBankruptcy={handleBankruptcy}
              searchQuery={searchQuery}
            />
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
            />
          )}
          {activeTab === 'archive' && (
            <ArchiveView projects={projects} searchQuery={searchQuery} />
          )}
          {activeTab === 'cryo' && (
            <div className="space-y-2">
              {cryochamber.length === 0 ? (
                <div className="text-center py-20 text-muted-foreground">
                  <Snowflake size={32} className="mx-auto mb-3 opacity-40" />
                  <p className="text-lg font-body">Cryochamber is empty.</p>
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
                        <button
                          onClick={() => {
                            updateIdeas([idea, ...ideas]);
                            const next = cryochamber.filter(i => i.id !== idea.id);
                            setCryochamber(next);
                            saveCryochamber(next);
                            toast('Idea restored to Inbox', { icon: '🔄' });
                          }}
                          className="text-xs text-muted-foreground hover:text-foreground font-body transition-colors"
                        >
                          Restore
                        </button>
                        <ConfirmDialog
                          trigger={
                            <button className="text-muted-foreground hover:text-destructive transition-colors">
                              <Trash2 size={14} />
                            </button>
                          }
                          title="Delete frozen idea?"
                          description={`"${idea.text}" will be permanently removed.`}
                          confirmLabel="Delete"
                          onConfirm={() => {
                            const next = cryochamber.filter(i => i.id !== idea.id);
                            setCryochamber(next);
                            saveCryochamber(next);
                            toast('Idea deleted');
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </main>
      </div>

      {showUpgrade && (
        <UpgradeModal
          onClose={() => setShowUpgrade(false)}
          onSuccess={() => { activatePro(); setShowUpgrade(false); }}
        />
      )}
    </div>
  );
};

export default Index;