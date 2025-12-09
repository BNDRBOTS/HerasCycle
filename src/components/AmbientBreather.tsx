"use client";
import React, { useEffect, useState } from 'react';
import { Wind, X } from 'lucide-react';

interface Props {
  isActive: boolean;
  onDismiss: () => void;
}

export const AmbientBreather = ({ isActive, onDismiss }: Props) => {
  const [label, setLabel] = useState("Inhale");
  
  useEffect(() => {
    if (!isActive) return;
    const cycle = [
      { text: "Inhale (4s)", time: 0 },
      { text: "Hold (4s)", time: 4000 },
      { text: "Exhale (4s)", time: 8000 },
      { text: "Hold (4s)", time: 12000 }
    ];
    let step = 0;
    setLabel(cycle[0].text);
    const interval = setInterval(() => {
      step = (step + 1) % 4;
      setLabel(cycle[step].text);
    }, 4000);
    return () => clearInterval(interval);
  }, [isActive]);

  if (!isActive) return null;

  return (
    <div className="w-full bg-slate-900 border-b border-rose-900/30 p-4 flex items-center justify-between animate-fadeIn relative overflow-hidden transition-all duration-1000">
      <div className="absolute inset-0 bg-rose-900/20 animate-box-breathe pointer-events-none"></div>
      <div className="flex items-center gap-3 relative z-10">
        <div className="p-2 bg-white/5 rounded-full animate-box-breathe">
           <Wind size={20} className="text-rose-400" />
        </div>
        <div>
          <h3 className="text-rose-100 font-bold text-sm tracking-widest uppercase tabular-nums">{label}</h3>
          <p className="text-[10px] text-slate-400 font-mono">Cortisol Regulation Active</p>
        </div>
      </div>
      <button onClick={onDismiss} className="relative z-10 p-2 text-slate-500 hover:text-white transition-colors"><X size={18} /></button>
    </div>
  );
};
