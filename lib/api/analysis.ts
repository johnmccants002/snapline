import type { AnalysisResult } from '../../types/analysis';
import { invoke } from './invoke';
export const analyzeGame = (id: string) =>
  invoke<AnalysisResult>('analyze-game', { id });
