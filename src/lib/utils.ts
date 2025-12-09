import { CycleDay } from './types';

// Calculates Cycle Day based on the last "reset" event (Period start)
export function calculateCycleDay(history: CycleDay[], targetDateStr: string): number {
  const targetDate = new Date(targetDateStr);
  const sorted = [...history].sort((a, b) => b.date.localeCompare(a.date));
  
  const lastPeriod = sorted.find(d => {
    return d.date <= targetDateStr && (d.flow === 'medium' || d.flow === 'heavy');
  });

  if (!lastPeriod) return 1; 

  const periodDate = new Date(lastPeriod.date);
  const diffTime = Math.abs(targetDate.getTime() - periodDate.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
  
  return diffDays + 1; 
}

export const getLocalISODate = (d: Date = new Date()) => {
  const offset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - offset).toISOString().split('T')[0];
};

export const formatDate = (dateStr: string) => 
  new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', weekday: 'short' }).format(new Date(dateStr + 'T12:00:00'));

export const addDays = (dateStr: string, days: number): string => {
  const d = new Date(dateStr);
  const local = new Date(d.valueOf() + d.getTimezoneOffset() * 60000);
  local.setDate(local.getDate() + days);
  return getLocalISODate(local);
};
