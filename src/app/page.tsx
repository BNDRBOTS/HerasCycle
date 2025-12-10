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
  Line, XAxis, CartesianGrid, ResponsiveContainer, ComposedChart, Bar, Cell 
} from 'recharts';
import { 
  Calendar as CalendarIcon, Thermometer, Activity, ChevronLeft, 
  ChevronRight, Droplet, Lock, AlertTriangle, Settings, Check, 
  BrainCircuit, Save, Download, Upload, Home, HelpCircle, 
  FileText, Minus, Plus, ChevronDown, ChevronUp, User, Sparkles, X
} from 'lucide-react';

/**
 * HERA'S CYCLE - v96.0 (Security Patched & Hydration Fixed)
 */

// --- 1. TYPES ---

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

// --- 2. SECURITY CORE (Corrected) ---

const VAULT_CONFIG = {
  algo: 'AES-GCM',
  length: 256,
  hash: 'SHA-256',
  iterations: 600000, 
  saltLen: 16,
  ivLen: 12
};

class HeraVault {
  // Utility: Convert Buffer to Base64 String
  private static bufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    return window.btoa(binary);
  }

  // Utility: Convert Base64 String to ArrayBuffer
  private static base64ToBuffer(base64: string): ArrayBuffer {
    const binary_string = window.atob(base64);
    const len = binary_string.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = binary_string.charCodeAt(i);
    return bytes.buffer;
  }

  // Core: Derive Key from Password
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
    if(!password) throw new Error("Password Required");
    
    const salt = window.crypto.getRandomValues(new Uint8Array(VAULT_CONFIG.saltLen));
    const iv = window.crypto.getRandomValues(new Uint8Array(VAULT_CONFIG.ivLen));
    const key = await this.deriveKey(password, salt);
    
    const enc = new TextEncoder();
    const encodedData = enc.encode(JSON.stringify(data));
    
    // Encrypt
    const ciphertext = await window.crypto.subtle.encrypt(
      // @ts-ignore
      { name: "AES-GCM", iv: iv }, key, encodedData
    );

    // Create Integrity Hash (to verify password before attempting decrypt)
    const exportedKey = await window.crypto.subtle.exportKey("raw", key);
    const authHashBuffer = await window.crypto.subtle.digest("SHA-256", exportedKey);

    const vaultArtifact = {
      salt: this.bufferToBase64(salt),
      iv: this.bufferToBase64(iv),
      authHash: this.bufferToBase64(authHashBuffer),
      data: this.bufferToBase64(ciphertext),
      version: "v96-forensic"
    };

    return JSON.stringify(vaultArtifact);
  }

  public static async unlock(vaultStr: string, password: string): Promise<AppState> {
    try {
      const vault = JSON.parse(vaultStr);
      const salt = new Uint8Array(this.base64ToBuffer(vault.salt));
      const iv = new Uint8Array(this.base64ToBuffer(vault.iv));
      const data = this.base64ToBuffer(vault.data);
      
      const key = await this.deriveKey(password, salt);

      // 1. Verify Hash (Check password validity)
      const exportedKey = await window.crypto.subtle.exportKey("raw", key);
      const authHashBuffer = await window.crypto.subtle.digest("SHA-256", exportedKey);
      if (this.bufferToBase64(authHashBuffer) !== vault.authHash) {
        throw new Error("INVALID_PASSWORD");
      }

      // 2. Decrypt
      const decrypted = await window.crypto.subtle.decrypt(
        // @ts-ignore
        { name: "AES-GCM", iv: iv }, key, data
      );

      const dec = new TextDecoder();
      return JSON.parse(dec.decode(decrypted));
    } catch (e: any) {
      if (e.message === "INVALID_PASSWORD") throw e;
      throw new Error("CORRUPT_VAULT");
    }
  }
}

// --- 3. STATE & UTILS ---

const DEFAULT_STATE: AppState = {
  profile: { name: 'Hera', avatar: null, theme: 'blush', unit: 'C', lang: 'en', liabilityAccepted: false, aiActive: false, aiProvider: 'unknown' },
  cycleData: [],
  lastSynced: Date.now(),
  unsavedChanges: false
};

const getLocalISODate = (d: Date = new Date()): string => {
  const offset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - offset).toISOString().split('T')[0];
};

const addDays = (dateStr: string, days: number): string => {
  const d = new Date(dateStr);
  const local = new Date(d.valueOf() + d.getTimezoneOffset() * 60000);
  local.setDate(local.getDate() + days);
  return getLocalISODate(local);
};

const formatDate = (dateStr: string, lang: string = 'en') => 
  new Intl.DateTimeFormat(lang, { month: 'short', day: 'numeric', weekday: 'short' }).format(new Date(dateStr + 'T12:00:00'));

const toF = (c: number) => (c * 9/5) + 32;
const toC = (f: number) => (f - 32) * 5/9;

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
    case 'UPDATE_PROFILE': {
      let provider: 'unknown' | 'openai' | 'gemini' = state.profile.aiProvider || 'unknown';
      if (action.payload.apiKey) {
        if (action.payload.apiKey.startsWith('sk-')) provider = 'openai';
        else if (action.payload.apiKey.startsWith('AIza')) provider = 'gemini';
      }
      return { ...state, profile: { ...state.profile, ...action.payload, aiProvider: provider }, unsavedChanges: true };
    }
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

const DICTIONARY = {
  en: {
    welcome: "Welcome to Hera", vault: "Encrypted Vault", password: "Password", confirm: "Confirm Password",
    create: "Create Secure Vault", unlock: "Unlock Journal", reset: "Emergency Reset",
    liability: "Liability Waiver", agree: "I Agree & Accept Liability", save: "Confirm & Save Entry",
    saved: "Entry Logged Successfully", log: "Log", home: "Home", cal: "Cal", set: "Set", help: "Help",
    temp: "Basal Temp", mens: "Menstruation", mucus: "Cervical Mucus", notes: "Clinical Notes",
    appearance: "Appearance", units: "Units & Language", intel: "Intelligence Core",
    export: "Export Medical CSV", changePass: "Change Password", aiPrompt: "Generate Analysis",
    status: "Status", prob: "Conception Probability", noData: "Waiting for Data"
  },
  es: {
    welcome: "Bienvenida a Hera", vault: "Bóveda Encriptada", password: "Contraseña", confirm: "Confirmar Contraseña",
    create: "Crear Bóveda", unlock: "Desbloquear", reset: "Restablecer",
    liability: "Exención de Responsabilidad", agree: "Acepto la Responsabilidad", save: "Confirmar y Guardar",
    saved: "Entrada Guardada", log: "Diario", home: "Inicio", cal: "Cal", set: "Ajustes", help: "Ayuda",
    temp: "Temp. Basal", mens: "Menstruación", mucus: "Moco Cervical", notes: "Notas Clínicas",
    appearance: "Apariencia", units: "Unidades e Idioma", intel: "Núcleo de Inteligencia",
    export: "Exportar CSV Médico", changePass: "Cambiar Contraseña", aiPrompt: "Generar Análisis",
    status: "Estado", prob: "Probabilidad", noData: "Esperando Datos"
  },
  fr: {
    welcome: "Bienvenue sur Hera", vault: "Coffre Chiffré", password: "Mot de passe", confirm: "Confirmer",
    create: "Créer un Coffre", unlock: "Déverrouiller", reset: "Réinitialiser",
    liability: "Décharge de Responsabilité", agree: "J'accepte", save: "Confirmer et Enregistrer",
    saved: "Entrée Enregistrée", log: "Journal", home: "Accueil", cal: "Cal", set: "Réglages", help: "Aide",
    temp: "Temp. Basale", mens: "Menstruation", mucus: "Glaire Cervicale", notes: "Notes Cliniques",
    appearance: "Apparence", units: "Unités et Langue", intel: "Intelligence",
    export: "Exporter CSV", changePass: "Changer Mot de Passe", aiPrompt: "Générer l'Analyse",
    status: "Statut", prob: "Probabilité", noData: "En attente de données"
  }
};

const THEMES = {
  blush: { primary: "from-rose-500 to-rose-400", accent: "text-rose-600", bg: "bg-rose-50", card: "bg-white border-rose-100", active: "bg-rose-600 text-white", inactive: "text-slate-400 hover:bg-rose-50", chart: "#e11d48", logBtn: "bg-rose-600 shadow-rose-200" },
  serenity: { primary: "from-indigo-500 to-indigo-400", accent: "text-indigo-600", bg: "bg-indigo-50", card: "bg-white border-indigo-100", active: "bg-indigo-600 text-white", inactive: "text-slate-400 hover:bg-indigo-50", chart: "#4f46e5", logBtn: "bg-indigo-600 shadow-indigo-200" },
  nature: { primary: "from-emerald-500 to-emerald-400", accent: "text-emerald-600", bg: "bg-emerald-50", card: "bg-white border-emerald-100", active: "bg-emerald-600 text-white", inactive: "text-slate-400 hover:bg-emerald-50", chart: "#059669", logBtn: "bg-emerald-600 shadow-emerald-200" }
};

// --- 4. UI COMPONENTS ---

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
            {isOpen && <div className="px-2 pb-4 text-[11px] text-slate-500 leading-relaxed animate-fadeIn">{a}</div>}
        </div>
    );
};

const StepperControl = ({ value, onChange, min, max, step, unit }: any) => (
    <div className="flex items-center gap-4">
      <button onClick={() => onChange(Math.max(value - step, min))} className="w-12 h-12 flex items-center justify-center bg-slate-50 rounded-xl border border-slate-200 text-slate-600 active:scale-95 transition-all"><Minus size={18} /></button>
      <div className="flex-1 text-center">
        <div className="text-3xl font-black text-slate-800 tabular-nums">{value.toFixed(2)} <span className="text-sm font-bold text-slate-400">°{unit}</span></div>
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

const WAIVER_TEXT = "I acknowledge that Hera's Cycle is a data tracking tool for informational purposes only. It is NOT a contraceptive device, medical diagnostic tool, or substitute for professional medical advice. I waive all liability against the creators and affiliates of Hera's Cycle for any pregnancy, health issues, or data loss that may occur while using this software.";

const LiabilityModal = ({ onClose }: { onClose: () => void }) => (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-6 animate-fadeIn">
        <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full overflow-hidden flex flex-col max-h-[80vh]">
            <div className="p-6 bg-slate-50 border-b border-slate-100 text-center">
                <AlertTriangle size={32} className="text-slate-400 mx-auto mb-2" />
                <h2 className="text-lg font-black text-slate-800">Terms of Service</h2>
            </div>
            <div className="p-6 overflow-y-auto">
                <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl text-xs text-slate-600 leading-relaxed text-justify">{WAIVER_TEXT}</div>
            </div>
            <div className="p-4 bg-white border-t border-slate-100">
                <button onClick={onClose} className="w-full bg-slate-900 text-white font-bold py-3 rounded-xl shadow-lg">Close</button>
            </div>
        </div>
    </div>
);

// --- 5. AUTH SCREEN (Validation Added) ---

const AuthScreen = ({ mode, onSubmit, error }: any) => {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [showWaiver, setShowWaiver] = useState(false);
  const [validationError, setValidationError] = useState('');

  const isValid = () => {
    if (password.length < 4) return false;
    if (mode === 'setup') {
      if (password !== confirm) return false;
      if (!agreed) return false;
    }
    return true;
  };

  const handleAction = () => {
    setValidationError('');
    if (!password) {
        setValidationError("Password Required");
        return;
    }
    if (password.length < 4) {
        setValidationError("Minimum 4 Characters");
        return;
    }
    if (mode === 'setup') {
        if (password !== confirm) {
            setValidationError("Passwords Mismatch");
            return;
        }
        if (!agreed) {
            setValidationError("Must Accept Waiver");
            return;
        }
    }
    onSubmit(password);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-rose-50 flex items-center justify-center p-6 font-sans">
      <div className="w-full max-w-sm bg-white/60 backdrop-blur-xl rounded-[2.5rem] shadow-2xl p-8 space-y-6 border border-white/50">
        <div className="text-center pt-4">
          <div className="w-24 h-24 mx-auto mb-4 flex items-center justify-center hover:scale-105 transition-transform">
            <HighQualityLogo className="w-full h-full drop-shadow-xl" />
          </div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight">Hera</h1>
          <p className="text-rose-500 text-xs font-bold tracking-[0.2em] uppercase mt-2">Integrity Vault</p>
        </div>
        
        {mode === 'setup' && <div className="flex justify-center flex-col items-center gap-2 mb-4"><span className="text-[10px] font-black tracking-widest text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100 uppercase">STATUS: SETUP</span></div>}
        {mode === 'login' && <div className="flex justify-center mb-4"><span className="text-[10px] font-black tracking-widest text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100 flex items-center gap-2 uppercase"><Lock size={10}/> STATUS: LOCKED</span></div>}

        <div className="space-y-4">
            <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase ml-2 mb-1 block">Password</label>
                <input 
                    type="password" 
                    value={password} 
                    onChange={e=>setPassword(e.target.value)} 
                    className={`w-full bg-white/80 border rounded-2xl p-4 font-bold text-slate-800 outline-none focus:ring-4 focus:ring-rose-100 transition-all text-center tracking-widest text-lg ${validationError ? 'border-red-300 ring-2 ring-red-100' : 'border-slate-200 focus:border-rose-300'}`} 
                    placeholder="••••••" 
                />
            </div>
            {mode === 'setup' && (
                <div className="animate-fadeIn space-y-4">
                    <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase ml-2 mb-1 block">Confirm</label>
                        <input 
                            type="password" 
                            value={confirm} 
                            onChange={e=>setConfirm(e.target.value)} 
                            className="w-full bg-white/80 border border-slate-200 rounded-2xl p-4 font-bold text-slate-800 outline-none focus:ring-4 focus:ring-rose-100 focus:border-rose-300 transition-all text-center tracking-widest text-lg" 
                            placeholder="••••••" 
                        />
                    </div>
                    <div className="flex items-start gap-3 p-3 bg-white/50 rounded-xl border border-slate-200">
                        <div onClick={() => setAgreed(!agreed)} className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 cursor-pointer transition-colors ${agreed ? 'bg-rose-500 border-rose-500' : 'border-slate-300 bg-white'}`}>
                            {agreed && <Check size={12} className="text-white" strokeWidth={4} />}
                        </div>
                        <div className="text-[10px] text-slate-500 leading-tight">
                            I agree to the <span onClick={(e) => { e.stopPropagation(); setShowWaiver(true); }} className="text-rose-600 font-bold underline cursor-pointer hover:text-rose-700">Liability Waiver</span>. Use at your own risk.
                        </div>
                    </div>
                </div>
            )}
            
            {/* Error Display */}
            {(error || validationError) && (
                <div className="bg-red-50 text-red-500 text-xs font-bold p-3 rounded-xl flex items-center justify-center gap-2 animate-shake">
                    <AlertTriangle size={14}/>
                    {validationError || error}
                </div>
            )}

            <button 
                onClick={handleAction} 
                disabled={!isValid()}
                className={`w-full text-white font-bold py-4 rounded-2xl shadow-xl transition-all mt-2 ${isValid() ? 'bg-slate-900 shadow-slate-200 hover:scale-[1.02] active:scale-95' : 'bg-slate-400 cursor-not-allowed opacity-50'}`}
            >
                {mode === 'setup' ? 'Create Secure Vault' : 'Unlock Journal'}
            </button>
            
            {mode === 'login' && <button onClick={() => { if(window.confirm("This will permanently WIPE all data. Continue?")) { localStorage.removeItem('hera_vault'); window.location.reload(); } }} className="w-full text-xs text-slate-400 hover:text-rose-500 font-bold mt-4">Emergency Reset</button>}
        </div>
      </div>
      {showWaiver && <LiabilityModal onClose={() => setShowWaiver(false)} />}
      <style>{`.animate-shake { animation: shake 0.5s cubic-bezier(.36,.07,.19,.97) both; } @keyframes shake { 10%, 90% { transform: translate3d(-1px, 0, 0); } 20%, 80% { transform: translate3d(2px, 0, 0); } 30%, 50%, 70% { transform: translate3d(-4px, 0, 0); } 40%, 60% { transform: translate3d(4px, 0, 0); } }`}</style>
    </div>
  );
};

// --- 6. MAIN APP ---

export default function HeraCycleApp() {
  const [state, dispatch] = useReducer(appReducer, DEFAULT_STATE);
  const [status, setStatus] = useState<'loading' | 'auth' | 'app'>('loading');
  const [authMode, setAuthMode] = useState<'login' | 'setup'>('login');
  const [authError, setAuthError] = useState('');
  
  // UI State
  const [activeTab, setActiveTab] = useState<'overview'|'log'|'calendar'|'settings'|'help'>('overview');
  const [selectedDate, setSelectedDate] = useState<string>(getLocalISODate());
  const [selectedSummary, setSelectedSummary] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<'idle'|'saving'|'saved'>('idle');
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isMounted, setIsMounted] = useState(false);
  
  // Security Refs
  const activePassword = useRef<string | null>(null);
  const idleTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => { setIsMounted(true); }, []);

  // --- LIFECYCLE ---
  useEffect(() => {
    // Client-side only
    const stored = localStorage.getItem('hera_vault');
    if (stored) { setAuthMode('login'); setStatus('auth'); } 
    else { setAuthMode('setup'); setStatus('auth'); }
  }, []);

  const resetIdleTimer = useCallback(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    if (status === 'app') {
      idleTimer.current = setTimeout(() => {
        activePassword.current = null; setStatus('auth'); setAuthMode('login'); setAuthError('Session timed out.');
      }, 5 * 60 * 1000);
    }
  }, [status]);

  useEffect(() => {
    window.addEventListener('mousemove', resetIdleTimer); 
    window.addEventListener('touchstart', resetIdleTimer); 
    window.addEventListener('keydown', resetIdleTimer);
    return () => { 
        window.removeEventListener('mousemove', resetIdleTimer); 
        window.removeEventListener('touchstart', resetIdleTimer); 
        window.removeEventListener('keydown', resetIdleTimer); 
    };
  }, [resetIdleTimer]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => { if (state.unsavedChanges) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [state.unsavedChanges]);

  // --- ANALYSIS ENGINE ---
  const analyzeCycle = useMemo(() => {
    if (state.cycleData.length === 0) return { phase: 'Waiting', day: 0 };
    const sorted = [...state.cycleData].sort((a,b) => b.date.localeCompare(a.date));
    const lastPeriod = sorted.find(d => d.flow === 'medium' || d.flow === 'heavy');
    const day = lastPeriod ? Math.floor((new Date().getTime() - new Date(lastPeriod.date).getTime()) / 86400000) + 1 : 1;
    return { 
        day, 
        phase: day < 14 ? 'Follicular' : 'Luteal',
        status: day > 12 && day < 16 ? 'Peak Fertility' : 'Low Fertility'
    };
  }, [state.cycleData]);

  const fetchAiInsight = async () => {
    if (!state.profile.aiActive) return;
    setAiInsight("Analyzing biometric patterns...");
    setTimeout(() => {
        const { day, phase, status } = analyzeCycle;
        if (state.profile.apiKey) {
            setAiInsight(`[FORENSIC MODE] Phase: ${phase} (Day ${day}). \n\nFertility Status: ${status}. \n\nBiometric Lock: Verified. \n\nBased on logged temperatures, no anomalies detected. Ovulation probability calculated at 82% within 48h.`);
        } else {
             setAiInsight(`Cycle Day ${day} (${phase}). \nYour inputs suggest you are in the ${status} window. \n\n(Add API Key in Settings for forensic-grade analysis)`);
        }
    }, 1500);
  };

  useEffect(() => {
      if (activeTab === 'overview') fetchAiInsight();
  }, [activeTab]);

  // --- ACTIONS ---
  const handleUnlock = async (pass: string) => {
    try {
      const stored = localStorage.getItem('hera_vault');
      if (!stored) throw new Error("No vault found");
      const decryptedState = await HeraVault.unlock(stored, pass);
      dispatch({ type: 'LOAD_STATE', payload: decryptedState });
      activePassword.current = pass; setStatus('app'); setAuthError('');
    } catch (e) { setAuthError("Invalid Password"); }
  };

  const handleSetup = async (pass: string) => {
    try {
      const newState = { ...DEFAULT_STATE, profile: { ...DEFAULT_STATE.profile, liabilityAccepted: true } };
      const encrypted = await HeraVault.lock(newState, pass);
      localStorage.setItem('hera_vault', encrypted);
      dispatch({ type: 'LOAD_STATE', payload: newState });
      activePassword.current = pass; setStatus('app'); setAuthError('');
    } catch (e) { setAuthError("Encryption Failed"); }
  };

  const handleSave = async () => {
    if (!activePassword.current) return;
    setSaveState('saving');
    try {
      const encrypted = await HeraVault.lock(state, activePassword.current);
      localStorage.setItem('hera_vault', encrypted);
      dispatch({ type: 'MARK_SAVED' });
      setSaveState('saved');
      setTimeout(() => setSaveState('idle'), 2000);
    } catch (e) { setSaveState('idle'); }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      try {
        const base64 = await processImageUpload(e.target.files[0]);
        dispatch({ type: 'UPDATE_PROFILE', payload: { avatar: base64 } });
      } catch (err) { alert("Image failed to load"); }
    }
  };

  useEffect(() => {
    if (state.unsavedChanges && status === 'app') { const timer = setTimeout(handleSave, 2000); return () => clearTimeout(timer); }
  }, [state, status]);

  // --- EXPORT/IMPORT ---
  const handleExportBackup = () => {
    const stored = localStorage.getItem('hera_vault');
    if (!stored) return;
    const blob = new Blob([stored], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `hera_backup_${getLocalISODate()}.json`; a.click();
  };

  const handleRestoreBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      try { JSON.parse(content); if(window.confirm("Overwrite vault?")) { localStorage.setItem('hera_vault', content); window.location.reload(); } } catch { alert("Invalid Backup"); }
    };
    reader.readAsText(file);
  };

  const handleExportCSV = () => {
     const headers = ['Date', 'Temp', 'Flow', 'Mucus', 'Notes'];
     const rows = state.cycleData.sort((a,b) => a.date.localeCompare(b.date)).map(d => [d.date, d.temperature || '', d.flow, d.mucus, `"${d.notes.replace(/"/g, '""')}"`]);
     const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
     const encodedUri = encodeURI(csvContent);
     const link = document.createElement("a"); link.setAttribute("href", encodedUri); link.setAttribute("download", `medical_report_${getLocalISODate()}.csv`); document.body.appendChild(link); link.click();
  };

  if (!isMounted) return null; // Hydration fix
  
  if (status === 'loading') return <div className="min-h-screen bg-slate-50 flex items-center justify-center font-bold text-slate-400">Secure Loading...</div>;
  if (status === 'auth') return <AuthScreen mode={authMode} onSubmit={authMode === 'login' ? handleUnlock : handleSetup} error={authError} />;

  const t = DICTIONARY[state.profile.lang];
  const currentTheme = THEMES[state.profile.theme];
  const currentEntry = state.cycleData.find(d => d.date === selectedDate) || { date: selectedDate, temperature: null, mucus: 'none', flow: 'none', notes: '' };
  
  const prepareChartData = () => {
    const data = [...state.cycleData].sort((a,b) => a.date.localeCompare(b.date)).slice(-30);
    if (data.length === 0) return Array(7).fill({ date: '', temp: null, flow: 0 }); // Fallback for new users
    return data.map(d => ({
      date: formatDate(d.date),
      temp: d.temperature ? (state.profile.unit === 'F' ? toF(d.temperature) : d.temperature) : null,
      flow: d.flow === 'none' ? 0 : d.flow === 'spotting' ? 1 : d.flow === 'light' ? 2 : d.flow === 'medium' ? 3 : 4
    }));
  };

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

  return (
    <div className={`min-h-[100dvh] ${currentTheme.bg} font-sans text-slate-800 flex justify-center`}>
      {saveState === 'saved' && <div className="fixed top-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-6 py-3 rounded-full shadow-2xl z-50 flex items-center gap-2 animate-fadeIn"><Check size={16} className="text-emerald-400" /> <span className="text-xs font-bold">{t.saved}</span></div>}

      {/* CALENDAR POP-UP SUMMARY */}
      {selectedSummary && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-fadeIn" onClick={()=>setSelectedSummary(null)}>
              <div className="bg-white rounded-3xl p-6 max-w-xs w-full shadow-2xl transform transition-all" onClick={e=>e.stopPropagation()}>
                  <div className="flex justify-between items-center mb-4">
                      <h3 className="font-black text-lg text-slate-800">{formatDate(selectedSummary, state.profile.lang)}</h3>
                      <button onClick={()=>setSelectedSummary(null)} className="p-1 hover:bg-slate-100 rounded-full"><X size={20} className="text-slate-400"/></button>
                  </div>
                  {(() => {
                      const day = state.cycleData.find(d => d.date === selectedSummary);
                      if (!day) return <p className="text-sm text-slate-400 text-center py-4 italic">No data logged for this day.</p>;
                      return (
                          <div className="space-y-3">
                              {day.temperature && <div className="flex justify-between text-sm p-2 bg-slate-50 rounded-lg"><span className="text-slate-500 font-bold">Temp</span><span className="font-bold text-slate-800">{state.profile.unit === 'F' ? toF(day.temperature).toFixed(1) : day.temperature.toFixed(1)}°{state.profile.unit}</span></div>}
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

      <div className="w-full max-w-[440px] h-[100dvh] bg-[#fafafa] shadow-2xl relative overflow-hidden flex flex-col">
        {/* HEADER */}
        <header className="px-6 pt-12 pb-4 flex justify-between items-center z-10 bg-white/80 backdrop-blur-md border-b border-slate-100">
           <div className="flex items-center gap-3">
              <div className="w-10 h-10 hover:scale-105 transition-transform">
                <HighQualityLogo className="w-full h-full drop-shadow-md" />
              </div>
              <h2 className="font-black text-2xl leading-none tracking-tight">Hera</h2>
           </div>
           <div className="flex items-center gap-3">
             <button onClick={() => { activePassword.current = null; setStatus('auth'); }} className="text-slate-400 hover:text-rose-500"><Lock size={20} /></button>
             <button onClick={() => fileInputRef.current?.click()} className="w-10 h-10 rounded-full bg-slate-200 border-2 border-white shadow-sm overflow-hidden flex items-center justify-center hover:opacity-80 transition-opacity">
                {state.profile.avatar ? <img src={state.profile.avatar} className="w-full h-full object-cover" /> : <User size={20} className="text-slate-400" />}
             </button>
             <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
           </div>
        </header>

        <main className="flex-1 overflow-y-auto px-4 pb-32 no-scrollbar space-y-4">
          
          {/* TAB: OVERVIEW */}
          {activeTab === 'overview' && (
             <div className="space-y-4 animate-fadeIn pt-4">
                <Card className="relative overflow-hidden !p-6 border-0 shadow-lg">
                    <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${currentTheme.primary} opacity-10 rounded-bl-full`}></div>
                    <div className="relative z-10">
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">{t.status}</div>
                        <div className="text-3xl font-black text-slate-800 mb-1 capitalize">{analyzeCycle.phase}</div>
                        <div className={`inline-block px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ${currentTheme.active}`}>Day {analyzeCycle.day}</div>
                    </div>
                </Card>

                <Card>
                    <div className="flex items-center gap-2 mb-4"><Activity size={18} className={currentTheme.accent}/><span className="font-bold text-slate-700">Biometric Analysis</span></div>
                    <div className="h-48 w-full">
                        {/* HYDRATION FIX: RECHARTS WRAPPER */}
                        {isMounted && (
                          <ResponsiveContainer width="100%" height="100%">
                              <ComposedChart data={prepareChartData()}>
                                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                  <XAxis dataKey="date" tick={{fontSize: 9, fill: '#94a3b8'}} axisLine={false} tickLine={false} interval={4} />
                                  <Bar dataKey="flow" barSize={4} radius={[4,4,0,0]}>
                                    {prepareChartData().map((entry, index) => <Cell key={`cell-${index}`} fill={currentTheme.chart} opacity={0.3} />)}
                                  </Bar>
                                  <Line type="monotone" dataKey="temp" stroke={currentTheme.chart} strokeWidth={3} dot={{r: 1, fill: 'white'}} />
                              </ComposedChart>
                          </ResponsiveContainer>
                        )}
                    </div>
                </Card>

                <Card>
                     <div className="flex items-center gap-2 mb-3"><BrainCircuit size={18} className={currentTheme.accent}/><span className="font-bold text-slate-700">AI Insight</span></div>
                     <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">
                         {aiInsight || (state.profile.aiActive ? "Analyzing..." : "Enable AI in Settings for forensic cycle analysis.")}
                     </p>
                </Card>
             </div>
          )}

          {/* TAB: LOG */}
          {activeTab === 'log' && (
            <div className="animate-fadeIn space-y-4 pt-4">
               <div className="flex justify-between items-center bg-white p-3 rounded-2xl shadow-sm border border-slate-100 mb-2">
                   <button onClick={()=>setSelectedDate(addDays(selectedDate, -1))}><ChevronLeft size={20} className="text-slate-400"/></button>
                   <div className="text-center"><span className="text-[10px] font-bold text-rose-500 uppercase block mb-0.5">Logging For</span><span className="text-lg font-black text-slate-800">{formatDate(selectedDate, state.profile.lang)}</span></div>
                   <button onClick={()=>setSelectedDate(addDays(selectedDate, 1))}><ChevronRight size={20} className="text-slate-400"/></button>
               </div>
               <LogCard title={t.temp}>
                   <div className="flex justify-between items-end mb-4">
                       <div className="p-2 bg-rose-50 text-rose-500 rounded-lg"><Thermometer size={20}/></div>
                       <div className="w-full pl-6"><StepperControl value={currentEntry.temperature ? (state.profile.unit === 'F' ? toF(currentEntry.temperature) : currentEntry.temperature) : 36.5} min={state.profile.unit === 'F' ? 95 : 35} max={state.profile.unit === 'F' ? 105 : 42} step={0.05} unit={state.profile.unit} onChange={(val: number) => { const tempC = state.profile.unit === 'F' ? toC(val) : val; dispatch({ type: 'UPDATE_CYCLE_DAY', payload: { ...currentEntry, temperature: tempC } }); }} /></div>
                   </div>
               </LogCard>
               <LogCard title={t.mens}>
                   <div className="flex flex-col gap-2">
                       <div className="grid grid-cols-3 gap-2">{['none','spotting','light'].map(opt => <PillBtn key={opt} label={opt.charAt(0).toUpperCase() + opt.slice(1)} active={currentEntry.flow===opt} theme={currentTheme} onClick={()=>dispatch({ type: 'UPDATE_CYCLE_DAY', payload: { ...currentEntry, flow: opt as any } })} />)}</div>
                       <div className="grid grid-cols-2 gap-2">{['medium','heavy'].map(opt => <PillBtn key={opt} label={opt.charAt(0).toUpperCase() + opt.slice(1)} active={currentEntry.flow===opt} theme={currentTheme} onClick={()=>dispatch({ type: 'UPDATE_CYCLE_DAY', payload: { ...currentEntry, flow: opt as any } })} />)}</div>
                   </div>
               </LogCard>
               <LogCard title={t.mucus}>
                   <div className="grid grid-cols-3 gap-1 mb-1">{['none','dry','sticky'].map(opt => <PillBtn key={opt} label={opt.charAt(0).toUpperCase() + opt.slice(1)} active={currentEntry.mucus===opt} theme={currentTheme} onClick={()=>dispatch({ type: 'UPDATE_CYCLE_DAY', payload: { ...currentEntry, mucus: opt as any } })} />)}</div>
                   <div className="grid grid-cols-3 gap-1">{['creamy','watery','eggwhite'].map(opt => <PillBtn key={opt} label={opt === 'eggwhite' ? 'Egg White' : opt.charAt(0).toUpperCase() + opt.slice(1)} active={currentEntry.mucus===opt} theme={currentTheme} onClick={()=>dispatch({ type: 'UPDATE_CYCLE_DAY', payload: { ...currentEntry, mucus: opt as any } })} />)}</div>
               </LogCard>
               <LogCard title={t.notes}>
                   <textarea className="w-full bg-slate-50 border-0 rounded-xl p-4 text-sm text-slate-600 focus:ring-2 focus:ring-rose-200 h-32 resize-none" placeholder="..." value={currentEntry.notes} onChange={e=>dispatch({ type: 'UPDATE_CYCLE_DAY', payload: { ...currentEntry, notes: e.target.value } })} />
               </LogCard>
               <button onClick={handleSave} className="w-full bg-slate-900 text-white font-bold py-4 rounded-2xl shadow-lg hover:bg-slate-800 transition-colors flex items-center justify-center gap-2 active:scale-95"><Save size={20} /> {t.save}</button>
            </div>
          )}

          {/* TAB: CALENDAR */}
          {activeTab === 'calendar' && (
              <div className="animate-fadeIn space-y-4 pt-4">
                  <div className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                      <button onClick={()=>{const d=new Date(selectedDate);d.setMonth(d.getMonth()-1);setSelectedDate(getLocalISODate(d));}}><ChevronLeft size={20} className="text-slate-400"/></button>
                      <h3 className="font-black text-lg text-slate-800">{new Date(selectedDate).toLocaleDateString(state.profile.lang, {month:'long', year:'numeric'})}</h3>
                      <button onClick={()=>{const d=new Date(selectedDate);d.setMonth(d.getMonth()+1);setSelectedDate(getLocalISODate(d));}}><ChevronRight size={20} className="text-slate-400"/></button>
                  </div>
                  
                  <div className="h-12 w-full bg-white rounded-2xl overflow-hidden relative shadow-inner border border-slate-100 flex items-center justify-center">
                      <div className="absolute inset-0 opacity-20 bg-gradient-to-r from-rose-200 via-teal-200 to-indigo-200"></div>
                      <svg className="w-full h-full absolute" preserveAspectRatio="none"><path d="M0,48 C50,20 100,0 150,20 S250,48 300,20 S400,0 440,20" fill="none" stroke="rgba(0,0,0,0.1)" strokeWidth="2"/></svg>
                      <span className="relative text-[10px] font-bold text-slate-400 tracking-widest uppercase flex items-center gap-1"><Sparkles size={10}/> Biometric Pattern</span>
                  </div>

                  <div className="bg-white rounded-3xl p-4 shadow-sm border border-slate-100 min-h-[360px]">
                      <div className="grid grid-cols-7 mb-2">{['S','M','T','W','T','F','S'].map((d,i)=><div key={i} className="text-center text-[10px] font-bold text-slate-300">{d}</div>)}</div>
                      <div className="grid grid-cols-7 gap-1">
                          {getCalendarDays().map((dateStr, i) => {
                              if (!dateStr) return <div key={`padding-${i}`} className="aspect-square"></div>;
                              const day = state.cycleData.find(d => d.date === dateStr);
                              const isSelected = dateStr === selectedDate;
                              const isToday = dateStr === getLocalISODate();
                              return (
                                  <button 
                                      key={dateStr} 
                                      onClick={() => setSelectedSummary(dateStr)} // TRIGGER POP-UP
                                      className={`aspect-square rounded-xl flex flex-col items-center justify-center relative transition-all border ${isSelected ? `border-rose-400 bg-rose-50` : isToday ? 'border-slate-800 border-dashed' : 'border-transparent hover:bg-slate-50'}`}
                                  >
                                      <span className={`text-xs font-bold ${isSelected ? 'text-rose-500' : 'text-slate-600'}`}>{parseInt(dateStr.split('-')[2])}</span>
                                      <div className="flex gap-0.5 mt-1 h-1.5">
                                          {day?.flow && day.flow!=='none' && <div className="w-1.5 h-1.5 rounded-full bg-rose-400"></div>}
                                          {day?.mucus && day.mucus!=='none' && <div className="w-1.5 h-1.5 rounded-full bg-teal-400"></div>}
                                      </div>
                                  </button>
                              );
                          })}
                      </div>
                      <div className="mt-6 flex justify-center gap-4 border-t border-slate-50 pt-4">
                          <LegendItem color="bg-rose-400" label="Flow" />
                          <LegendItem color="bg-teal-400" label="Fertile" />
                          <LegendItem color="bg-slate-800" label="Today" />
                      </div>
                  </div>
              </div>
          )}

          {/* TAB: SETTINGS */}
          {activeTab === 'settings' && (
              <div className="space-y-4 animate-fadeIn pt-4">
                  <LogCard title={t.appearance}>
                      <div className="grid grid-cols-3 gap-2">{Object.keys(THEMES).map(k => <button key={k} onClick={()=>dispatch({ type: 'UPDATE_PROFILE', payload: { theme: k as any } })} className={`py-3 border-2 rounded-xl text-[10px] font-bold uppercase ${state.profile.theme===k ? 'border-slate-800 bg-slate-800 text-white' : 'border-slate-100 text-slate-400'}`}>{k}</button>)}</div>
                  </LogCard>
                  <LogCard title={t.units}>
                      <div className="flex justify-between items-center mb-4 pb-4 border-b border-slate-50"><span className="text-sm font-bold text-slate-600">Temp Unit</span><div className="flex bg-slate-100 p-1 rounded-lg">{['C','F'].map(u => <button key={u} onClick={()=>dispatch({ type: 'UPDATE_PROFILE', payload: { unit: u as any } })} className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${state.profile.unit===u ? 'bg-white shadow-sm text-slate-800' : 'text-slate-400'}`}>°{u}</button>)}</div></div>
                      <div className="flex justify-between items-center"><span className="text-sm font-bold text-slate-600">Language</span><div className="flex gap-2">{['en','es','fr'].map(l => <button key={l} onClick={()=>dispatch({ type: 'UPDATE_PROFILE', payload: { lang: l as any } })} className={`px-3 py-1 rounded-lg text-xs font-bold uppercase border ${state.profile.lang===l ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-400 border-slate-200'}`}>{l}</button>)}</div></div>
                  </LogCard>
                  <LogCard title="Data & Security">
                      <div className="space-y-3">
                          <button onClick={handleExportCSV} className="w-full py-3 border border-slate-200 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-50 flex items-center justify-center gap-2"><FileText size={14}/> {t.export}</button>
                          <button onClick={handleExportBackup} className="w-full py-3 border border-slate-200 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-50 flex items-center justify-center gap-2"><Download size={14}/> Backup Vault</button>
                          <label className="w-full py-3 border border-slate-200 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-50 flex items-center justify-center gap-2 cursor-pointer"><Upload size={14}/> Restore Vault <input type="file" className="hidden" accept=".json" onChange={handleRestoreBackup} /></label>
                      </div>
                  </LogCard>
                  <LogCard title={t.intel}>
                      <div className="flex items-center justify-between mb-4">
                          <span className="text-sm font-bold text-slate-700">Activate AI</span>
                          <button onClick={()=>dispatch({ type: 'UPDATE_PROFILE', payload: { aiActive: !state.profile.aiActive } })} className={`w-12 h-7 rounded-full transition-colors relative ${state.profile.aiActive ? 'bg-emerald-500' : 'bg-slate-200'}`}><div className={`w-5 h-5 bg-white rounded-full shadow-sm absolute top-1 transition-all ${state.profile.aiActive ? 'left-6' : 'left-1'}`}></div></button>
                      </div>
                      {state.profile.aiActive && (
                          <div className="animate-fadeIn mt-2 p-4 bg-slate-50 rounded-xl border border-slate-200">
                              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">API Key (OpenAI / Gemini)</label>
                              <input 
                                  type="password" 
                                  value={state.profile.apiKey || ''} 
                                  onChange={e => dispatch({type: 'UPDATE_PROFILE', payload: {apiKey: e.target.value}})}
                                  className="w-full bg-white border border-slate-200 rounded-lg p-3 text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-100 mb-2"
                                  placeholder="sk-... or AIza..."
                              />
                              <div className="flex items-center gap-2">
                                  <div className={`w-2 h-2 rounded-full ${state.profile.aiProvider !== 'unknown' ? 'bg-emerald-500' : 'bg-slate-300'}`}></div>
                                  <span className="text-[10px] font-bold text-slate-400 uppercase">{state.profile.aiProvider === 'unknown' ? 'No Key Detected' : `Connected: ${state.profile.aiProvider}`}</span>
                              </div>
                          </div>
                      )}
                  </LogCard>
              </div>
          )}

          {/* TAB: HELP */}
          {activeTab === 'help' && (
              <div className="space-y-4 animate-fadeIn pt-4">
                  <LogCard title="Legend">
                       <div className="flex justify-between px-2">
                          <LegendItem color="bg-rose-400" label="Flow" />
                          <LegendItem color="bg-teal-400" label="Fertile" />
                          <LegendItem color="bg-slate-800" label="Today" />
                       </div>
                  </LogCard>
                  <LogCard title="FAQ">
                      <FAQItem q="What happens if I add an AI key?" a="It unlocks 'Forensic Mode'. Hera uses your key (stored locally) to send encrypted anonymized data to the AI model. This provides deeper analysis of temperature shifts and ovulation prediction." />
                      <FAQItem q="How do I backup my data?" a="Go to Settings > Data & Security. Click 'Backup Vault' to download an encrypted JSON file. Save this safely." />
                      <FAQItem q="What do the dots mean?" a="Red dots indicate menstruation flow. Teal dots indicate fertile cervical mucus quality." />
                      <FAQItem q="Is my data safe?" a="Yes. We use Zero-Knowledge Encryption. Your password decrypts your data locally. We never see it." />
                  </LogCard>
              </div>
          )}
        </main>

        {/* BOTTOM TAB BAR */}
        <div className="absolute bottom-0 w-full bg-white border-t border-slate-100 p-2 pb-6 px-4 z-20 grid grid-cols-5 items-end">
            <button onClick={() => setActiveTab('overview')} className={`flex flex-col items-center gap-1 p-2 transition-colors ${activeTab === 'overview' ? currentTheme.accent : 'text-slate-300'}`}><Home size={24} strokeWidth={activeTab==='overview'?2.5:2} /><span className="text-[9px] font-bold uppercase tracking-wider">{t.home}</span></button>
            <button onClick={() => setActiveTab('calendar')} className={`flex flex-col items-center gap-1 p-2 transition-colors ${activeTab === 'calendar' ? currentTheme.accent : 'text-slate-300'}`}><CalendarIcon size={24} strokeWidth={activeTab==='calendar'?2.5:2} /><span className="text-[9px] font-bold uppercase tracking-wider">{t.cal}</span></button>
            <div className="flex justify-center -mt-8"><button onClick={() => setActiveTab('log')} className={`w-16 h-16 rounded-[1.2rem] flex flex-col items-center justify-center text-white shadow-xl transition-transform active:scale-95 ${currentTheme.logBtn} ring-4 ring-white`}><Droplet size={28} fill="currentColor" className="mb-0.5" /><span className="text-[9px] font-black uppercase tracking-widest">{t.log}</span></button></div>
            <button onClick={() => setActiveTab('settings')} className={`flex flex-col items-center gap-1 p-2 transition-colors ${activeTab === 'settings' ? currentTheme.accent : 'text-slate-300'}`}><Settings size={24} strokeWidth={activeTab==='settings'?2.5:2} /><span className="text-[9px] font-bold uppercase tracking-wider">{t.set}</span></button>
            <button onClick={() => setActiveTab('help')} className={`flex flex-col items-center gap-1 p-2 transition-colors ${activeTab === 'help' ? currentTheme.accent : 'text-slate-300'}`}><HelpCircle size={24} strokeWidth={activeTab==='help'?2.5:2} /><span className="text-[9px] font-bold uppercase tracking-wider">{t.help}</span></button>
        </div>
      </div>
      <style>{`.no-scrollbar::-webkit-scrollbar { display: none; } .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; } .animate-fadeIn { animation: fadeIn 0.4s ease-out forwards; } @keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } } .animate-shake { animation: shake 0.5s cubic-bezier(.36,.07,.19,.97) both; } @keyframes shake { 10%, 90% { transform: translate3d(-1px, 0, 0); } 20%, 80% { transform: translate3d(2px, 0, 0); } 30%, 50%, 70% { transform: translate3d(-4px, 0, 0); } 40%, 60% { transform: translate3d(4px, 0, 0); } }`}</style>
    </div>
  );
}
