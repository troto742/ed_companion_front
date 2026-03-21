import { HttpClient } from '@angular/common/http';
import { Injectable, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { StateSnapshot } from './state.types';

const DEFAULT_BACKEND_URL = '';
const BACKEND_URL_STORAGE_KEY = 'elite-backend-url';
const BACKEND_API_KEY_STORAGE_KEY = 'elite-api-key';
const BACKEND_ADMIN_KEY_STORAGE_KEY = 'elite-admin-key';

interface RouteUploadResponse {
  routeLoaded: boolean;
  routeName: string;
  legs: number;
}

export interface SpanshRoutePreviewRow {
  systemName: string;
  distance: number | null;
  distanceRemaining: number | null;
  estimatedJumps: number | null;
  refuel: boolean;
  neutronStar: boolean;
}

interface SpanshRouteResponse {
  routeLoaded: boolean;
  routeName: string;
  legs: number;
  previewRows: SpanshRoutePreviewRow[];
}

export interface CommoditySearchStation {
  marketId: number | null;
  systemName: string;
  stationName: string;
  distanceLy: number | null;
  price: number | null;
  supply: number | null;
  demand: number | null;
  updatedAt: string | null;
}

export interface CommoditySearchResult {
  sourceSystem: string;
  commodity: string;
  cheapest: CommoditySearchStation[];
  nearest: CommoditySearchStation[];
}

export interface TradeRecommendation {
  commodityId: string;
  commodityName: string;
  origin: {
    systemName: string;
    stationName: string;
    marketId: number | null;
  };
  destination: {
    systemName: string;
    stationName: string;
    marketId: number | null;
  };
  buyPrice: number;
  sellPrice: number;
  profitPerUnit: number;
  distanceLy: number | null;
  sourceSupply: number;
  destinationDemand: number;
  estimatedVolume: number;
  score: number;
  explanation: string;
}

export interface TradeRecommendationsResult {
  sourceSystem: string | null;
  filters: {
    topN: number;
    minProfit: number;
    maxDistance: number | null;
    commodityId: string | null;
    minSupply: number;
    minDemand: number;
    maxDaysAgo: number;
  };
  recommendations: TradeRecommendation[];
}

export interface AdminCreateKeyResponse {
  id: number;
  label: string;
  keyPrefix: string;
  keyFingerprint: string;
  createdAt: string;
  apiKey: string;
}

@Injectable({
  providedIn: 'root',
})
export class RealtimeStateService {
  readonly snapshot = signal<StateSnapshot | null>(null);
  readonly isConnected = signal<boolean>(false);
  readonly lastError = signal<string | null>(null);

  private socket: Socket | null = null;
  private readonly fallbackMissions: StateSnapshot['missions'] = {
    active: [],
    history: [],
    updatedAt: null,
  };
  private readonly fallbackColonization: StateSnapshot['colonization'] = {
    isColonizing: false,
    systemName: null,
    marketId: null,
    constructionProgress: null,
    constructionComplete: false,
    constructionFailed: false,
    requiredCommodities: [],
    updatedAt: null,
  };

  constructor(private readonly http: HttpClient) {}

  validateApiKey(apiKey: string): Observable<StateSnapshot> {
    return this.http.get<StateSnapshot>(`${this.getBackendUrl()}/api/state`, {
      headers: { 'x-api-key': apiKey.trim() },
    });
  }

  start(): void {
    if (!this.hasApiKey()) {
      this.lastError.set(null);
      this.snapshot.set(null);
      this.isConnected.set(false);
      return;
    }

    this.loadInitialState();
    if (!this.socket) {
      this.connectSocket();
    }
  }

  stop(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.isConnected.set(false);
  }

  hasApiKey(): boolean {
    return this.readStorage(BACKEND_API_KEY_STORAGE_KEY).length > 0;
  }

  setApiKey(apiKey: string): void {
    const normalized = apiKey.trim();
    if (!normalized) {
      return;
    }

    this.writeStorage(BACKEND_API_KEY_STORAGE_KEY, normalized);
  }

  clearApiKey(): void {
    this.stop();
    this.snapshot.set(null);
    this.lastError.set(null);

    try {
      localStorage.removeItem(BACKEND_API_KEY_STORAGE_KEY);
    } catch {
      // ignore storage errors
    }
  }

  private loadInitialState(): void {
    const apiKey = this.getApiKey();

    this.validateApiKey(apiKey).subscribe({
      next: (state) => {
        this.snapshot.set(this.normalizeSnapshot(state));
      },
      error: () => {
        this.lastError.set('No se pudo cargar el estado inicial del backend (revisa API key).');
      },
    });
  }

  private connectSocket(): void {
    const backendUrl = this.getBackendUrl();
    const apiKey = this.getApiKey();

    this.socket = io(backendUrl, {
      auth: { apiKey },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
    });

    this.socket.on('connect', () => {
      this.isConnected.set(true);
      this.lastError.set(null);
    });

    this.socket.on('disconnect', () => {
      this.isConnected.set(false);
    });

    this.socket.on('connect_error', () => {
      this.isConnected.set(false);
      this.lastError.set('No hay conexion realtime con el backend.');
    });

    this.socket.on('StateUpdated', (state: StateSnapshot) => {
      this.snapshot.set(this.normalizeSnapshot(state));
    });

    this.socket.on('MissionUpdated', (missions: StateSnapshot['missions']) => {
      const current = this.snapshot();
      if (!current) {
        return;
      }

      this.snapshot.set(
        this.normalizeSnapshot({
          ...current,
          missions,
        }),
      );
    });

    this.socket.on('ColonizationUpdated', (colonization: StateSnapshot['colonization']) => {
      const current = this.snapshot();
      if (!current) {
        return;
      }

      this.snapshot.set(
        this.normalizeSnapshot({
          ...current,
          colonization,
        }),
      );
    });
  }

  private normalizeSnapshot(state: StateSnapshot): StateSnapshot {
    const missions = (state as Partial<StateSnapshot>).missions ?? this.fallbackMissions;
    const colonization = (state as Partial<StateSnapshot>).colonization ?? this.fallbackColonization;

    return {
      ...state,
      missions: {
        updatedAt: missions.updatedAt ?? null,
        active: missions.active ?? [],
        history: missions.history ?? [],
      },
      colonization: {
        isColonizing: colonization.isColonizing ?? false,
        systemName: colonization.systemName ?? null,
        marketId: colonization.marketId ?? null,
        constructionProgress: colonization.constructionProgress ?? null,
        constructionComplete: colonization.constructionComplete ?? false,
        constructionFailed: colonization.constructionFailed ?? false,
        requiredCommodities: colonization.requiredCommodities ?? [],
        updatedAt: colonization.updatedAt ?? null,
      },
    };
  }

  uploadRoute(file: File, routeName?: string): Observable<RouteUploadResponse> {
    const body = new FormData();
    body.append('file', file);

    const trimmedRouteName = routeName?.trim();
    if (trimmedRouteName) {
      body.append('routeName', trimmedRouteName);
    }

    return this.http.post<RouteUploadResponse>(`${this.getBackendUrl()}/api/route/upload`, body, {
      headers: {
        'x-api-key': this.getApiKey(),
      },
    });
  }

  generateSpanshRoute(request: {
    sourceSystem: string;
    destinationSystem: string;
    jumpRange: number;
    efficiency: number;
    via?: string[];
  }): Observable<SpanshRouteResponse> {
    return this.http.post<SpanshRouteResponse>(`${this.getBackendUrl()}/api/route/spansh`, request, {
      headers: {
        'x-api-key': this.getApiKey(),
      },
    });
  }

  generateSpanshExactRoute(request: {
    sourceSystem: string;
    destinationSystem: string;
    shipBuild: string;
    cargo?: number;
    fuelReserveSize?: number;
    useSupercharge?: boolean;
    useInjections?: boolean;
    excludeSecondary?: boolean;
    refuelEveryScoopable?: boolean;
    isSupercharged?: boolean;
    algorithm?: 'optimistic' | 'guided' | 'fuel' | 'fuel_jumps' | 'pessimistic';
  }): Observable<SpanshRouteResponse> {
    return this.http.post<SpanshRouteResponse>(`${this.getBackendUrl()}/api/route/spansh/exact`, request, {
      headers: {
        'x-api-key': this.getApiKey(),
      },
    });
  }

  createApiKey(label: string, adminKey: string, apiKey?: string): Observable<AdminCreateKeyResponse> {
    const body: { label: string; apiKey?: string } = { label: label.trim() };
    const customApiKey = apiKey?.trim();
    if (customApiKey) {
      body.apiKey = customApiKey;
    }

    return this.http.post<AdminCreateKeyResponse>(`${this.getBackendUrl()}/api/admin/keys`, body, {
      headers: {
        'x-admin-key': adminKey.trim(),
      },
    });
  }

  searchCommodityMarkets(
    sourceSystem: string,
    commodity: string,
    limit = 8,
    minSupply = 1,
    maxDistance = 120,
  ): Observable<CommoditySearchResult> {
    const params = new URLSearchParams({
      sourceSystem: sourceSystem.trim(),
      commodity: commodity.trim(),
      limit: String(limit),
      minSupply: String(minSupply),
      maxDistance: String(maxDistance),
    });

    return this.http.get<CommoditySearchResult>(
      `${this.getBackendUrl()}/api/commodities/search?${params.toString()}`,
      {
        headers: {
          'x-api-key': this.getApiKey(),
        },
      },
    );
  }

  getTradeRecommendations(
    options: {
      topN?: number;
      minProfit?: number;
      maxDistance?: number;
      commodityId?: string;
      minSupply?: number;
      minDemand?: number;
      maxDaysAgo?: number;
      useFleetCarrier?: boolean;
      onlyStations?: boolean;
      includeFleetCarriers?: boolean;
    } = {},
  ): Observable<TradeRecommendationsResult> {
    const params = new URLSearchParams();

    if (typeof options.topN === 'number') {
      params.set('topN', String(options.topN));
    }

    if (typeof options.minProfit === 'number') {
      params.set('minProfit', String(options.minProfit));
    }

    if (typeof options.maxDistance === 'number') {
      params.set('maxDistance', String(options.maxDistance));
    }

    if (options.commodityId?.trim()) {
      params.set('commodityId', options.commodityId.trim());
    }

    if (typeof options.minSupply === 'number') {
      params.set('minSupply', String(options.minSupply));
    }

    if (typeof options.minDemand === 'number') {
      params.set('minDemand', String(options.minDemand));
    }

    if (typeof options.maxDaysAgo === 'number') {
      params.set('maxDaysAgo', String(options.maxDaysAgo));
    }

    if (typeof options.useFleetCarrier === 'boolean') {
      params.set('useFleetCarrier', String(options.useFleetCarrier));
    }

    if (typeof options.onlyStations === 'boolean') {
      params.set('onlyStations', String(options.onlyStations));
    }

    if (typeof options.includeFleetCarriers === 'boolean') {
      params.set('includeFleetCarriers', String(options.includeFleetCarriers));
    }

    return this.http.get<TradeRecommendationsResult>(
      `${this.getBackendUrl()}/api/trade/recommendations?${params.toString()}`,
      {
        headers: {
          'x-api-key': this.getApiKey(),
        },
      },
    );
  }

  getAdminKey(): string {
    const queryValue = this.readQueryParam('adminKey');
    if (queryValue) {
      this.writeStorage(BACKEND_ADMIN_KEY_STORAGE_KEY, queryValue);
      return queryValue;
    }

    return this.readStorage(BACKEND_ADMIN_KEY_STORAGE_KEY);
  }

  setAdminKey(adminKey: string): void {
    const normalized = adminKey.trim();
    if (!normalized) {
      return;
    }

    this.writeStorage(BACKEND_ADMIN_KEY_STORAGE_KEY, normalized);
  }

  private getBackendUrl(): string {
    const queryValue = this.readQueryParam('backendUrl');
    if (queryValue) {
      this.writeStorage(BACKEND_URL_STORAGE_KEY, queryValue);
      return queryValue;
    }

    const storedBackendUrl = this.readStorage(BACKEND_URL_STORAGE_KEY);
    if (storedBackendUrl) {
      return storedBackendUrl;
    }

    return DEFAULT_BACKEND_URL || window.location.origin;
  }

  private getApiKey(): string {
    return this.readStorage(BACKEND_API_KEY_STORAGE_KEY);
  }

  private readQueryParam(key: string): string {
    const value = new URLSearchParams(window.location.search).get(key);
    return value?.trim() || '';
  }

  private readStorage(key: string): string {
    try {
      return localStorage.getItem(key)?.trim() || '';
    } catch {
      return '';
    }
  }

  private writeStorage(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch {
      // ignore storage errors
    }
  }
}
