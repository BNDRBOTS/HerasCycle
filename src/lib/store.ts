import { AppState, UserProfile, CycleDay } from './types';

export const DEFAULT_STATE: AppState = {
  profile: { name: 'Hera', theme: 'blush', unit: 'C', lang: 'en' },
  cycleData: [],
  lastSynced: Date.now(),
  unsavedChanges: false
};

export type Action = 
  | { type: 'LOAD_STATE'; payload: AppState }
  | { type: 'UPDATE_PROFILE'; payload: Partial<UserProfile> }
  | { type: 'UPDATE_CYCLE_DAY'; payload: CycleDay }
  | { type: 'RESET_APP' }
  | { type: 'MARK_SAVED' };

export const appReducer = (state: AppState, action: Action): AppState => {
  switch (action.type) {
    case 'LOAD_STATE': return { ...action.payload, unsavedChanges: false };
    case 'UPDATE_PROFILE': return { ...state, profile: { ...state.profile, ...action.payload }, unsavedChanges: true };
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
