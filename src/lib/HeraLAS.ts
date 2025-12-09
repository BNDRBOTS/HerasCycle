import { CycleDay, MucusType, LHResult, CervixPosition } from './types';

const WEIGHTS = {
  MUCUS: 2.5,
  TEMP: 2.2,
  LH: 1.9,
  CERVIX: 1.5,
  STRESS: 1.4 
};

export interface ForensicOutput {
  score: number;
  status: 'FERTILE_PEAK' | 'HIGH_FERTILITY' | 'WAITING' | 'LUTEAL_LOCK' | 'STRESS_BLOCK';
  actionDirective: string;
  probability: number;
  vectorAnalysis: string;
}

export class HeraEngine {

  private static normalizeMucus(m: MucusType): number {
    const map: Record<MucusType, number> = {
      'none': 0, 'dry': 1, 'sticky': 3, 
      'creamy': 5, 'watery': 8, 'eggwhite': 10
    };
    return map[m] || 0;
  }

  private static normalizeLH(l: LHResult): number {
    const map: Record<LHResult, number> = {
      'negative': 0, 'faint': 2, 'equal': 7, 'peak': 10
    };
    return map[l] || 0;
  }

  private static normalizeCervix(c: CervixPosition): number {
    const map: Record<CervixPosition, number> = {
      'low_hard': 1, 'med_firm': 5, 'high_soft': 10
    };
    return map[c] || 1;
  }

  private static normalizeTemp(t: number, day: number): number {
    if (t < 36.1) return 2; 
    if (t > 36.4 && t < 36.7 && day < 14) return 8; 
    if (t >= 36.7 && day >= 14) return 9; 
    return 5;
  }

  public static compute(input: Partial<CycleDay> & { cycleDay: number }): ForensicOutput {
    
    const M = this.normalizeMucus(input.mucus || 'none');
    const L = this.normalizeLH(input.lhTest || 'negative');
    const P = this.normalizeCervix(input.cervix || 'low_hard');
    const T = this.normalizeTemp(input.temperature || 36.5, input.cycleDay);
    const S = Math.max(input.stressLevel || 1, 1);

    const mFac = Math.pow(M, WEIGHTS.MUCUS);
    const tFac = Math.pow(T, WEIGHTS.TEMP);
    const lFac = Math.pow(L || 1, WEIGHTS.LH); 
    const pFac = Math.pow(P, WEIGHTS.CERVIX);
    const sFac = Math.pow(S, WEIGHTS.STRESS);

    let rawScore = (mFac * tFac * lFac * pFac) / sFac;
    const logScore = Math.log10(rawScore + 1) * 2000; 
    const finalScore = Math.min(Math.round(logScore), 10000);

    let status: ForensicOutput['status'] = 'WAITING';
    let directive = "Maintain baseline monitoring.";
    
    if (S > 7) {
        status = 'STRESS_BLOCK';
        directive = "CRITICAL: Cortisol override detected. HPO axis suppressed. Initiate regulation protocol.";
    } else if (finalScore >= 7500) {
        status = 'FERTILE_PEAK';
        directive = "WINDOW OPEN: Biometric Probability >90%. Connection recommended.";
    } else if (finalScore >= 5000) {
        status = 'HIGH_FERTILITY';
        directive = "WINDOW OPENING: Probability rising. Monitor LH every 4 hours.";
    } else if (input.cycleDay > 20 && T > 8) {
        status = 'LUTEAL_LOCK';
        directive = "Window closed. Progesterone dominance confirmed.";
    }

    return {
      score: finalScore,
      status: status,
      actionDirective: directive,
      probability: finalScore / 10000,
      vectorAnalysis: `M:${M} T:${T} L:${L} S:${S}`
    };
  }
}
