import { useState, useEffect } from 'react';

const PRO_KEY = 'glassroom_pro_until';
const TRIAL_DAYS = 7;

export function useProStatus() {
  const [isPro, setIsPro] = useState(false);
  const [isTrialing, setIsTrialing] = useState(false);
  const [trialDaysLeft, setTrialDaysLeft] = useState(0);

  useEffect(() => {
    const stored = localStorage.getItem(PRO_KEY);
    const now = Date.now();

    if (stored) {
      const until = parseInt(stored);
      if (now < until) {
        setIsPro(true);

        // Cek apakah ini trial (7 hari) atau paid (30 hari)
        const daysLeft = Math.ceil((until - now) / (1000 * 60 * 60 * 24));
        if (daysLeft <= TRIAL_DAYS) {
          setIsTrialing(true);
          setTrialDaysLeft(daysLeft);
        }
      } else {
        // Expired
        localStorage.removeItem(PRO_KEY);
      }
    } else {
      // User baru → otomatis trial 7 hari
      const trialUntil = now + TRIAL_DAYS * 24 * 60 * 60 * 1000;
      localStorage.setItem(PRO_KEY, trialUntil.toString());
      setIsPro(true);
      setIsTrialing(true);
      setTrialDaysLeft(TRIAL_DAYS);
    }
  }, []);

  // Aktifkan Pro setelah bayar (dipanggil dari UpgradeModal)
  const activatePro = () => {
    const until = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 hari
    localStorage.setItem(PRO_KEY, until.toString());
    setIsPro(true);
    setIsTrialing(false);
    setTrialDaysLeft(0);
  };

  return { isPro, isTrialing, trialDaysLeft, activatePro };
}