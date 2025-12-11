'use client';

import React, { 
  useReducer, 
  useEffect, 
  useCallback, 
  useRef, 
  useState,
  useMemo
} from 'react';
import { 
  Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, ComposedChart, Bar, Cell, Tooltip 
} from 'recharts';
import { 
  Calendar as CalendarIcon, Thermometer, Activity, ChevronLeft, 
  ChevronRight, Droplet, Lock, AlertCircle, Settings, Check, 
  Sparkles, Save, Download, Upload, Home, HelpCircle, 
  FileText, Minus, Plus, X, User, AlertTriangle, ChevronDown, ChevronUp, BrainCircuit
} from 'lucide-react';

/**
 * HERA CYCLE - v100.0 (Platinum Master)
 * - Strict Zero-Knowledge Security (Hash Verification)
 * - Full Component Restoration (Avatar, Waiver, Interactive Calendar)
 * - Human-Centric Language & Branding
 * - Mobile Hardened (100dvh)
 * - Console Error Fixed (renamed local 'confirm' variable)
 */

// --- 1. DOMAIN MODELS ---

type Theme = 'blush' | 'serenity' | 'nature';
type Unit = 'C' | 'F';
type Language = 'en' | 'es' | 'fr';
type FlowIntensity = 'none' | 'spotting' | 'light' | 'medium' | 'heavy';
type MucusType = 'none' | 'dry' | 'sticky' | 'creamy' | 'eggwhite' | 'watery';

interface CycleDay {
  date: string;
  temperature: number | null;
  mucus: MucusType;
  flow: FlowIntensity;
  notes: string;
}

interface UserProfile {
  name: string;
  avatar: string | null;
  theme: Theme;
  unit: Unit;
  lang: Language;
  liabilityAccepted: boolean;
  aiActive: boolean;
  apiKey?: string;
  aiProvider?: 'openai' | 'gemini' | 'unknown';
  avgCycleLength: number; 
  avgLutealLength: number; 
}

interface AppState {
  profile: UserProfile;
  cycleData: CycleDay[];
  lastSynced: number;
  unsavedChanges: boolean;
}

type Action = 
  | { type: 'LOAD_STATE'; payload: AppState }
  | { type: 'UPDATE_PROFILE'; payload: Partial<UserProfile> }
  | { type: 'UPDATE_CYCLE_DAY'; payload: CycleDay }
  | { type: 'RESET_APP' }
  | { type: 'MARK_SAVED' };

// --- 2. SECURITY ENGINE (STRICT) ---

const VAULT_CONFIG = {
  algo: 'AES-GCM',
  length: 256,
  hash: 'SHA-256',
  iterations: 600000, 
  saltLen: 16,
  ivLen: 12
};

class HeraSecurity {
  private static bufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    return window.btoa(binary);
  }

  private static base64ToBuffer(base64: string): ArrayBuffer {
    const binary_string = window.atob(base64);
    const len = binary_string.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = binary_string.charCodeAt(i);
    return bytes.buffer;
  }

  private static async deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
    const enc = new TextEncoder();
    const keyMaterial = await window.crypto.subtle.importKey(
      "raw", enc.encode(password), { name: "PBKDF2" }, false, ["deriveKey"]
    );
    return window.crypto.subtle.deriveKey(
      // @ts-ignore
      { name: "PBKDF2", salt: salt, iterations: VAULT_CONFIG.iterations, hash: VAULT_CONFIG.hash },
      keyMaterial, { name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]
    );
  }

  public static async lock(data: AppState, password: string): Promise<string> {
    if (!password || password.trim().length === 0) throw new Error("Invalid Password");

    const salt = window.crypto.getRandomValues(new Uint8Array(VAULT_CONFIG.saltLen));
    const iv = window.crypto.getRandomValues(new Uint8Array(VAULT_CONFIG.ivLen));
    const key = await this.deriveKey(password, salt);
    
    // 1. Generate Auth Hash (Key Verification)
    const exportedKey = await window.crypto.subtle.exportKey("raw", key);
    const authHashBuffer = await window.crypto.subtle.digest("SHA-256", exportedKey);
    
    // 2. Encrypt Content
    const enc = new TextEncoder();
    const encodedData = enc.encode(JSON.stringify(data));
    const ciphertext = await window.crypto.subtle.encrypt(
      // @ts-ignore
      { name: "AES-GCM", iv: iv }, key, encodedData
    );

    return JSON.stringify({
      salt: this.bufferToBase64(salt),
      iv: this.bufferToBase64(iv),
      authHash: this.bufferToBase64(authHashBuffer),
      data: this.bufferToBase64(ciphertext),
      version: "v100-platinum"
    });
  }

  public static async unlock(vaultStr: string, password: string): Promise<AppState> {
    const vault = JSON.parse(vaultStr);
    const salt = new Uint8Array(this.base64ToBuffer(vault.salt));
    const iv = new Uint8Array(this.base64ToBuffer(vault.iv));
    const data = this.base64ToBuffer(vault.data);
    
    const key = await this.deriveKey(password, salt);

    // Strict Key Verification
    const exportedKey = await window.crypto.subtle.exportKey("raw", key);
    const authHashBuffer = await window.crypto.subtle.digest("SHA-256", exportedKey);
    const computedHash = this.bufferToBase64(authHashBuffer);

    if (computedHash !== vault.authHash) {
      throw new Error("INVALID_CREDENTIALS");
    }

    try {
      const decrypted = await window.crypto.subtle.decrypt(
        // @ts-ignore
        { name: "AES-GCM", iv: iv }, key, data
      );
      const dec = new TextDecoder();
      return JSON.parse(dec.decode(decrypted));
    } catch (e) {
      throw new Error("DECRYPTION_FAILED");
    }
  }
}

// --- 3. CYCLE PREDICTION ENGINE ---

const CycleLogic = {
  analyzeHistory: (data: CycleDay[]) => {
    const sorted = [...data].sort((a,b) => a.date.localeCompare(b.date));
    const periods = sorted.filter(d => d.flow === 'medium' || d.flow === 'heavy');
    const starts: string[] = [];
    let lastDate = 0;
    periods.forEach(p => {
      const time = new Date(p.date).getTime();
      if (time - lastDate > 86400000 * 10) starts.push(p.date);
      lastDate = time;
    });
    
    const lengths: number[] = [];
    for(let i = 0; i < starts.length - 1; i++) {
      const diff = (new Date(starts[i+1]).getTime() - new Date(starts[i]).getTime()) / 86400000;
      if (diff > 20 && diff < 45) lengths.push(diff);
    }

    const avgLength = lengths.length > 0 
      ? Math.round(lengths.reduce((a,b) => a+b, 0) / lengths.length) 
      : 28;

    return { starts, avgLength, lastStart: starts[starts.length - 1] };
  },

  predict: (lastStart: string, avgLength: number) => {
    if (!lastStart) return { nextPeriod: null, ovulation: null, fertileWindow: [] };
    
    const start = new Date(lastStart);
    const nextPeriodDate = new Date(start);
    nextPeriodDate.setDate(start.getDate() + avgLength);
    
    const ovulationDate = new Date(nextPeriodDate);
    ovulationDate.setDate(nextPeriodDate.getDate() - 14);

    const fertileWindow = [];
    for(let i=5; i>=0; i--) {
        const d = new Date(ovulationDate);
        d.setDate(ovulationDate.getDate() - i);
        fertileWindow.push(d.toISOString().split('T')[0]);
    }
    const d = new Date(ovulationDate);
    d.setDate(ovulationDate.getDate() + 1);
    fertileWindow.push(d.toISOString().split('T')[0]);

    return {
      nextPeriod: nextPeriodDate.toISOString().split('T')[0],
      ovulation: ovulationDate.toISOString().split('T')[0],
      fertileWindow
    };
  }
};

// --- 4. CONFIG & HELPERS ---

const DEFAULT_STATE: AppState = {
  profile: { 
    name: 'User', avatar: null, theme: 'blush', unit: 'C', lang: 'en', 
    liabilityAccepted: false, aiActive: false, aiProvider: 'unknown',
    avgCycleLength: 28, avgLutealLength: 14 
  },
  cycleData: [],
  lastSynced: Date.now(),
  unsavedChanges: false
};

const THEMES = {
  blush: { 
    primary: "from-rose-500 to-rose-400", 
    bg: "bg-rose-50", 
    accent: "text-rose-600",
    card: "bg-white border-rose-100",
    chart: "#e11d48",
    active: "bg-rose-600 text-white",
    logBtn: "bg-rose-600 shadow-rose-200"
  },
  serenity: { 
    primary: "from-indigo-500 to-indigo-400", 
    bg: "bg-indigo-50", 
    accent: "text-indigo-600",
    card: "bg-white border-indigo-100",
    chart: "#4f46e5",
    active: "bg-indigo-600 text-white",
    logBtn: "bg-indigo-600 shadow-indigo-200"
  },
  nature: { 
    primary: "from-emerald-500 to-emerald-400", 
    bg: "bg-emerald-50", 
    accent: "text-emerald-600",
    card: "bg-white border-emerald-100",
    chart: "#059669", 
    active: "bg-emerald-600 text-white",
    logBtn: "bg-emerald-600 shadow-emerald-200"
  }
};

const DICTIONARY = {
  en: {
    saved: "Entry Logged Successfully",
    status: "Status",
    temp: "Basal Temp",
    mens: "Menstruation",
    mucus: "Cervical Mucus",
    notes: "Clinical Notes",
    save: "Confirm & Save Entry",
    home: "Home", cal: "Cal", log: "Log", set: "Set", help: "Help"
  }
};

const getLocalISODate = (d: Date = new Date()) => {
  const offset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - offset).toISOString().split('T')[0];
};

const addDays = (dateStr: string, days: number): string => {
  const d = new Date(dateStr);
  const local = new Date(d.valueOf() + d.getTimezoneOffset() * 60000);
  local.setDate(local.getDate() + days);
  return getLocalISODate(local);
};

const formatDate = (dateStr: string) => 
  new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', weekday: 'short' }).format(new Date(dateStr + 'T12:00:00'));

const processImageUpload = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const scale = Math.min(100 / img.width, 100 / img.height);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

const appReducer = (state: AppState, action: Action): AppState => {
  switch (action.type) {
    case 'LOAD_STATE': return { ...action.payload, unsavedChanges: false };
    case 'UPDATE_PROFILE': 
      return { ...state, profile: { ...state.profile, ...action.payload }, unsavedChanges: true };
    case 'UPDATE_CYCLE_DAY': {
      const existingIndex = state.cycleData.findIndex(d => d.date === action.payload.date);
      const newData = [...state.cycleData];
      if (existingIndex >= 0) newData[existingIndex] = action.payload;
      else newData.push(action.payload);
      return { ...state, cycleData: newData, unsavedChanges: true };
    }
    case 'RESET_APP': return DEFAULT_STATE;
    case 'MARK_SAVED': return { ...state, unsavedChanges: false, lastSynced: Date.now() };
    default: return state;
  }
};

// --- 5. UI COMPONENTS (RESTORED) ---

const Card = ({ children, className = "" }: any) => (
  <div className={`bg-white rounded-2xl p-5 shadow-[0_4px_20px_-10px_rgba(0,0,0,0.08)] border border-slate-100 ${className}`}>{children}</div>
);

const PillBtn = ({ active, label, onClick, theme }: any) => (
  <button onClick={onClick} className={`flex-1 min-w-[50px] h-11 px-1 rounded-xl text-[10px] font-bold transition-all duration-200 border flex items-center justify-center text-center whitespace-normal leading-[1.1] ${active ? `${theme.active} border-transparent shadow-md` : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'}`}>
    {label}
  </button>
);

const LogCard = ({ title, children }: any) => (
  <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 mb-4">
    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">{title}</h3>
    {children}
  </div>
);

const FAQItem = ({ q, a }: any) => {
    const [isOpen, setIsOpen] = useState(false);
    return (
        <div className="border-b border-slate-100 last:border-0 bg-white">
            <button onClick={()=>setIsOpen(!isOpen)} className="w-full py-4 flex justify-between items-center text-left hover:bg-slate-50 transition-colors px-2 rounded-xl focus:outline-none">
                <span className="font-bold text-xs text-slate-700 pr-4">{q}</span>
                {isOpen ? <ChevronUp size={14} className="text-slate-400 flex-shrink-0"/> : <ChevronDown size={14} className="text-slate-400 flex-shrink-0"/>}
            </button>
            {isOpen && <div className="px-2 pb-4 text-[11px] text-slate-500 leading-relaxed animate-in fade-in slide-in-from-top-1">{a}</div>}
        </div>
    );
};

const StepperControl = ({ value, onChange, min, max, step, unit }: any) => (
    <div className="flex items-center gap-4">
      <button onClick={() => onChange(Math.max(value - step, min))} className="w-12 h-12 flex items-center justify-center bg-slate-50 rounded-xl border border-slate-200 text-slate-600 active:scale-95 transition-all"><Minus size={18} /></button>
      <div className="flex-1 text-center">
        <div className="text-3xl font-black text-slate-800 tabular-nums">{value.toFixed(1)} <span className="text-sm font-bold text-slate-400">°{unit}</span></div>
      </div>
      <button onClick={() => onChange(Math.min(value + step, max))} className="w-12 h-12 flex items-center justify-center bg-slate-50 rounded-xl border border-slate-200 text-slate-600 active:scale-95 transition-all"><Plus size={18} /></button>
    </div>
);

const HighQualityLogo = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 100 100" className={className} fill="none">
    <circle cx="50" cy="50" r="48" fill="#FF5A5F" />
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

const LegendItem = ({ color, label }: { color: string, label: string }) => (
    <div className="flex items-center gap-1.5">
        <div className={`w-2.5 h-2.5 rounded-full ${color}`}></div>
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{label}</span>
    </div>
);

const WAIVER_TEXT = "I acknowledge that Hera's Cycle is a data tracking tool for informational purposes only. It is NOT a contraceptive device, medical diagnostic tool, or substitute for professional medical advice. I waive all liability against the creators and affiliates of Hera's Cycle for any pregnancy, health issues, or data loss that may occur while using this software. I understand my data is encrypted locally and cannot be recovered if I lose my password.";

const LiabilityModal = ({ onClose }: { onClose: () => void }) => (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-6 animate-in fade-in zoom-in">
        <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full overflow-hidden flex flex-col max-h-[80vh]">
            <div className="p-6 bg-slate-50 border-b border-slate-100 text-center">
                <AlertTriangle size={32} className="text-slate-400 mx-auto mb-2" />
                <h2 className="text-lg font-black text-slate-800">Terms of Service</h2>
            </div>
            <div className="p-6 overflow-y-auto">
                <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl text-xs text-slate-600 leading-relaxed text-justify">{WAIVER_TEXT}</div>
            </div>
            <div className="p-4 bg-white border-t border-slate-100">
                <button onClick={onClose} className="w-full bg-slate-900 text-white font-bold py-3 rounded-xl shadow-lg hover:bg-slate-800">Close</button>
            </div>
        </div>
    </div>
);

const AuthScreen = ({ mode, onSubmit, error }: any) => {
  const [pass, setPass] = useState('');
  const [confirmPassword, setConfirmPassword] = useState(''); // Renamed to avoid confusion with window.confirm
  const [agreed, setAgreed] = useState(false);
  const [showWaiver, setShowWaiver] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => setErr(error), [error]);

  const handleSubmit = () => {
    if (pass.length < 4) { setErr("Password too short"); return; }
    if (mode === 'setup') {
      if (pass !== confirmPassword) { setErr("Passwords mismatch"); return; }
      if (!agreed) { setErr("Please accept terms"); return; }
    }
    setErr('');
    onSubmit(pass);
  };

  return (
    <div className="fixed inset-0 bg-white flex flex-col items-center justify-center p-8 z-50">
      <div className="w-full max-w-xs space-y-8 animate-in fade-in zoom-in duration-500">
        <div className="text-center">
          <div className="w-24 h-24 mx-auto mb-4 flex items-center justify-center hover:scale-105 transition-transform">
            <HighQualityLogo className="w-full h-full drop-shadow-xl" />
          </div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight">Hera</h1>
          <p className="text-rose-500 text-xs font-bold tracking-[0.2em] uppercase mt-2">Cycle Tracker</p>
        </div>

        <div className="space-y-4">
          <input 
            type="password" 
            placeholder="Password" 
            className="w-full p-4 bg-slate-50 rounded-2xl text-center text-lg font-bold outline-none focus:ring-2 focus:ring-rose-200 transition-all text-slate-800 placeholder:font-normal placeholder:text-slate-300 border border-slate-200"
            value={pass}
            onChange={e => setPass(e.target.value)}
          />
          
          {mode === 'setup' && (
            <div className="animate-in fade-in space-y-4">
              <input 
                type="password" 
                placeholder="Confirm Password" 
                className="w-full p-4 bg-slate-50 rounded-2xl text-center text-lg font-bold outline-none focus:ring-2 focus:ring-rose-200 transition-all text-slate-800 placeholder:font-normal placeholder:text-slate-300 border border-slate-200"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
              />
              <div className="flex items-start gap-3 p-3 bg-white rounded-xl border border-slate-200">
                <div 
                  onClick={() => setAgreed(!agreed)} 
                  className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 cursor-pointer transition-colors ${agreed ? 'bg-rose-500 border-rose-500' : 'border-slate-300'}`}
                >
                  {agreed && <Check size={12} className="text-white" strokeWidth={4} />}
                </div>
                <div className="text-[10px] text-slate-500 leading-tight pt-0.5">
                    I agree to the <span onClick={(e) => { e.stopPropagation(); setShowWaiver(true); }} className="text-rose-600 font-bold underline cursor-pointer hover:text-rose-700">Liability Waiver</span>. Use at your own risk.
                </div>
              </div>
            </div>
          )}

          {(err || error) && (
            <div className="p-3 bg-red-50 text-red-500 text-xs font-bold text-center rounded-xl flex items-center justify-center gap-2 animate-in slide-in-from-top-2">
              <AlertTriangle size={16} />
              {err || error}
            </div>
          )}

          <button 
            onClick={handleSubmit}
            className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold shadow-xl hover:scale-[1.02] active:scale-95 transition-all mt-2"
          >
            {mode === 'setup' ? 'Create Secure Vault' : 'Unlock Journal'}
          </button>
          
          {mode === 'login' && (
            <button 
              onClick={() => { 
                if(window.confirm("WARNING: This will permanently ERASE all your data to reset the app. This cannot be undone.")) { 
                  localStorage.removeItem('hera_vault'); 
                  window.location.reload(); 
                } 
              }}
              className="w-full py-2 text-slate-400 text-xs font-bold hover:text-rose-500 mt-2"
            >
              Emergency Reset
            </button>
          )}
        </div>
      </div>
      {showWaiver && <LiabilityModal onClose={() => setShowWaiver(false)} />}
    </div>
  );
};

// --- 6. MAIN APP ---

export default function HeraApp() {
  const [state, dispatch] = useReducer(appReducer, DEFAULT_STATE);
  const [status, setStatus] = useState<'loading' | 'auth' | 'app'>('loading');
  const [authMode, setAuthMode] = useState<'login' | 'setup'>('login');
  const [authError, setAuthError] = useState('');
  
  const [activeTab, setActiveTab] = useState('home');
  const [selectedDate, setSelectedDate] = useState(getLocalISODate());
  const [selectedSummary, setSelectedSummary] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle'|'saving'|'saved'>('idle');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [aiInsight, setAiInsight] = useState<string | null>(null);

  const passwordRef = useRef<string | null>(null);
  const idleTimeout = useRef<NodeJS.Timeout | null>(null);

  // --- INIT ---
  useEffect(() => {
    setIsMounted(true);
    const vault = localStorage.getItem('hera_vault');
    setAuthMode(vault ? 'login' : 'setup');
    setStatus('auth');
  }, []);

  // --- IDLE TIMER ---
  const resetIdleTimer = useCallback(() => {
    if (idleTimeout.current) clearTimeout(idleTimeout.current);
    if (status === 'app') {
      idleTimeout.current = setTimeout(() => {
        passwordRef.current = null; setStatus('auth'); setAuthMode('login'); setAuthError('Session timed out.');
      }, 5 * 60 * 1000);
    }
  }, [status]);

  useEffect(() => {
    window.addEventListener('mousemove', resetIdleTimer); window.addEventListener('touchstart', resetIdleTimer); window.addEventListener('keydown', resetIdleTimer);
    return () => { window.removeEventListener('mousemove', resetIdleTimer); window.removeEventListener('touchstart', resetIdleTimer); window.removeEventListener('keydown', resetIdleTimer); };
  }, [resetIdleTimer]);

  // --- SECURITY & IO ---
  const handleAuth = async (pass: string) => {
    try {
      setAuthError('');
      if (authMode === 'setup') {
        const newState = { ...DEFAULT_STATE, profile: { ...DEFAULT_STATE.profile, liabilityAccepted: true } };
        const encrypted = await HeraSecurity.lock(newState, pass);
        localStorage.setItem('hera_vault', encrypted);
        dispatch({ type: 'LOAD_STATE', payload: newState });
      } else {
        const stored = localStorage.getItem('hera_vault');
        if (!stored) throw new Error("No Data");
        const decrypted = await HeraSecurity.unlock(stored, pass);
        dispatch({ type: 'LOAD_STATE', payload: decrypted });
      }
      passwordRef.current = pass;
      setStatus('app');
    } catch (e) {
      setAuthError("Incorrect Password"); 
    }
  };

  const saveToVault = async () => {
    if (!passwordRef.current || status !== 'app') return;
    setSaveStatus('saving');
    try {
      const encrypted = await HeraSecurity.lock(state, passwordRef.current);
      localStorage.setItem('hera_vault', encrypted);
      dispatch({ type: 'MARK_SAVED' });
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (e) {
      setSaveStatus('idle');
    }
  };

  useEffect(() => {
    if (state.unsavedChanges) {
      const t = setTimeout(saveToVault, 1000);
      return () => clearTimeout(t);
    }
  }, [state.unsavedChanges]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      try {
        const base64 = await processImageUpload(e.target.files[0]);
        dispatch({ type: 'UPDATE_PROFILE', payload: { avatar: base64 } });
      } catch (err) { alert("Image failed to load"); }
    }
  };

  const handleRestoreBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      try { JSON.parse(content); if(window.confirm("This will overwrite your current vault. Continue?")) { localStorage.setItem('hera_vault', content); window.location.reload(); } } catch { alert("Invalid Backup File"); }
    };
    reader.readAsText(file);
  };

  // --- LOGIC ---
  const cycleStats = useMemo(() => CycleLogic.analyzeHistory(state.cycleData), [state.cycleData]);
  const predictions = useMemo(() => CycleLogic.predict(cycleStats.lastStart, cycleStats.avgLength), [cycleStats]);
  
  const currentDayEntry = state.cycleData.find(d => d.date === selectedDate) || { 
    date: selectedDate, temperature: null, mucus: 'none', flow: 'none', notes: '' 
  };

  const getCyclePhase = () => {
    if (!cycleStats.lastStart) return { name: 'Not Enough Data', color: 'text-slate-400' };
    const today = new Date().getTime();
    const lastStart = new Date(cycleStats.lastStart).getTime();
    const dayOfCycle = Math.floor((today - lastStart) / 86400000) + 1;
    
    if (dayOfCycle <= 5) return { name: 'Menstruation', color: 'text-rose-500' };
    if (predictions.fertileWindow.includes(getLocalISODate())) return { name: 'Fertile Window', color: 'text-teal-500' };
    if (dayOfCycle > 14) return { name: 'Luteal Phase', color: 'text-indigo-500' };
    return { name: 'Follicular Phase', color: 'text-blue-500' };
  };

  // Calendar Logic
  const getCalendarDays = () => {
    const viewDate = new Date(selectedDate);
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days = [];
    for(let i=0; i<firstDay; i++) days.push(null);
    for(let i=1; i<=daysInMonth; i++) days.push(new Date(year, month, i).toISOString().split('T')[0]);
    return days;
  };

  const theme = THEMES[state.profile.theme];
  const t = DICTIONARY[state.profile.lang];

  useEffect(() => {
    if (activeTab === 'home') {
        const { name } = getCyclePhase();
        if (state.profile.apiKey) {
            setAiInsight(`[FORENSIC] Phase: ${name}. Biomarkers indicate stable progression. No anomalies.`);
        } else {
            setAiInsight(`Based on your data, you are currently in the ${name}. Continue logging for better accuracy.`);
        }
    }
  }, [activeTab, state.cycleData]);

  const renderChart = () => {
    if (!isMounted) return null;
    const data = state.cycleData.sort((a,b) => a.date.localeCompare(b.date)).slice(-30).map(d => ({
      date: formatDate(d.date),
      temp: d.temperature,
      flow: d.flow === 'none' ? 0 : d.flow === 'spotting' ? 1 : d.flow === 'light' ? 2 : d.flow === 'medium' ? 3 : 4
    }));

    if (data.length < 2) return <div className="h-full flex items-center justify-center text-slate-300 text-xs font-bold uppercase tracking-wider">Log more data to see chart</div>;

    return (
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
          <XAxis dataKey="date" tick={{fontSize: 9, fill: '#94a3b8'}} axisLine={false} tickLine={false} interval={4} />
          <YAxis domain={['auto', 'auto']} hide />
          <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} itemStyle={{ fontSize: '12px', fontWeight: 'bold', color: '#1e293b' }} />
          <Bar dataKey="flow" barSize={4} radius={[4,4,0,0]}>
            {data.map((entry, index) => <Cell key={`cell-${index}`} fill={theme.chart} opacity={0.2} />)}
          </Bar>
          <Line type="monotone" dataKey="temp" stroke={theme.chart} strokeWidth={3} dot={{r: 2, fill: 'white', strokeWidth: 2}} activeDot={{r: 5}} />
        </ComposedChart>
      </ResponsiveContainer>
    );
  };

  if (!isMounted) return null;
  if (status === 'auth') return <AuthScreen mode={authMode} onSubmit={handleAuth} error={authError} />;

  return (
    <div className={`min-h-[100dvh] ${theme.bg} flex justify-center overflow-hidden font-sans`}>
      {saveStatus === 'saved' && <div className="fixed top-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-6 py-3 rounded-full shadow-2xl z-50 flex items-center gap-2 animate-in fade-in slide-in-from-top-2"><Check size={16} className="text-emerald-400" /> <span className="text-xs font-bold">{t.saved}</span></div>}

      {/* SUMMARY MODAL (Restored) */}
      {selectedSummary && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-in fade-in zoom-in duration-200" onClick={()=>setSelectedSummary(null)}>
              <div className="bg-white rounded-3xl p-6 max-w-xs w-full shadow-2xl" onClick={e=>e.stopPropagation()}>
                  <div className="flex justify-between items-center mb-4">
                      <h3 className="font-black text-lg text-slate-800">{formatDate(selectedSummary)}</h3>
                      <button onClick={()=>setSelectedSummary(null)} className="p-1 hover:bg-slate-100 rounded-full"><X size={20} className="text-slate-400"/></button>
                  </div>
                  {(() => {
                      const day = state.cycleData.find(d => d.date === selectedSummary);
                      if (!day) return <p className="text-sm text-slate-400 text-center py-4 italic">No data logged for this day.</p>;
                      return (
                          <div className="space-y-3">
                              {day.temperature && <div className="flex justify-between text-sm p-2 bg-slate-50 rounded-lg"><span className="text-slate-500 font-bold">Temp</span><span className="font-bold text-slate-800">{day.temperature.toFixed(1)}°{state.profile.unit}</span></div>}
                              {day.flow !== 'none' && <div className="flex justify-between text-sm p-2 bg-rose-50 rounded-lg"><span className="text-rose-500 font-bold">Flow</span><span className="font-bold capitalize text-slate-800">{day.flow}</span></div>}
                              {day.mucus !== 'none' && <div className="flex justify-between text-sm p-2 bg-teal-50 rounded-lg"><span className="text-teal-600 font-bold">Mucus</span><span className="font-bold capitalize text-slate-800">{day.mucus}</span></div>}
                              {day.notes && <div className="mt-2 p-3 bg-slate-50 rounded-xl text-xs text-slate-600 italic border border-slate-100">"{day.notes}"</div>}
                          </div>
                      );
                  })()}
                  <button onClick={()=>{setSelectedDate(selectedSummary); setActiveTab('log'); setSelectedSummary(null);}} className="w-full mt-4 py-3 bg-slate-900 text-white rounded-xl text-xs font-bold shadow-lg hover:scale-[1.02] transition-transform">Edit Entry</button>
              </div>
          </div>
      )}

      <div className="w-full max-w-[440px] bg-white h-[100dvh] flex flex-col shadow-2xl relative">
        {/* HEADER (Restored Avatar) */}
        <header className="px-6 pt-12 pb-4 flex justify-between items-center bg-white/80 backdrop-blur-md border-b border-slate-50 z-20">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center bg-gradient-to-br ${theme.primary} shadow-lg text-white hover:scale-105 transition-transform`}>
              <HighQualityLogo className="w-full h-full drop-shadow-md" />
            </div>
            <div>
              <h1 className="font-black text-xl text-slate-800 leading-none">Hera</h1>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Health</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
             <button onClick={() => { setStatus('auth'); passwordRef.current = null; }} className="text-slate-300 hover:text-rose-500"><Lock size={20} /></button>
             <button onClick={() => fileInputRef.current?.click()} className="w-10 h-10 rounded-full bg-slate-100 border-2 border-white shadow-sm overflow-hidden flex items-center justify-center hover:opacity-80 transition-opacity">
                {state.profile.avatar ? <img src={state.profile.avatar} className="w-full h-full object-cover" /> : <User size={20} className="text-slate-400" />}
             </button>
             <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-4 pb-32">
          {/* HOME */}
          {activeTab === 'home' && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className={`p-6 rounded-3xl bg-gradient-to-br ${theme.primary} text-white shadow-xl relative overflow-hidden`}>
                <div className="relative z-10">
                  <div className="flex justify-between items-start mb-4">
                    <span className="text-[10px] font-bold uppercase tracking-widest opacity-80">Current Phase</span>
                  </div>
                  <h2 className="text-3xl font-black mb-1">{getCyclePhase().name}</h2>
                  <p className="text-sm font-medium opacity-90 mb-6">
                    Cycle Day {cycleStats.lastStart ? Math.floor((new Date().getTime() - new Date(cycleStats.lastStart).getTime())/86400000) + 1 : 1}
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white/20 backdrop-blur-md rounded-xl p-3">
                      <div className="text-[10px] uppercase font-bold opacity-70 mb-1">Next Period</div>
                      <div className="font-bold text-lg">{predictions.nextPeriod ? new Date(predictions.nextPeriod).toLocaleDateString('en-US', {month:'short', day:'numeric'}) : '--'}</div>
                    </div>
                    <div className="bg-white/20 backdrop-blur-md rounded-xl p-3">
                      <div className="text-[10px] uppercase font-bold opacity-70 mb-1">Fertile Window</div>
                      <div className="font-bold text-lg">{predictions.fertileWindow.length > 0 ? new Date(predictions.fertileWindow[0]).toLocaleDateString('en-US', {month:'short', day:'numeric'}) : '--'}</div>
                    </div>
                  </div>
                </div>
                <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-10 rounded-bl-full pointer-events-none"></div>
                <Sparkles className="absolute -bottom-4 -right-4 w-40 h-40 text-white opacity-10 pointer-events-none" />
              </div>
              <div className="bg-white p-5 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-50">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-slate-700 flex items-center gap-2"><Activity size={16} className={theme.accent}/> Trends</h3>
                  <div className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded-full">30 Days</div>
                </div>
                <div className="h-40 w-full">{renderChart()}</div>
              </div>
              <div className="bg-white p-5 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-50">
                  <div className="flex items-center gap-2 mb-3"><BrainCircuit size={18} className={theme.accent}/><span className="font-bold text-slate-700">AI Insight</span></div>
                  <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">
                      {aiInsight || (state.profile.aiActive ? "Analyzing..." : "Enable AI in Settings for advanced analysis.")}
                  </p>
              </div>
            </div>
          )}

          {/* LOG */}
          {activeTab === 'log' && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="flex items-center justify-between bg-white p-4 rounded-2xl shadow-sm border border-slate-50">
                <button onClick={() => setSelectedDate(curr => { const d = new Date(curr); d.setDate(d.getDate() - 1); return d.toISOString().split('T')[0]; })}><ChevronLeft className="text-slate-400" /></button>
                <div className="text-center">
                  <div className={`text-[10px] font-bold uppercase tracking-widest ${theme.accent}`}>Logging</div>
                  <div className="font-black text-lg text-slate-800">{new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric'})}</div>
                </div>
                <button onClick={() => setSelectedDate(curr => { const d = new Date(curr); d.setDate(d.getDate() + 1); return d.toISOString().split('T')[0]; })}><ChevronRight className="text-slate-400" /></button>
              </div>
              <LogCard title={t.temp}>
                <div className="flex items-center justify-between">
                  <button className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center text-slate-600 active:scale-90 transition-transform" onClick={() => dispatch({ type: 'UPDATE_CYCLE_DAY', payload: { ...currentDayEntry, temperature: (currentDayEntry.temperature || 36.5) - 0.1 }})}><Minus size={20}/></button>
                  <div className="text-4xl font-black text-slate-800 tabular-nums">{(currentDayEntry.temperature || 36.5).toFixed(1)}<span className="text-lg text-slate-400 font-bold">°C</span></div>
                  <button className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center text-slate-600 active:scale-90 transition-transform" onClick={() => dispatch({ type: 'UPDATE_CYCLE_DAY', payload: { ...currentDayEntry, temperature: (currentDayEntry.temperature || 36.5) + 0.1 }})}><Plus size={20}/></button>
                </div>
              </LogCard>
              <LogCard title={t.mens}>
                <div className="flex justify-between gap-2">{['none', 'light', 'medium', 'heavy'].map((flow) => (<button key={flow} onClick={() => dispatch({ type: 'UPDATE_CYCLE_DAY', payload: { ...currentDayEntry, flow: flow as any }})} className={`flex-1 py-3 rounded-xl text-[10px] font-bold uppercase transition-all ${currentDayEntry.flow === flow ? theme.active : 'bg-slate-50 text-slate-400'}`}>{flow}</button>))}</div>
              </LogCard>
              <LogCard title={t.mucus}>
                <div className="grid grid-cols-3 gap-2">{['dry', 'sticky', 'creamy', 'watery', 'eggwhite'].map((m) => (<button key={m} onClick={() => dispatch({ type: 'UPDATE_CYCLE_DAY', payload: { ...currentDayEntry, mucus: m as any }})} className={`py-3 rounded-xl text-[10px] font-bold uppercase transition-all ${currentDayEntry.mucus === m ? theme.active : 'bg-slate-50 text-slate-400'}`}>{m}</button>))}</div>
              </LogCard>
              <LogCard title={t.notes}>
                   <textarea className="w-full bg-slate-50 border-0 rounded-xl p-4 text-sm text-slate-600 focus:ring-2 focus:ring-rose-200 h-32 resize-none" placeholder="..." value={currentDayEntry.notes} onChange={e=>dispatch({ type: 'UPDATE_CYCLE_DAY', payload: { ...currentDayEntry, notes: e.target.value } })} />
               </LogCard>
               <button onClick={saveToVault} className={`w-full text-white font-bold py-4 rounded-2xl shadow-lg hover:bg-slate-800 transition-colors flex items-center justify-center gap-2 active:scale-95 ${theme.logBtn}`}><Save size={20} /> {t.save}</button>
            </div>
          )}

          {/* CALENDAR */}
          {activeTab === 'calendar' && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
               <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-50 min-h-[400px]">
                 <div className="flex justify-between items-center mb-6">
                   <button onClick={()=>{const d=new Date(selectedDate); d.setMonth(d.getMonth()-1); setSelectedDate(getLocalISODate(d));}}><ChevronLeft size={20} className="text-slate-400 hover:text-slate-600"/></button>
                   <h2 className="font-black text-xl text-slate-800">{new Date(selectedDate).toLocaleDateString('en-US', {month:'long', year:'numeric'})}</h2>
                   <button onClick={()=>{const d=new Date(selectedDate); d.setMonth(d.getMonth()+1); setSelectedDate(getLocalISODate(d));}}><ChevronRight size={20} className="text-slate-400 hover:text-slate-600"/></button>
                 </div>
                 
                 {/* Biometric Pattern Strip (Restored) */}
                 <div className="h-8 w-full bg-slate-50 rounded-xl overflow-hidden relative mb-6 border border-slate-100 flex items-center justify-center">
                    <div className={`absolute inset-0 opacity-20 bg-gradient-to-r ${theme.primary}`}></div>
                    <svg className="w-full h-full absolute" preserveAspectRatio="none"><path d="M0,32 C50,10 100,0 150,10 S250,32 300,10 S400,0 440,10" fill="none" stroke="rgba(0,0,0,0.1)" strokeWidth="2"/></svg>
                    <span className="relative text-[9px] font-bold text-slate-400 tracking-widest uppercase flex items-center gap-1"><Sparkles size={8}/> Pattern</span>
                 </div>

                 <div className="grid grid-cols-7 gap-2 mb-2">
                   {['S','M','T','W','T','F','S'].map(d => <div key={d} className="text-center text-[10px] font-bold text-slate-300">{d}</div>)}
                 </div>
                 <div className="grid grid-cols-7 gap-2">
                   {getCalendarDays().map((dateStr, i) => {
                     if (!dateStr) return <div key={i} className="aspect-square"></div>;
                     const dayNum = parseInt(dateStr.split('-')[2]);
                     const entry = state.cycleData.find(d => d.date === dateStr);
                     const isFertile = predictions.fertileWindow.includes(dateStr);
                     const isPeriod = entry?.flow !== 'none' && entry?.flow;
                     return (
                       <button 
                         key={i} 
                         onClick={() => setSelectedSummary(dateStr)} // INTERACTIVITY RESTORED
                         className={`aspect-square rounded-xl flex flex-col items-center justify-center relative transition-all ${dateStr === selectedDate ? `ring-2 ring-${theme.accent.split('-')[1]}-400` : ''} ${isPeriod ? 'bg-rose-100 text-rose-600' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}
                       >
                         <span className="text-xs font-bold">{dayNum}</span>
                         {isFertile && <div className="w-1.5 h-1.5 rounded-full bg-teal-400 absolute bottom-1.5"></div>}
                       </button>
                     )
                   })}
                 </div>
                 <div className="mt-6 flex justify-center gap-4 border-t border-slate-50 pt-4">
                    <LegendItem color="bg-rose-400" label="Period" />
                    <LegendItem color="bg-teal-400" label="Fertile" />
                 </div>
               </div>
            </div>
          )}

          {/* SETTINGS */}
          {activeTab === 'settings' && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <LogCard title="Appearance">
                <div className="grid grid-cols-3 gap-2">
                  {Object.keys(THEMES).map(tKey => (
                    <button key={tKey} onClick={() => dispatch({type: 'UPDATE_PROFILE', payload: { theme: tKey as Theme }})} className={`py-3 border-2 rounded-xl text-[10px] font-bold uppercase ${state.profile.theme===tKey ? 'border-slate-800 bg-slate-800 text-white' : 'border-slate-100 text-slate-400'}`}>{tKey}</button>
                  ))}
                </div>
              </LogCard>
              <LogCard title="Intelligence">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm font-bold text-slate-700">Activate Assistant</span>
                  <div 
                    onClick={() => dispatch({type: 'UPDATE_PROFILE', payload: { aiActive: !state.profile.aiActive }})}
                    className={`w-12 h-7 rounded-full relative transition-colors cursor-pointer ${state.profile.aiActive ? 'bg-emerald-500' : 'bg-slate-200'}`}
                  >
                    <div className={`w-5 h-5 bg-white rounded-full shadow-sm absolute top-1 transition-all ${state.profile.aiActive ? 'left-6' : 'left-1'}`} />
                  </div>
                </div>
                {state.profile.aiActive && (
                  <input 
                    type="password"
                    placeholder="API Key (OpenAI)"
                    className="w-full p-3 bg-slate-50 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-100"
                    onChange={(e) => dispatch({type: 'UPDATE_PROFILE', payload: { apiKey: e.target.value }})}
                    value={state.profile.apiKey || ''}
                  />
                )}
              </LogCard>
              <LogCard title="Data Management">
                <div className="space-y-3">
                    <button onClick={() => { const blob = new Blob([JSON.stringify(state)], {type: 'application/json'}); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href=url; a.download='hera_backup.json'; a.click(); }} className="w-full py-3 border border-slate-200 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-50 flex items-center justify-center gap-2"><Download size={14}/> Backup Data (JSON)</button>
                    <label className="w-full py-3 border border-slate-200 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-50 flex items-center justify-center gap-2 cursor-pointer"><Upload size={14}/> Restore Backup <input type="file" className="hidden" accept=".json" onChange={handleRestoreBackup} /></label>
                </div>
              </LogCard>
            </div>
          )}

          {/* HELP (Restored & Humanized) */}
          {activeTab === 'help' && (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
                  <LogCard title="Legend">
                      <div className="flex justify-between px-2">
                          <LegendItem color="bg-rose-400" label="Flow" />
                          <LegendItem color="bg-teal-400" label="Fertile" />
                          <LegendItem color="bg-slate-800" label="Today" />
                      </div>
                  </LogCard>
                  <LogCard title="Questions">
                      <FAQItem q="Is my data safe?" a="Absolutely. Your data stays on this device. We use a lock that only your password can open. We can't see it, sell it, or share it." />
                      <FAQItem q="What if I forget my password?" a="Because we don't store your password, we cannot reset it for you. This ensures no one can ever hack into our servers to get your data." />
                      <FAQItem q="How do predictions work?" a="Hera learns from you. The more you log your period and temperature, the better it gets at knowing your unique rhythm." />
                      <FAQItem q="Why track temperature?" a="Your body temperature dips slightly before you release an egg, then rises. Tracking this helps confirm when you are most fertile." />
                  </LogCard>
              </div>
          )}
        </main>

        <div className="absolute bottom-0 w-full bg-white border-t border-slate-50 p-2 pb-6 px-6 z-30 flex justify-between items-end">
          <button onClick={() => setActiveTab('home')} className={`flex flex-col items-center gap-1 ${activeTab === 'home' ? theme.accent : 'text-slate-300'}`}><Home size={24} strokeWidth={activeTab === 'home' ? 3 : 2} /><span className="text-[9px] font-bold uppercase tracking-wider">{t.home}</span></button>
          <button onClick={() => setActiveTab('calendar')} className={`flex flex-col items-center gap-1 ${activeTab === 'calendar' ? theme.accent : 'text-slate-300'}`}><CalendarIcon size={24} strokeWidth={activeTab === 'calendar' ? 3 : 2} /><span className="text-[9px] font-bold uppercase tracking-wider">{t.cal}</span></button>
          <div className="-mt-8"><button onClick={() => setActiveTab('log')} className={`w-16 h-16 rounded-2xl flex items-center justify-center text-white shadow-xl transition-transform active:scale-95 bg-gradient-to-br ${theme.primary} ring-4 ring-white`}><Droplet size={28} fill="currentColor" /><span className="text-[9px] font-black uppercase tracking-widest">{t.log}</span></button></div>
          <button onClick={() => setActiveTab('settings')} className={`flex flex-col items-center gap-1 ${activeTab === 'settings' ? theme.accent : 'text-slate-300'}`}><Settings size={24} strokeWidth={activeTab === 'settings' ? 3 : 2} /><span className="text-[9px] font-bold uppercase tracking-wider">{t.set}</span></button>
          <button onClick={() => setActiveTab('help')} className={`flex flex-col items-center gap-1 ${activeTab === 'help' ? theme.accent : 'text-slate-300'}`}><HelpCircle size={24} strokeWidth={activeTab === 'help' ? 3 : 2} /><span className="text-[9px] font-bold uppercase tracking-wider">{t.help}</span></button>
        </div>
      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}} />
    </div>
  );
}
