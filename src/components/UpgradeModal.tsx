import { useState } from 'react';
import { X, Sparkles, Hammer, RefreshCw, Check, Zap } from 'lucide-react';
import { toast } from 'sonner';

interface UpgradeModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

const PRO_FEATURES = [
  { icon: <Hammer size={16} />, text: 'Auto Hammer dengan AI — generate boulder & pebble yang relevan' },
  { icon: <Hammer size={16} />, text: 'Hammer per boulder — generate ulang task kapan saja' },
  { icon: <RefreshCw size={16} />, text: 'Refine & More — perbaiki dan tambah pebble dengan AI' },
  { icon: <Sparkles size={16} />, text: 'Answer — AI menjawab langsung setiap task-mu' },
];

const UpgradeModal = ({ onClose, onSuccess }: UpgradeModalProps) => {
  const [step, setStep] = useState<'features' | 'form' | 'loading'>('features');
  const [form, setForm] = useState({ name: '', email: '', phone: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!form.name.trim()) newErrors.name = 'Nama wajib diisi';
    if (!form.email.trim() || !form.email.includes('@')) newErrors.email = 'Email tidak valid';
    if (!form.phone.trim() || form.phone.length < 10) newErrors.phone = 'Nomor HP tidak valid';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handlePayment = async () => {
    if (!validate()) return;
    setStep('loading');

    try {
      const apiKey = import.meta.env.VITE_MAYAR_API_KEY;
      if (!apiKey) throw new Error('Mayar API key tidak ditemukan');

      const response = await fetch('https://api.mayar.id/hl/v1/payment/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          mobile: form.phone,
          amount: 29000,
          description: 'Glassroom Pro - 30 Hari Akses Penuh',
          redirectUrl: `${window.location.origin}?upgraded=true`,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err?.message || 'Gagal membuat payment');
      }

      const data = await response.json();
      const paymentUrl = data?.data?.link || data?.link || data?.payment_url;

      if (paymentUrl) {
        // Redirect ke halaman bayar Mayar
        window.open(paymentUrl, '_blank');
        toast.success('Halaman pembayaran dibuka! Setelah bayar, refresh halaman ini.');
        onSuccess(); // Aktifkan pro sementara untuk demo
        onClose();
      } else {
        throw new Error('Payment URL tidak ditemukan di response');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Terjadi kesalahan';
      toast.error(`Pembayaran gagal: ${message}`);
      setStep('form');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="relative w-full max-w-md mx-4 bg-card border border-border rounded-2xl shadow-xl overflow-hidden">
        {/* Header */}
        <div className="bg-primary/10 border-b border-border px-6 py-5">
          <button onClick={onClose} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors">
            <X size={18} />
          </button>
          <div className="flex items-center gap-2 mb-1">
            <Zap size={20} className="text-primary" />
            <h2 className="font-display text-xl text-foreground">Upgrade ke Pro</h2>
          </div>
          <p className="text-sm font-body text-muted-foreground">
            Unlock semua fitur AI di Glassroom
          </p>
        </div>

        {step === 'features' && (
          <div className="px-6 py-5 space-y-5">
            {/* Fitur Pro */}
            <div className="space-y-3">
              {PRO_FEATURES.map((f, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="mt-0.5 text-primary shrink-0">{f.icon}</div>
                  <p className="text-sm font-body text-foreground">{f.text}</p>
                </div>
              ))}
            </div>

            {/* Harga */}
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 text-center">
              <p className="text-3xl font-display text-foreground">Rp 29.000</p>
              <p className="text-xs font-body text-muted-foreground mt-1">per bulan · bayar sekali · aktif 30 hari</p>
            </div>

            <button
              onClick={() => setStep('form')}
              className="w-full py-2.5 text-sm font-body bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity"
            >
              Lanjut ke Pembayaran →
            </button>

            <p className="text-center text-xs font-body text-muted-foreground">
              Pembayaran aman via Mayar · QRIS, Transfer, dll
            </p>
          </div>
        )}

        {step === 'form' && (
          <div className="px-6 py-5 space-y-4">
            <p className="text-sm font-body text-muted-foreground">Isi data untuk melanjutkan pembayaran</p>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-body text-muted-foreground mb-1 block">Nama Lengkap</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="John Doe"
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg font-body focus:outline-none focus:ring-1 focus:ring-ring/30"
                />
                {errors.name && <p className="text-xs text-destructive mt-1">{errors.name}</p>}
              </div>
              <div>
                <label className="text-xs font-body text-muted-foreground mb-1 block">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm(p => ({ ...p, email: e.target.value }))}
                  placeholder="john@email.com"
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg font-body focus:outline-none focus:ring-1 focus:ring-ring/30"
                />
                {errors.email && <p className="text-xs text-destructive mt-1">{errors.email}</p>}
              </div>
              <div>
                <label className="text-xs font-body text-muted-foreground mb-1 block">Nomor HP</label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm(p => ({ ...p, phone: e.target.value }))}
                  placeholder="08xxxxxxxxxx"
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg font-body focus:outline-none focus:ring-1 focus:ring-ring/30"
                />
                {errors.phone && <p className="text-xs text-destructive mt-1">{errors.phone}</p>}
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button onClick={() => setStep('features')} className="flex-1 py-2.5 text-sm font-body text-muted-foreground border border-border rounded-lg hover:bg-secondary/50 transition-colors">
                Kembali
              </button>
              <button onClick={handlePayment} className="flex-1 py-2.5 text-sm font-body bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity">
                Bayar Rp 29.000
              </button>
            </div>
          </div>
        )}

        {step === 'loading' && (
          <div className="px-6 py-10 flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-body text-muted-foreground">Membuat payment link…</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default UpgradeModal;