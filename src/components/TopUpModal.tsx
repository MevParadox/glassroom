import { useState } from 'react';
import { X, Zap, ExternalLink } from 'lucide-react';
import { CREDIT_COSTS } from '@/lib/ai';

interface TopUpModalProps {
  currentCredits: number;
  onClose: () => void;
}

const PACKAGES = [
  {
    shards: 200,
    price: '$5',
    label: 'Starter',
    popular: false,
    gumroadUrl: import.meta.env.VITE_GUMROAD_200_URL || '#',
    description: 'Perfect for trying things out',
  },
  {
    shards: 700,
    price: '$15',
    label: 'Most Popular',
    popular: true,
    gumroadUrl: import.meta.env.VITE_GUMROAD_700_URL || '#',
    description: 'Best value for active builders',
  },
  {
    shards: 1500,
    price: '$30',
    label: 'Power Builder',
    popular: false,
    gumroadUrl: import.meta.env.VITE_GUMROAD_1500_URL || '#',
    description: 'Full arsenal, no holding back',
  },
];

const ACTION_LABELS: Record<string, string> = {
  AUTO_HAMMER: 'Auto Hammer',
  HAMMER_BOULDER: 'Hammer',
  REFINE: 'Refine',
  MORE_PEBBLES: 'More',
  ANSWER: 'Answer',
  FORGE_NARRATIVE: 'Forge Narrative',
  FORGE_STRUCTURED: 'Forge Structured',
};

const TopUpModal = ({ currentCredits, onClose }: TopUpModalProps) => {
  const [selectedPackage, setSelectedPackage] = useState(1);

  const handleBuy = () => {
    const pkg = PACKAGES[selectedPackage];
    window.open(pkg.gumroadUrl, '_blank');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-md bg-card border border-border rounded-2xl shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Zap size={18} className="text-primary" />
            <h2 className="font-display text-lg text-foreground">Top Up Shards</h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Current balance */}
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <span className="text-sm font-body text-muted-foreground">Current balance</span>
            <span className="text-sm font-body font-semibold text-foreground">{currentCredits} Shards</span>
          </div>

          {/* Shard costs reference */}
          <div className="space-y-1.5">
            <p className="text-xs font-body text-muted-foreground uppercase tracking-wider">Shard costs</p>
            <div className="grid grid-cols-2 gap-1.5 text-xs font-body">
              {Object.entries(CREDIT_COSTS)
                .filter(([, cost]) => cost > 0)
                .map(([action, cost]) => (
                  <div key={action} className="flex items-center justify-between px-2 py-1 bg-muted/30 rounded">
                    <span className="text-muted-foreground">{ACTION_LABELS[action] || action}</span>
                    <span className="text-foreground font-medium">{cost} ◆</span>
                  </div>
                ))}
            </div>
          </div>

          {/* Packages */}
          <div className="space-y-2">
            {PACKAGES.map((pkg, idx) => (
              <button
                key={idx}
                onClick={() => setSelectedPackage(idx)}
                className={`w-full text-left p-4 rounded-xl border transition-all ${
                  selectedPackage === idx
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/40'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-body font-semibold text-foreground text-sm">
                      {pkg.shards.toLocaleString()} Shards
                    </span>
                    {pkg.popular && (
                      <span className="text-[10px] font-body px-1.5 py-0.5 bg-primary text-primary-foreground rounded-full">
                        Popular
                      </span>
                    )}
                  </div>
                  <span className="font-display text-lg text-foreground">{pkg.price}</span>
                </div>
                <p className="text-xs font-body text-muted-foreground mt-1">{pkg.description}</p>
                <p className="text-xs font-body text-muted-foreground mt-0.5">
                  ~{Math.floor(pkg.shards / CREDIT_COSTS.ANSWER)}× Answer · ~{Math.floor(pkg.shards / CREDIT_COSTS.AUTO_HAMMER)}× Auto Hammer
                </p>
              </button>
            ))}
          </div>

          {/* Buy button */}
          <button
            onClick={handleBuy}
            className="w-full flex items-center justify-center gap-2 py-3 text-sm font-body bg-primary text-primary-foreground rounded-xl hover:opacity-90 transition-opacity"
          >
            <ExternalLink size={14} />
            Get {PACKAGES[selectedPackage].shards.toLocaleString()} Shards for {PACKAGES[selectedPackage].price}
          </button>

          <p className="text-center text-xs font-body text-muted-foreground">
            After purchase, enter your license key to activate Shards.
          </p>
        </div>
      </div>
    </div>
  );
};

export default TopUpModal;