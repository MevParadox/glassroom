import { useState } from 'react';
import { X, Zap, ExternalLink } from 'lucide-react';
import { CREDIT_COSTS } from '@/lib/ai';

interface TopUpModalProps {
  currentCredits: number;
  onClose: () => void;
}

const PACKAGES = [
  { credits: 100, price: '$5', label: 'Starter', popular: false, gumroadUrl: import.meta.env.VITE_GUMROAD_100_URL || '#' },
  { credits: 220, price: '$10', label: 'Most Popular', popular: true, gumroadUrl: import.meta.env.VITE_GUMROAD_220_URL || '#' },
  { credits: 600, price: '$20', label: 'Power User', popular: false, gumroadUrl: import.meta.env.VITE_GUMROAD_600_URL || '#' },
];

const TopUpModal = ({ currentCredits, onClose }: TopUpModalProps) => {
  const [selectedPackage, setSelectedPackage] = useState(1); // default Most Popular

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
            <h2 className="font-display text-lg text-foreground">Top Up Credits</h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Current credits */}
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <span className="text-sm font-body text-muted-foreground">Current balance</span>
            <span className="text-sm font-body font-semibold text-foreground">{currentCredits} credits</span>
          </div>

          {/* Credit costs reference */}
          <div className="space-y-1.5">
            <p className="text-xs font-body text-muted-foreground uppercase tracking-wider">Credit costs</p>
            <div className="grid grid-cols-2 gap-1.5 text-xs font-body">
              {Object.entries(CREDIT_COSTS).filter(([, cost]) => cost > 0).map(([action, cost]) => (
                <div key={action} className="flex items-center justify-between px-2 py-1 bg-muted/30 rounded">
                  <span className="text-muted-foreground capitalize">{action.replace(/_/g, ' ').toLowerCase()}</span>
                  <span className="text-foreground font-medium">{cost}cr</span>
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
                    <span className="font-body font-semibold text-foreground text-sm">{pkg.credits} credits</span>
                    {pkg.popular && (
                      <span className="text-[10px] font-body px-1.5 py-0.5 bg-primary text-primary-foreground rounded-full">
                        Popular
                      </span>
                    )}
                  </div>
                  <span className="font-display text-lg text-foreground">{pkg.price}</span>
                </div>
                <p className="text-xs font-body text-muted-foreground mt-1">
                  ~{Math.floor(pkg.credits / CREDIT_COSTS.ANSWER)} answers or {Math.floor(pkg.credits / CREDIT_COSTS.AUTO_HAMMER)} auto hammers
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
            Buy {PACKAGES[selectedPackage].credits} credits for {PACKAGES[selectedPackage].price}
          </button>

          <p className="text-center text-xs font-body text-muted-foreground">
            After purchase, your credits will be added automatically.
          </p>
        </div>
      </div>
    </div>
  );
};

export default TopUpModal;