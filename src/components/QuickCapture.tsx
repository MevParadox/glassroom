import { useState } from 'react';
import { motion } from 'framer-motion';

interface QuickCaptureProps {
  onCapture: (text: string) => void;
}

const QuickCapture = ({ onCapture }: QuickCaptureProps) => {
  const [value, setValue] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    onCapture(trimmed);
    setValue('');
  };

  return (
    <motion.form
      onSubmit={handleSubmit}
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full"
    >
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Capture an idea… press Enter to save"
        className="w-full px-5 py-4 text-lg bg-card border border-border rounded-lg font-body placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 transition-shadow"
        autoFocus
      />
    </motion.form>
  );
};

export default QuickCapture;
