import React from 'react';
import { Minus, Plus } from 'lucide-react';

export const Card = ({ children, className = "" }: { children: React.ReactNode, className?: string }) => (
  <div className={`bg-white rounded-2xl p-5 shadow-[0_4px_20px_-10px_rgba(0,0,0,0.08)] border border-slate-100 ${className}`}>{children}</div>
);

export const LogCard = ({ title, children }: { title: string, children: React.ReactNode }) => (
  <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 mb-4">
    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">{title}</h3>
    {children}
  </div>
);

export const HighQualityLogo = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 100 100" className={className} fill="none">
    <circle cx="50" cy="50" r="48" fill="#FF0066" />
    <g transform="translate(50, 50) scale(0.6)">
        <circle cx="0" cy="0" r="45" stroke="white" strokeWidth="5" fill="none" />
        <path d="M-15,-10 Q-12,-15 -9,-10" stroke="white" strokeWidth="5" strokeLinecap="round" />
        <path d="M9,-10 Q12,-15 15,-10" stroke="white" strokeWidth="5" strokeLinecap="round" />
        <circle cx="0" cy="5" r="2" fill="white" />
        <path d="M-10,15 Q0,25 10,15" stroke="white" strokeWidth="5" strokeLinecap="round" />
        <path d="M0,-45 Q-10,-55 0,-65" stroke="white" strokeWidth="5" strokeLinecap="round" />
    </g>
  </svg>
);

export const PillBtn = ({ active, label, onClick }: any) => (
  <button onClick={onClick} className={`flex-1 min-w-[50px] h-11 px-1 rounded-xl text-[10px] font-bold transition-all duration-200 border flex items-center justify-center text-center leading-[1.1] ${active ? 'bg-slate-900 text-white shadow-md border-transparent' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'}`}>
    {label}
  </button>
);

export const StepperControl = ({ value, onChange, min, max, step, unit }: any) => (
    <div className="flex items-center gap-4">
      <button onClick={() => onChange(Math.max(value - step, min))} className="w-12 h-12 flex items-center justify-center bg-slate-50 rounded-xl border border-slate-200 text-slate-600 active:scale-95 transition-all"><Minus size={18} /></button>
      <div className="flex-1 text-center">
        <div className="text-3xl font-black text-slate-800 tabular-nums">{value.toFixed(2)} <span className="text-sm font-bold text-slate-400">°{unit}</span></div>
      </div>
      <button onClick={() => onChange(Math.min(value + step, max))} className="w-12 h-12 flex items-center justify-center bg-slate-50 rounded-xl border border-slate-200 text-slate-600 active:scale-95 transition-all"><Plus size={18} /></button>
    </div>
);
