export type Theme = 'blush' | 'serenity' | 'nature';
export type Unit = 'C' | 'F';
export type Language = 'en' | 'es' | 'fr';
export type FlowIntensity = 'none' | 'spotting' | 'light' | 'medium' | 'heavy';
export type MucusType = 'none' | 'dry' | 'sticky' | 'creamy' | 'eggwhite' | 'watery';
export type CervixPosition = 'low_hard' | 'med_firm' | 'high_soft';
export type LHResult = 'negative' | 'faint' | 'equal' | 'peak';

export interface CycleDay {
  date: string; // YYYY-MM-DD
  temperature: number | null;
  mucus: MucusType;
  flow: FlowIntensity;
  cervix: CervixPosition;
  lhTest: LHResult;
  stressLevel: number; // 1-10
  notes: string;
}

export interface UserProfile {
  name: string;
  theme: Theme;
  unit: Unit;
  lang: Language;
}

export interface AppState {
  profile: UserProfile;
  cycleData: CycleDay[];
  lastSynced: number;
  unsavedChanges: boolean;
}
