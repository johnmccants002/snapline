export interface SportsbookOdds {
  key: string;
  title: string;
  lastUpdate: string | null;
  homeSpread: number | null;
  homeSpreadPrice: number | null;
  awaySpread: number | null;
  awaySpreadPrice: number | null;
  total: number | null;
  overPrice: number | null;
  underPrice: number | null;
  homeMoneyline: number | null;
  awayMoneyline: number | null;
}
export interface NFLGame {
  id: string;
  sportKey: 'americanfootball_nfl';
  commenceTime: string;
  homeTeam: string;
  awayTeam: string;
  season: number | null;
  week: number | null;
  market: {
    consensusSpread: number | null;
    consensusTotal: number | null;
    sportsbooks: SportsbookOdds[];
    bookmakerCount: number;
    spreadBookCount: number;
  };
}
export interface LinePoint {
  capturedAt: string;
  homeSpread: number;
  bookCount: number;
}
export interface GameWeather {
  temperatureF: number | null;
  windSpeedMph: number | null;
  windGustMph: number | null;
  precipitationProbability: number | null;
  humidity: number | null;
  conditions: string | null;
  forecastFor: string;
}
export interface WeatherProvider {
  getGameWeather(input: {
    gameId: string;
    stadium?: string;
    latitude?: number;
    longitude?: number;
    kickoffTime: string;
  }): Promise<GameWeather | null>;
}
export interface GameInjury {
  playerId?: string;
  playerName: string;
  team: string;
  position: string | null;
  status: string;
  injury: string | null;
  practiceStatus: string | null;
  impactScore: number | null;
}
export interface InjuryProvider {
  getGameInjuries(input: {
    gameId: string;
    homeTeam: string;
    awayTeam: string;
    kickoffTime: string;
  }): Promise<GameInjury[]>;
}
export interface QuantitativeModelResult {
  modelVersion: string;
  estimatedHomeMargin: number;
  marketHomeSpread: number;
  edge: number;
  weatherImpact: number | null;
  injuryImpact: number | null;
  confidence: number | null;
}
export interface GameAnalysis {
  lean: 'HOME' | 'AWAY' | 'PASS' | 'INSUFFICIENT_DATA';
  confidence: number;
  summary: string;
  marketAnalysis: string;
  weatherAnalysis: string | null;
  injuryAnalysis: string | null;
  keyFactors: {
    factor: string;
    direction: 'HOME' | 'AWAY' | 'NEUTRAL';
    importance: 'LOW' | 'MEDIUM' | 'HIGH';
    explanation: string;
  }[];
  riskFactors: string[];
}
export interface AnalysisResult {
  analysis: GameAnalysis;
  createdAt: string;
  model: string;
}
export interface OddsResponse {
  games: NFLGame[];
  fetchedAt: string;
  stale: boolean;
}
