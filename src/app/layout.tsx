"use client";

import React, { useReducer, useEffect, useState, useMemo, useRef } from 'react';
import { 
  Lock, Save, Check, Droplet, Calendar as CalendarIcon, 
  Settings as SettingsIcon, ChevronLeft, ChevronRight, FileText 
} from 'lucide-react';
import { appReducer, DEFAULT_STATE } from '../lib/store';
import { HeraEngine, ForensicOutput } from '../lib/HeraLAS';
import { HeraVault } from '../lib/HeraVault';
import { AmbientBreather } from '../components/AmbientBreather';
import { BiometricChart } from '../components/BiometricChart';
import { Card, LogCard, PillBtn, StepperControl, HighQualityLogo } from '../components/ui/Primitives';
import { CycleDay } from '../lib/types';
import { calculateCycleDay, getLocalISODate, formatDate, addDays } from '../lib/utils';

export default function HeraCycleApp() {
  const [state, dispatch] = useReducer(appReducer, DEFAULT_STATE);
  const [status, setStatus] = useState<'loading' | 'auth' | 'app'>('loading');
  const [password, setPassword] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'calendar' | 'settings'>('overview');
  const [selectedDate, setSelectedDate] = useState<string>(getLocalISODate());
  const [saveState, setSaveState] = useState<'idle'|'saving'|'saved'>('idle');
  const [dismissedStress, setDismissedStress] = useState(false);
  const activePassword = useRef<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem('HERA_VAULT_CORE');
    setStatus(stored ? 'auth' : 'auth'); 
  }, []);

  const currentBiometrics = useMemo(() => {
    const todayEntry = state.cycleData.find(d => d.date === selectedDate) 
      || { date: selectedDate, temperature: 36.5, mucus: 'none', flow: 'none', cervix: 'low_hard', lhTest: 'negative', stressLevel: 1, notes: '' };
    
    const cycleDay = calculateCycleDay(state.cycleData, selectedDate);

    return HeraEngine.compute({
      ...todayEntry,
      cycleDay,
    });
  }, [state.cycleData, selectedDate]);

  useEffect(() => {
    if (currentBiometrics.status === 'FERTILE_PEAK' && typeof navigator !== 'undefined' && navigator.vibrate) {
       navigator.vibrate([30, 50, 30]);
    }
    if (currentBiometrics.status !== 'STRESS_BLOCK') setDismissedStress(false);
  }, [currentBiometrics.status]);

  const handleUnlock = async () => {
    try {
      const stored = localStorage.getItem('HERA_VAULT_CORE');
      if (!stored) {
        await HeraVault.lock(DEFAULT_STATE, password);
        dispatch({ type: 'LOAD_STATE', payload: DEFAULT_STATE });
      } else {
        const data = await HeraVault.unlock(password);
        if (data) dispatch({ type: 'LOAD_STATE', payload: data });
      }
      activePassword.current = password;
      setStatus('app');
    } catch (e) {
      alert("Sanctuary Locked: Incorrect Key");
    }
  };

  const handleSave = async () => {
    if (!activePassword.current) return;
    setSaveState('saving');
    await HeraVault.lock(state, activePassword.current);
    dispatch({ type: 'MARK_SAVED' });
    setSaveState('saved');
    setTimeout(() => setSaveState('idle'), 2000);
  };

  const handleExport = () => {
    const csvContent = "data:text/csv;charset=utf-8," + 
      ['Date,Temp,Mucus,Flow,Stress'].join(',') + '\n' +
      state.cycleData.map(d => `${d.date},${d.temperature},${d.mucus},${d.flow},${d.stressLevel}`).join('\n');
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", `hera_data_${getLocalISODate()}.csv`);
    document.body.appendChild(link);
    link.click();
  };

  const updateDay = (update: Partial<CycleDay>) => {
    const current = state.cycleData.find(d => d.date === selectedDate) || { 
      date: selectedDate, temperature: 36.5, mucus: 'none', flow: 'none', cervix: 'low_hard', lhTest: 'negative', stressLevel: 1, notes: '' 
    };
    dispatch({ type: 'UPDATE_CYCLE_DAY', payload: { ...current, ...update } });
  };

  const getCurrentTheme = (status: ForensicOutput['status']) => {
    switch (status) {
      case 'FERTILE_PEAK': return 'bg-gradient-to-br from-rose-50 to-orange-50';
      case 'STRESS_BLOCK': return 'bg-slate-950'; 
      case 'LUTEAL_LOCK': return 'bg-gradient-to-br from-indigo-50 to-purple-50';
      default: return 'bg-[#fafafa]';
    }
  };

  const getScoreColor = (score: number) => {
    if (score > 7500) return 'text-hera-crimson';
    if (score > 5000) return 'text-hera-gold';
    return 'text-slate-800';
  };

  if (status === 'auth') return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-sm bg-white/80 backdrop-blur-xl rounded-[2.5rem] shadow-2xl p-8 border border-white/50 text-center animate-fade-in">
        <HighQualityLogo className="w-24 h-24 mx-auto mb-6 drop-shadow-xl hover:scale-105 transition-transform duration-700" />
        <h1 className="text-3xl font-black text-slate-800 mb-2 tracking-tight">Hera</h1>
        <p className="text-xs font-bold text-rose-400 uppercase tracking-[0.2em] mb-8">Sanctuary Access</p>
        <input 
          type="password" 
          value={password} 
          onChange={e=>setPassword(e.target.value)} 
          className="w-full bg-slate-100 border-none rounded-2xl p-4 text-center font-bold text-lg mb-4 focus:ring-2 focus:ring-rose-200 outline-none transition-all placeholder:text-slate-300 tracking-widest" 
          placeholder="••••••"
        />
        <button onClick={handleUnlock} className="w-full bg-slate-900 text-white font-bold py-4 rounded-2xl shadow-xl hover:scale-[1.02] active:scale-95 transition-all">
          Open
        </button>
      </div>
    </div>
  );

  const currentEntry = state.cycleData.find(d => d.date === selectedDate) || { temperature: 36.5, mucus: 'none', flow: 'none', stressLevel: 1 };

  return (
    <div className={`min-h-[100dvh] transition-colors duration-1000 ${getCurrentTheme(currentBiometrics.status)} flex flex-col`}>
      <header className="fixed top-0 w-full z-50 backdrop-blur-md border-b border-white/10 px-6 py-4 flex justify-between items-center bg-white/30">
        <HighQualityLogo className="w-10 h-10 drop-shadow-md" />
        <div className="text-right">
          <div className="text-[10px] font-black tracking-[0.2em] uppercase text-slate-400">Resonance</div>
          <div className={`text-2xl font-black tabular-nums transition-colors duration-500 ${getScoreColor(currentBiometrics.score)}`}>
            {currentBiometrics.score}
          </div>
        </div>
      </header>

      <div className="pt-20 px-0">
         <AmbientBreather isActive={currentBiometrics.status === 'STRESS_BLOCK' && !dismissedStress} onDismiss={() => setDismissedStress(true)} />
      </div>

      <main className="flex-1 px-4 pb-32 pt-4 max-w-md mx-auto w-full overflow-y-auto no-scrollbar">
        {activeTab === 'overview' && (
          <div className="animate-fade-in space-y-6">
            <div className="px-2">
                <div className="flex justify-between items-center mb-1">
                  <h2 className={`text-3xl font-black leading-none tracking-tight ${currentBiometrics.status === 'STRESS_BLOCK' ? 'text-white' : 'text-slate-800'}`}>
                      {currentBiometrics.status.replace(/_/g, ' ')}
                  </h2>
                  <span className="text-xs font-bold bg-white/50 px-2 py-1 rounded-lg text-slate-500">Day {calculateCycleDay(state.cycleData, selectedDate)}</span>
                </div>
                <p className={`text-sm font-medium leading-relaxed ${currentBiometrics.status === 'STRESS_BLOCK' ? 'text-rose-200' : 'text-slate-500'}`}>
                    {currentBiometrics.actionDirective}
                </p>
            </div>

            <Card className={`overflow-hidden h-72 transition-all ${currentBiometrics.status === 'STRESS_BLOCK' ? 'border-rose-900/30 shadow-[0_0_30px_rgba(255,0,0,0.05)]' : ''}`}>
              <div className="flex justify-between items-end mb-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Biometric Flow</span>
              </div>
              <BiometricChart data={state.cycleData.slice(-30).map(d => ({ date: formatDate(d.date), temp: d.temperature, heraScore: HeraEngine.compute({...d, cycleDay: calculateCycleDay(state.cycleData, d.date)}).score }))} />
            </Card>

            <div className="flex justify-between items-center bg-white p-3 rounded-2xl shadow-sm border border-slate-100">
                <button onClick={()=>setSelectedDate(addDays(selectedDate, -1))}><ChevronLeft size={20} className="text-slate-400"/></button>
                <div className="text-center"><span className="text-[10px] font-bold text-rose-500 uppercase block mb-0.5">Logging For</span><span className="text-lg font-black text-slate-800">{formatDate(selectedDate)}</span></div>
                <button onClick={()=>setSelectedDate(addDays(selectedDate, 1))}><ChevronRight size={20} className="text-slate-400"/></button>
            </div>

            <div className="space-y-4">
                <LogCard title="Basal Temp">
                    <StepperControl value={currentEntry.temperature || 36.5} min={35} max={42} step={0.05} unit="C" onChange={(v: number) => updateDay({ temperature: v })} />
                </LogCard>

                <LogCard title="Biomarkers">
                    <div className="space-y-3">
                        <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Fluid</label>
                            <div className="flex gap-1">{['dry', 'sticky', 'creamy', 'eggwhite'].map(m => <PillBtn key={m} label={m} active={currentEntry.mucus === m} onClick={() => updateDay({ mucus: m as any })} />)}</div>
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">LH Strip</label>
                            <div className="flex gap-1">{['negative', 'faint', 'peak'].map(l => <PillBtn key={l} label={l} active={(currentEntry as any).lhTest === l} onClick={() => updateDay({ lhTest: l as any })} />)}</div>
                        </div>
                    </div>
                </LogCard>

                <LogCard title="Cortisol (Stress)">
                    <input type="range" min="1" max="10" value={currentEntry.stressLevel || 1} onChange={e => updateDay({ stressLevel: parseInt(e.target.value) })} className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-rose-500" />
                    <div className="flex justify-between text-[10px] font-bold text-slate-400 mt-2"><span>Calm (1)</span><span>High (10)</span></div>
                </LogCard>

                <button onClick={handleSave} className="w-full bg-slate-900 text-white font-bold py-4 rounded-2xl shadow-xl flex items-center justify-center gap-2 active:scale-95 transition-transform hover:bg-slate-800">
                    {saveState === 'saved' ? <Check size={20} className="text-emerald-400"/> : <Save size={20} />}
                    {saveState === 'saved' ? "Securely Saved" : "Log Entry"}
                </button>
            </div>
          </div>
        )}

        {activeTab === 'calendar' && (
          <div className="animate-fade-in space-y-6">
             <div className="bg-white rounded-[2rem] p-6 shadow-xl border border-slate-100">
                <h3 className="text-xl font-black text-slate-800 mb-6">Cycle History</h3>
                <div className="grid grid-cols-7 gap-2">
                   {Array.from({length: 30}, (_, i) => {
                      const dStr = addDays(getLocalISODate(new Date(new Date().setDate(1))), i);
                      const dayData = state.cycleData.find(d => d.date === dStr);
                      const isFertile = dayData?.mucus === 'eggwhite' || dayData?.lhTest === 'peak';
                      return (
                        <div key={i} onClick={() => { setSelectedDate(dStr); setActiveTab('overview'); }} className={`aspect-square rounded-xl flex items-center justify-center border-2 cursor-pointer transition-all ${dStr === selectedDate ? 'border-rose-500 bg-rose-50' : 'border-transparent bg-slate-50'} ${isFertile ? 'ring-2 ring-emerald-200' : ''}`}>
                           <span className={`text-xs font-bold ${isFertile ? 'text-emerald-600' : 'text-slate-400'}`}>{i + 1}</span>
                        </div>
                      )
                   })}
                </div>
                <div className="mt-6 flex justify-center gap-4">
                    <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-emerald-200"></div><span className="text-[10px] font-bold text-slate-400 uppercase">Peak</span></div>
                    <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-rose-50 border border-rose-500"></div><span className="text-[10px] font-bold text-slate-400 uppercase">Selected</span></div>
                </div>
             </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="animate-fade-in space-y-4">
             <LogCard title="Data Sovereignty">
                <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                  Your data is encrypted with a Zero-Knowledge key. It lives only on this device. 
                  Exporting creates a raw CSV for your medical provider.
                </p>
                <button onClick={handleExport} className="w-full py-3 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 flex items-center justify-center gap-2 mb-2">
                   <FileText size={16}/> Export Medical CSV
                </button>
             </LogCard>
             
             <LogCard title="Sanctuary Settings">
                <button onClick={() => { if(confirm("This will erase all local data. Continue?")) { localStorage.clear(); window.location.reload(); } }} className="w-full py-3 bg-rose-50 border border-rose-100 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-100 flex items-center justify-center gap-2">
                   <Lock size={16}/> Reset & Wipe Sanctuary
                </button>
             </LogCard>
          </div>
        )}

      </main>

      <div className="fixed bottom-0 w-full bg-white/90 backdrop-blur-lg border-t border-slate-100 p-2 pb-6 px-6 z-40 grid grid-cols-3 items-end max-w-md mx-auto left-0 right-0">
          <button onClick={() => setActiveTab('calendar')} className={`flex flex-col items-center gap-1 p-2 transition-colors ${activeTab === 'calendar' ? 'text-rose-500' : 'text-slate-300'}`}>
             <CalendarIcon size={24} strokeWidth={activeTab==='calendar'?2.5:2} />
             <span className="text-[9px] font-bold uppercase tracking-wider">History</span>
          </button>
          <div className="flex justify-center -mt-10">
             <button onClick={() => setActiveTab('overview')} className={`w-16 h-16 rounded-[1.2rem] flex flex-col items-center justify-center text-white shadow-2xl transition-transform active:scale-95 bg-slate-900 ring-4 ring-white`}>
                <Droplet size={28} fill="currentColor" className="mb-0.5" />
             </button>
          </div>
          <button onClick={() => setActiveTab('settings')} className={`flex flex-col items-center gap-1 p-2 transition-colors ${activeTab === 'settings' ? 'text-rose-500' : 'text-slate-300'}`}>
             <SettingsIcon size={24} strokeWidth={activeTab==='settings'?2.5:2} />
             <span className="text-[9px] font-bold uppercase tracking-wider">Settings</span>
          </button>
      </div>
    </div>
  );
}
