import {
  Vessel,
  SatelliteData,
  OceanData,
  WeatherData,
  Iceberg,
  CandidateRoute,
  RiskBreakdown,
  AlertItem,
  MissionSummary
} from '../types';
import {
  initialVessel,
  initialSatellite,
  initialOcean,
  initialWeather,
  initialIcebergs,
  initialRoutes,
  initialRiskBreakdown,
  initialAlerts,
  initialMissionSummary
} from '../../server/data';

const BASE_URL = import.meta.env.VITE_API_URL || '/api';
async function fetchJson<T>(url: string, fallback: T): Promise<T> {
  try {
    const response = await fetch(`${BASE_URL}${url}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (err) {
    console.warn(`API call to ${url} failed or offline. Using local mock dataset.`, err);
    return fallback;
  }
}

async function postJson<T, B>(url: string, body: B, fallback: T): Promise<T> {
  try {
    const response = await fetch(`${BASE_URL}${url}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (err) {
    console.warn(`API POST to ${url} failed. Using local engine fallback.`, err);
    return fallback;
  }
}

export interface SimulationResult {
  message: string;
  eventTitle: string;
  recalculatedRisk: RiskBreakdown;
  updatedRoutes: CandidateRoute[];
  updatedIcebergs: Iceberg[];
  newAlert: AlertItem;
  statusNotice: string;
}

export const apiService = {
  getVessel: () => fetchJson<Vessel>('/vessel', initialVessel),
  getSatellite: () => fetchJson<SatelliteData>('/satellite', initialSatellite),
  getOcean: () => fetchJson<OceanData>('/ocean', initialOcean),
  getWeather: () => fetchJson<WeatherData>('/weather', initialWeather),
  getIcebergs: () => fetchJson<Iceberg[]>('/icebergs', initialIcebergs),
  getRoutes: () => fetchJson<CandidateRoute[]>('/routes', initialRoutes),
  getRiskBreakdown: () => fetchJson<RiskBreakdown>('/risk', initialRiskBreakdown),
  getAlerts: () => fetchJson<AlertItem[]>('/alerts', initialAlerts),
  getAnalytics: () => fetchJson<MissionSummary>('/analytics', initialMissionSummary),

  refreshData: async () => {
    return postJson('/refresh-data', {}, {
      message: 'Telemetry refreshed',
      satellite: { ...initialSatellite, timestamp: new Date().toISOString() },
      weather: initialWeather,
      ocean: initialOcean
    });
  },

  calculateRisk: async (params: {
    seaIceRisk: number;
    icebergRisk: number;
    weatherRisk: number;
    oceanRisk: number;
    vesselRisk: number;
  }) => {
    const overall = Math.round(
      params.seaIceRisk * 0.30 +
      params.icebergRisk * 0.25 +
      params.weatherRisk * 0.25 +
      params.oceanRisk * 0.10 +
      params.vesselRisk * 0.10
    );

    let status: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL' = 'LOW';
    if (overall > 80) status = 'CRITICAL';
    else if (overall > 60) status = 'HIGH';
    else if (overall > 30) status = 'MODERATE';

    const fallback: RiskBreakdown = {
      overallScore: overall,
      status,
      seaIceRisk: params.seaIceRisk,
      icebergCollisionRisk: params.icebergRisk,
      weatherRisk: params.weatherRisk,
      oceanRisk: params.oceanRisk,
      vesselCapabilityRisk: params.vesselRisk,
      factors: [
        { name: 'Sea-Ice Risk', value: params.seaIceRisk, description: `Sea ice concentration exposure (${params.seaIceRisk}/100)` },
        { name: 'Weather Risk', value: params.weatherRisk, description: `Wind force & wave impact (${params.weatherRisk}/100)` },
        { name: 'Ocean Risk', value: params.oceanRisk, description: `Current velocity & surface temperatures (${params.oceanRisk}/100)` },
        { name: 'Iceberg Collision Risk', value: params.icebergRisk, description: `Collision probability of tracked bergs (${params.icebergRisk}/100)` },
        { name: 'Vessel Capability Risk', value: params.vesselRisk, description: `Hull polar ice-class margin (${params.vesselRisk}/100)` }
      ]
    };

    return postJson<RiskBreakdown, typeof params>('/risk/calculate', params, fallback);
  },

  optimizeRoutes: async (weights: {
    safetyWeight: number;
    speedWeight: number;
    fuelWeight: number;
  }) => {
    const updatedRoutes = initialRoutes.map(r => {
      const safetyComponent = r.safetyScore * weights.safetyWeight;
      const speedComponent = (2000 / r.distance) * 50 * weights.speedWeight;
      const fuelComponent = (200 / r.fuel) * 50 * weights.fuelWeight;
      const score = Math.round(safetyComponent + speedComponent + fuelComponent);
      return { ...r, overallWeightedScore: score };
    });

    let bestId = 'route-a';
    let maxS = -1;
    updatedRoutes.forEach(r => {
      if (r.overallWeightedScore > maxS) {
        maxS = r.overallWeightedScore;
        bestId = r.id;
      }
    });

    const finalRoutes = updatedRoutes.map(r => ({
      ...r,
      isRecommended: r.id === bestId
    }));

    return postJson<{ recommendedRouteId: string; routes: CandidateRoute[] }, typeof weights>(
      '/routes/optimize',
      weights,
      { recommendedRouteId: bestId, routes: finalRoutes }
    );
  },

  simulateRiskEvent: async (eventType: 'new_iceberg' | 'sea_ice_spike' | 'severe_storm' | 'route_blocked'): Promise<SimulationResult> => {
    const fallback: SimulationResult = {
      message: `Simulated event: ${eventType}`,
      eventTitle: 'Event triggered',
      recalculatedRisk: { ...initialRiskBreakdown, overallScore: 68, status: 'HIGH' },
      updatedRoutes: initialRoutes.map(r => r.id === 'route-a' ? { ...r, isRecommended: true } : { ...r, isRecommended: false }),
      updatedIcebergs: initialIcebergs,
      newAlert: {
        id: `ALT-LOCAL-${Date.now()}`,
        category: 'CRITICAL',
        title: 'SIMULATED CRITICAL EVENT',
        message: 'Hazardous environmental event detected along active flight plan.',
        location: '63°30\'S, 60°00\'W',
        timestamp: 'Just now',
        recommendedAction: 'Execute dynamic rerouting maneuver.',
        actionRequired: true
      },
      statusNotice: 'Route recalculated due to changing environmental conditions.'
    };

    return postJson<SimulationResult, { eventType: string }>('/simulation/event', { eventType }, fallback);
  }
};
