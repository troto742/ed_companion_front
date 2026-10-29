import { DecimalPipe, NgFor, NgIf } from '@angular/common';
import { Component, Input, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  CommoditySearchStation,
  RealtimeStateService,
  TradeRecommendation,
  TradeRecommendationsResult,
} from '../realtime-state.service';
import { StateSnapshot } from '../state.types';

interface CarrierCommodity {
  id: string;
  name: string;
  amount: number;
  targetAmount: number;
  buyPrice: number | null;
  sellPrice: number | null;
}

interface CarrierProfile {
  displayName: string;
  callsign: string;
  cargoCapacity: number;
  tritiumReserve: number;
}

interface TritiumStopPlan {
  type: 'buy' | 'mine';
  systemName: string;
  stationName: string;
  tons: number;
  unitPrice: number | null;
  distanceLy: number | null;
  note: string;
}

interface FcRoutePlan {
  origin: string;
  destination: string;
  estimatedJumps: number;
  tritiumRequired: number;
  tritiumReserve: number;
  tritiumDeficit: number;
  cargoFreeBeforeBuying: number;
  stops: TritiumStopPlan[];
  bestRouteLabel: string;
}

const CARRIER_STORAGE_KEY = 'elite-companion-fleet-carrier';
const DEFAULT_CARRIER_CAPACITY = 25000;
const DEFAULT_CARRIER_JUMP_RANGE = 500;
const ESTIMATED_TRITIUM_PER_JUMP = 135;

@Component({
  selector: 'app-fleet-carrier-management',
  standalone: true,
  imports: [NgIf, NgFor, FormsModule, DecimalPipe],
  template: `
    <article class="carrier-shell" *ngIf="snapshot as snapshot">
      <header class="carrier-header">
        <section>
          <p class="eyebrow">Fleet Carrier Management</p>
          <h2>{{ getCarrierTitle(snapshot) }}</h2>
          <p class="meta">
            Current system: {{ snapshot.location.starSystem || 'Unknown' }}
            <span *ngIf="snapshot.location.fleetCarrier">/ Docked at {{ snapshot.location.fleetCarrier }}</span>
          </p>
        </section>
        <section class="status-strip" aria-label="Carrier cargo summary">
          <span>
            <strong>{{ getUsedCargo() | number:'1.0-0' }}</strong>
            used
          </span>
          <span>
            <strong>{{ getFreeCargo() | number:'1.0-0' }}</strong>
            free
          </span>
          <span>
            <strong>{{ profile.tritiumReserve | number:'1.0-0' }}</strong>
            tritium
          </span>
        </section>
      </header>

      <section class="carrier-grid">
        <section class="panel profile-panel">
          <div class="section-head">
            <h3>Carrier</h3>
            <button type="button" (click)="saveCarrierState()">Save</button>
          </div>
          <div class="form-grid two">
            <label>
              Name
              <input type="text" [(ngModel)]="profile.displayName" placeholder="Carrier name" />
            </label>
            <label>
              Callsign
              <input type="text" [(ngModel)]="profile.callsign" placeholder="ABC-123" />
            </label>
            <label>
              Cargo Capacity
              <input type="number" min="0" step="100" [(ngModel)]="profile.cargoCapacity" />
            </label>
            <label>
              Tritium Reserve
              <input type="number" min="0" step="1" [(ngModel)]="profile.tritiumReserve" />
            </label>
          </div>
          <div class="cargo-bar" aria-label="Carrier cargo usage">
            <span [style.width.%]="getCargoUsagePercent()"></span>
          </div>
        </section>

        <section class="panel route-panel">
          <div class="section-head">
            <h3>FC Route Planner</h3>
            <div class="button-row">
              <button type="button" (click)="searchBestFcRoute(snapshot)" [disabled]="loadingRoutePlan">
                {{ loadingRoutePlan ? 'Searching...' : 'Search' }}
              </button>
              <button type="button" (click)="copyRouteSummary()">Copy</button>
            </div>
          </div>
          <div class="form-grid">
            <label>
              Origin
              <input
                type="text"
                [(ngModel)]="routeOrigin"
                [placeholder]="snapshot.location.starSystem || 'Origin system'"
              />
            </label>
            <label>
              Destination
              <input type="text" [(ngModel)]="routeDestination" placeholder="Destination system" />
            </label>
            <label>
              Distance LY
              <input type="number" min="0" step="0.1" [(ngModel)]="routeDistanceLy" />
            </label>
            <label>
              Jump Range
              <input type="number" min="1" max="500" step="1" [(ngModel)]="carrierJumpRange" />
            </label>
          </div>
          <div class="route-summary">
            <span>
              <strong>{{ getEstimatedJumps() }}</strong>
              jumps
            </span>
            <span>
              <strong>{{ getTritiumBudget() | number:'1.0-0' }}</strong>
              tritium est.
            </span>
            <span>
              <strong>{{ getRouteCargoLoad() | number:'1.0-0' }}</strong>
              tons loaded
            </span>
          </div>
          <section class="best-route" *ngIf="fcRoutePlan as plan">
            <div class="best-route-head">
              <h4>Best Route</h4>
              <span [class.warning]="plan.tritiumDeficit > 0">
                {{ plan.tritiumDeficit > 0 ? (plan.tritiumDeficit | number:'1.0-0') + ' tritium missing' : 'Fuel covered' }}
              </span>
            </div>
            <p class="best-route-line">{{ plan.bestRouteLabel }}</p>
            <div class="route-summary compact-summary">
              <span>
                <strong>{{ plan.estimatedJumps }}</strong>
                jumps
              </span>
              <span>
                <strong>{{ plan.tritiumRequired | number:'1.0-0' }}</strong>
                required
              </span>
              <span>
                <strong>{{ plan.tritiumReserve | number:'1.0-0' }}</strong>
                reserve
              </span>
              <span>
                <strong>{{ plan.cargoFreeBeforeBuying | number:'1.0-0' }}</strong>
                cargo free
              </span>
            </div>
            <div class="plan-stops" *ngIf="plan.stops.length > 0; else directRoute">
              <article class="plan-stop" *ngFor="let stop of plan.stops">
                <span class="stop-type">{{ stop.type === 'buy' ? 'Buy Tritium' : 'Mine Tritium' }}</span>
                <strong>{{ stop.systemName }}</strong>
                <span>{{ stop.stationName }}</span>
                <span>{{ stop.tons | number:'1.0-0' }} t</span>
                <span>{{ stop.unitPrice === null ? '-' : formatCredits(stop.unitPrice) }}</span>
                <span>{{ stop.distanceLy === null ? 'distance n/a' : (stop.distanceLy | number:'1.0-1') + ' ly' }}</span>
                <p>{{ stop.note }}</p>
              </article>
            </div>
            <ng-template #directRoute>
              <p class="placeholder">Reserve is enough for a direct carrier route.</p>
            </ng-template>
          </section>
          <p class="helper" *ngIf="routeMessage">{{ routeMessage }}</p>
        </section>
      </section>

      <section class="panel inventory-panel">
        <div class="section-head">
          <h3>Commodities</h3>
          <button type="button" (click)="addCommodity()">Add Commodity</button>
        </div>

        <div class="table-wrap" *ngIf="commodities.length > 0; else emptyInventory">
          <table>
            <thead>
              <tr>
                <th>Commodity</th>
                <th>Stored</th>
                <th>Target</th>
                <th>Delta</th>
                <th>Buy</th>
                <th>Sell</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let commodity of commodities; trackBy: trackCommodity">
                <td>
                  <input type="text" [(ngModel)]="commodity.name" (ngModelChange)="saveCarrierState()" />
                </td>
                <td>
                  <input type="number" min="0" step="1" [(ngModel)]="commodity.amount" (ngModelChange)="saveCarrierState()" />
                </td>
                <td>
                  <input type="number" min="0" step="1" [(ngModel)]="commodity.targetAmount" (ngModelChange)="saveCarrierState()" />
                </td>
                <td [class.negative]="getCommodityDelta(commodity) < 0">
                  {{ getCommodityDelta(commodity) | number:'1.0-0' }}
                </td>
                <td>
                  <input type="number" min="0" step="1" [(ngModel)]="commodity.buyPrice" (ngModelChange)="saveCarrierState()" />
                </td>
                <td>
                  <input type="number" min="0" step="1" [(ngModel)]="commodity.sellPrice" (ngModelChange)="saveCarrierState()" />
                </td>
                <td>
                  <button type="button" class="danger" (click)="removeCommodity(commodity.id)">Remove</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <ng-template #emptyInventory>
          <p class="placeholder">No carrier commodities tracked yet.</p>
        </ng-template>
      </section>

      <section class="panel trade-panel">
        <div class="section-head">
          <h3>Carrier Trade Plan</h3>
          <button type="button" (click)="loadCarrierTrades(snapshot)" [disabled]="loadingTrades">
            {{ loadingTrades ? 'Searching...' : 'Search' }}
          </button>
        </div>
        <div class="form-grid trade-form">
          <label>
            Commodity
            <input type="text" [(ngModel)]="tradeCommodity" placeholder="gold, tritium, silver..." />
          </label>
          <label>
            Min Profit
            <input type="number" min="1" step="100" [(ngModel)]="tradeMinProfit" />
          </label>
          <label>
            Min Supply
            <input type="number" min="1" step="100" [(ngModel)]="tradeMinSupply" />
          </label>
          <label>
            Min Demand
            <input type="number" min="1" step="100" [(ngModel)]="tradeMinDemand" />
          </label>
        </div>
        <p class="error" *ngIf="tradeError">{{ tradeError }}</p>

        <div class="trade-results" *ngIf="tradeResult?.recommendations?.length; else noTrades">
          <button
            type="button"
            class="trade-card"
            *ngFor="let row of tradeResult?.recommendations || []"
            (click)="useTradeAsRoute(row, snapshot)"
          >
            <span>
              <strong>{{ row.origin.systemName }}</strong>
              {{ row.origin.stationName }}
            </span>
            <span>
              <strong>{{ row.destination.systemName }}</strong>
              {{ row.destination.stationName }}
            </span>
            <span>{{ formatCredits(row.profitPerUnit) }}/u</span>
            <span>{{ row.distanceLy === null ? 'Distance n/a' : (row.distanceLy | number:'1.0-1') + ' ly' }}</span>
          </button>
        </div>
        <ng-template #noTrades>
          <p class="placeholder" *ngIf="!loadingTrades">
            Search a commodity to build a carrier-scale buy/sell route.
          </p>
        </ng-template>
      </section>
    </article>
  `,
  styles: `
    .carrier-shell {
      display: grid;
      gap: 12px;
    }

    .carrier-header,
    .panel {
      border: 1px solid color-mix(in srgb, var(--panel-border) 55%, transparent);
      background: color-mix(in srgb, var(--panel-bg) 96%, #ffffff 4%);
      padding: 16px;
      box-sizing: border-box;
    }

    .carrier-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      gap: 16px;
      flex-wrap: wrap;
    }

    .eyebrow,
    .meta,
    .helper,
    .placeholder {
      margin: 0;
      opacity: 0.78;
    }

    .eyebrow {
      text-transform: uppercase;
      font-size: 0.78rem;
      font-weight: 700;
    }

    h2,
    h3 {
      margin: 0;
      text-transform: uppercase;
      letter-spacing: 0;
    }

    h2 {
      font-size: 2rem;
    }

    h3 {
      font-size: 1.05rem;
    }

    .status-strip,
    .route-summary {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }

    .status-strip span,
    .route-summary span {
      border: 1px solid color-mix(in srgb, var(--panel-border) 50%, transparent);
      padding: 8px 10px;
      min-width: 104px;
      background: var(--table-bg);
    }

    .status-strip strong,
    .route-summary strong {
      display: block;
      font-size: 1.25rem;
    }

    .best-route {
      display: grid;
      gap: 10px;
      margin-top: 12px;
      padding: 12px;
      border: 1px solid color-mix(in srgb, var(--panel-border) 42%, transparent);
      background: var(--table-bg);
    }

    .best-route-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      flex-wrap: wrap;
    }

    h4 {
      margin: 0;
      font-size: 0.95rem;
      text-transform: uppercase;
    }

    .best-route-head span {
      font-weight: 700;
    }

    .warning {
      color: var(--error-color);
    }

    .best-route-line {
      margin: 0;
      font-size: 1.05rem;
      font-weight: 700;
      overflow-wrap: anywhere;
    }

    .compact-summary span {
      min-width: 96px;
    }

    .plan-stops {
      display: grid;
      gap: 8px;
    }

    .plan-stop {
      display: grid;
      grid-template-columns: 0.8fr 1fr 1.2fr 0.5fr 0.7fr 0.7fr;
      gap: 8px;
      align-items: center;
      padding: 9px;
      border: 1px solid color-mix(in srgb, var(--panel-border) 30%, transparent);
    }

    .plan-stop p {
      grid-column: 1 / -1;
      margin: 0;
      opacity: 0.78;
    }

    .stop-type {
      font-weight: 700;
      text-transform: uppercase;
      font-size: 0.78rem;
    }

    .carrier-grid {
      display: grid;
      grid-template-columns: minmax(280px, 0.8fr) minmax(360px, 1.2fr);
      gap: 12px;
    }

    .section-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      margin-bottom: 12px;
    }

    .button-row {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      justify-content: flex-end;
    }

    .form-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(140px, 1fr));
      gap: 10px;
    }

    .form-grid.two {
      grid-template-columns: repeat(2, minmax(140px, 1fr));
    }

    label {
      display: grid;
      gap: 5px;
      font-size: 0.82rem;
      font-weight: 700;
      text-transform: uppercase;
    }

    input {
      width: 100%;
      border: 1px solid color-mix(in srgb, var(--panel-border) 70%, transparent);
      background: var(--table-bg);
      color: var(--app-text);
      padding: 8px 9px;
      font: inherit;
      box-sizing: border-box;
    }

    button {
      border: 1px solid color-mix(in srgb, var(--panel-border) 70%, transparent);
      background: var(--button-bg);
      color: var(--button-text);
      padding: 8px 11px;
      font: inherit;
      font-weight: 700;
      cursor: pointer;
    }

    button:disabled {
      opacity: 0.6;
      cursor: default;
    }

    .danger {
      color: var(--error-color);
    }

    .cargo-bar {
      height: 12px;
      margin-top: 14px;
      background: var(--meter-bg);
      overflow: hidden;
    }

    .cargo-bar span {
      display: block;
      height: 100%;
      background: var(--meter-fill);
    }

    .table-wrap {
      overflow: auto;
      max-height: 42vh;
      border: 1px solid color-mix(in srgb, var(--panel-border) 55%, transparent);
    }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.9rem;
    }

    th,
    td {
      border-bottom: 1px solid var(--table-border);
      padding: 7px;
      text-align: left;
      white-space: nowrap;
    }

    th {
      position: sticky;
      top: 0;
      background: var(--table-head-bg);
      z-index: 1;
    }

    td input {
      min-width: 120px;
    }

    .negative {
      color: var(--error-color);
      font-weight: 700;
    }

    .trade-form {
      grid-template-columns: repeat(4, minmax(120px, 1fr));
      margin-bottom: 10px;
    }

    .trade-results {
      display: grid;
      gap: 8px;
    }

    .trade-card {
      display: grid;
      grid-template-columns: 1.2fr 1.2fr 0.6fr 0.6fr;
      gap: 10px;
      text-align: left;
      align-items: center;
    }

    .trade-card span {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .trade-card strong {
      display: block;
    }

    .error {
      color: var(--error-color);
      font-weight: 700;
      margin: 0 0 8px;
    }

    @media (max-width: 980px) {
      .carrier-grid,
      .form-grid,
      .form-grid.two,
      .trade-form,
      .trade-card,
      .plan-stop {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class FleetCarrierManagementComponent implements OnInit {
  @Input({ required: true }) snapshot!: StateSnapshot;

  private readonly state = inject(RealtimeStateService);

  profile: CarrierProfile = {
    displayName: '',
    callsign: '',
    cargoCapacity: DEFAULT_CARRIER_CAPACITY,
    tritiumReserve: 0,
  };
  commodities: CarrierCommodity[] = [];
  routeOrigin = '';
  routeDestination = '';
  routeDistanceLy = 0;
  carrierJumpRange = DEFAULT_CARRIER_JUMP_RANGE;
  routeMessage: string | null = null;
  loadingRoutePlan = false;
  fcRoutePlan: FcRoutePlan | null = null;
  tradeCommodity = 'tritium';
  tradeMinProfit = 1000;
  tradeMinSupply = 1000;
  tradeMinDemand = 1000;
  loadingTrades = false;
  tradeError: string | null = null;
  tradeResult: TradeRecommendationsResult | null = null;

  ngOnInit(): void {
    this.loadCarrierState();
  }

  getCarrierTitle(snapshot: StateSnapshot): string {
    const name = this.profile.displayName.trim() || snapshot.location.fleetCarrier || 'Unassigned Carrier';
    const callsign = this.profile.callsign.trim();
    return callsign ? `${name} (${callsign})` : name;
  }

  addCommodity(): void {
    this.commodities = [
      ...this.commodities,
      {
        id: `commodity-${Date.now()}`,
        name: '',
        amount: 0,
        targetAmount: 0,
        buyPrice: null,
        sellPrice: null,
      },
    ];
    this.saveCarrierState();
  }

  removeCommodity(id: string): void {
    this.commodities = this.commodities.filter((commodity) => commodity.id !== id);
    this.saveCarrierState();
  }

  trackCommodity(_index: number, commodity: CarrierCommodity): string {
    return commodity.id;
  }

  getUsedCargo(): number {
    return this.commodities.reduce((total, commodity) => total + this.toSafeNumber(commodity.amount), 0);
  }

  getFreeCargo(): number {
    return Math.max(0, this.toSafeNumber(this.profile.cargoCapacity) - this.getUsedCargo());
  }

  getCargoUsagePercent(): number {
    const capacity = this.toSafeNumber(this.profile.cargoCapacity);
    if (capacity <= 0) {
      return 0;
    }
    return Math.max(0, Math.min(100, (this.getUsedCargo() / capacity) * 100));
  }

  getCommodityDelta(commodity: CarrierCommodity): number {
    return this.toSafeNumber(commodity.amount) - this.toSafeNumber(commodity.targetAmount);
  }

  getEstimatedJumps(): number {
    const distance = this.toSafeNumber(this.routeDistanceLy);
    const jumpRange = Math.min(DEFAULT_CARRIER_JUMP_RANGE, Math.max(1, this.toSafeNumber(this.carrierJumpRange)));
    if (distance <= 0) {
      return 0;
    }
    return Math.ceil(distance / jumpRange);
  }

  getTritiumBudget(): number {
    return this.getEstimatedJumps() * ESTIMATED_TRITIUM_PER_JUMP;
  }

  getRouteCargoLoad(): number {
    return this.getUsedCargo();
  }

  loadCarrierTrades(snapshot: StateSnapshot): void {
    const commodity = this.tradeCommodity.trim();
    if (!commodity) {
      this.tradeError = 'Commodity is required.';
      return;
    }

    this.loadingTrades = true;
    this.tradeError = null;

    this.state.getTradeRecommendations({
      topN: 12,
      minProfit: this.tradeMinProfit,
      maxDistance: DEFAULT_CARRIER_JUMP_RANGE,
      commodityId: commodity,
      minSupply: this.tradeMinSupply,
      minDemand: this.tradeMinDemand,
      useFleetCarrier: true,
      includeFleetCarriers: true,
    }).subscribe({
      next: (result) => {
        this.tradeResult = result;
        this.routeOrigin = this.routeOrigin.trim() || snapshot.location.starSystem || result.sourceSystem || '';
        this.loadingTrades = false;
      },
      error: () => {
        this.tradeError = 'Carrier trade search failed.';
        this.loadingTrades = false;
      },
    });
  }

  searchBestFcRoute(snapshot: StateSnapshot): void {
    const origin = this.routeOrigin.trim() || snapshot.location.starSystem?.trim() || '';
    const destination = this.routeDestination.trim();

    if (!origin || !destination) {
      this.routeMessage = 'Origin and destination are required to search an FC route.';
      this.fcRoutePlan = null;
      return;
    }

    const estimatedJumps = this.getEstimatedJumps();
    if (estimatedJumps <= 0) {
      this.routeMessage = 'Distance LY must be greater than 0 to estimate carrier jumps.';
      this.fcRoutePlan = null;
      return;
    }

    this.routeOrigin = origin;
    this.loadingRoutePlan = true;
    this.routeMessage = null;

    this.state.searchCommodityMarkets(origin, 'tritium', 10, 1, DEFAULT_CARRIER_JUMP_RANGE).subscribe({
      next: (result) => {
        const stops = this.buildTritiumStops(result.cheapest, estimatedJumps);
        const tritiumRequired = this.getTritiumBudget();
        const tritiumReserve = this.toSafeNumber(this.profile.tritiumReserve);
        const tritiumDeficit = Math.max(0, tritiumRequired - tritiumReserve);

        this.fcRoutePlan = {
          origin,
          destination,
          estimatedJumps,
          tritiumRequired,
          tritiumReserve,
          tritiumDeficit,
          cargoFreeBeforeBuying: this.getFreeCargo(),
          stops,
          bestRouteLabel: this.buildBestRouteLabel(origin, destination, stops),
        };
        this.routeMessage = stops.length > 0
          ? 'Best route calculated with Tritium purchase/mining contingencies.'
          : 'Best route calculated. Current Tritium reserve covers the trip.';
        this.loadingRoutePlan = false;
      },
      error: () => {
        const tritiumRequired = this.getTritiumBudget();
        const tritiumReserve = this.toSafeNumber(this.profile.tritiumReserve);
        const tritiumDeficit = Math.max(0, tritiumRequired - tritiumReserve);
        const fallbackStop = this.buildMiningStop(tritiumDeficit);
        const stops = fallbackStop ? [fallbackStop] : [];

        this.fcRoutePlan = {
          origin,
          destination,
          estimatedJumps,
          tritiumRequired,
          tritiumReserve,
          tritiumDeficit,
          cargoFreeBeforeBuying: this.getFreeCargo(),
          stops,
          bestRouteLabel: this.buildBestRouteLabel(origin, destination, stops),
        };
        this.routeMessage = 'Tritium market search failed; route uses mining fallback only.';
        this.loadingRoutePlan = false;
      },
    });
  }

  useTradeAsRoute(row: TradeRecommendation, snapshot: StateSnapshot): void {
    this.routeOrigin = row.origin.systemName || snapshot.location.starSystem || '';
    this.routeDestination = row.destination.systemName || '';
    this.routeDistanceLy = row.distanceLy ?? this.routeDistanceLy;
    this.routeMessage = `${row.commodityName}: ${row.origin.stationName} to ${row.destination.stationName}, ${this.formatCredits(row.profitPerUnit)} per unit.`;
  }

  copyRouteSummary(): void {
    const origin = this.routeOrigin.trim() || 'Unknown origin';
    const destination = this.routeDestination.trim() || 'Unknown destination';
    const stopSummary = this.fcRoutePlan?.stops.length
      ? ` Stops: ${this.fcRoutePlan.stops
        .map((stop) => `${stop.type}:${stop.systemName} ${Math.round(stop.tons)}t`)
        .join(', ')}.`
      : '';
    const summary = `${origin} -> ${destination}: ${this.getEstimatedJumps()} FC jumps, ~${Math.round(this.getTritiumBudget())} tritium.${stopSummary}`;
    void this.copyToClipboard(summary)
      .then(() => {
        this.routeMessage = 'Route summary copied.';
      })
      .catch(() => {
        this.routeMessage = 'Could not copy route summary.';
      });
  }

  formatCredits(value: number | null): string {
    if (value === null || !Number.isFinite(value)) {
      return '-';
    }
    return `${Math.round(value).toLocaleString('en-US')} CR`;
  }

  saveCarrierState(): void {
    try {
      localStorage.setItem(CARRIER_STORAGE_KEY, JSON.stringify({
        profile: this.profile,
        commodities: this.commodities,
        routeOrigin: this.routeOrigin,
        routeDestination: this.routeDestination,
        routeDistanceLy: this.routeDistanceLy,
        carrierJumpRange: this.carrierJumpRange,
      }));
    } catch {
      // Local persistence is convenience-only.
    }
  }

  private loadCarrierState(): void {
    try {
      const raw = localStorage.getItem(CARRIER_STORAGE_KEY);
      if (!raw) {
        return;
      }

      const parsed = JSON.parse(raw) as Partial<{
        profile: Partial<CarrierProfile>;
        commodities: CarrierCommodity[];
        routeOrigin: string;
        routeDestination: string;
        routeDistanceLy: number;
        carrierJumpRange: number;
      }>;

      this.profile = {
        ...this.profile,
        ...(parsed.profile ?? {}),
      };
      this.commodities = Array.isArray(parsed.commodities)
        ? parsed.commodities.filter((commodity) => typeof commodity.id === 'string')
        : [];
      this.routeOrigin = typeof parsed.routeOrigin === 'string' ? parsed.routeOrigin : '';
      this.routeDestination = typeof parsed.routeDestination === 'string' ? parsed.routeDestination : '';
      this.routeDistanceLy = typeof parsed.routeDistanceLy === 'number' ? parsed.routeDistanceLy : 0;
      this.carrierJumpRange = typeof parsed.carrierJumpRange === 'number'
        ? parsed.carrierJumpRange
        : DEFAULT_CARRIER_JUMP_RANGE;
    } catch {
      this.commodities = [];
    }
  }

  private buildTritiumStops(markets: CommoditySearchStation[], estimatedJumps: number): TritiumStopPlan[] {
    const tritiumRequired = estimatedJumps * ESTIMATED_TRITIUM_PER_JUMP;
    const tritiumReserve = this.toSafeNumber(this.profile.tritiumReserve);
    let remainingDeficit = Math.max(0, tritiumRequired - tritiumReserve);
    let remainingCargo = this.getFreeCargo();

    if (remainingDeficit <= 0) {
      return [];
    }

    const stops: TritiumStopPlan[] = [];
    const sortedMarkets = [...markets]
      .filter((market) => this.toSafeNumber(market.supply) > 0)
      .sort((left, right) => {
        const leftPrice = left.price ?? Number.MAX_SAFE_INTEGER;
        const rightPrice = right.price ?? Number.MAX_SAFE_INTEGER;
        if (leftPrice !== rightPrice) {
          return leftPrice - rightPrice;
        }

        return (left.distanceLy ?? Number.MAX_SAFE_INTEGER) - (right.distanceLy ?? Number.MAX_SAFE_INTEGER);
      });

    for (const market of sortedMarkets) {
      if (remainingDeficit <= 0 || remainingCargo <= 0) {
        break;
      }

      const available = this.toSafeNumber(market.supply);
      const tons = Math.min(remainingDeficit, remainingCargo, available);
      if (tons <= 0) {
        continue;
      }

      stops.push({
        type: 'buy',
        systemName: market.systemName,
        stationName: market.stationName,
        tons,
        unitPrice: market.price,
        distanceLy: market.distanceLy,
        note: 'Prioritized by low Tritium price, available supply and carrier jump range from origin.',
      });

      remainingDeficit -= tons;
      remainingCargo -= tons;
    }

    const miningStop = this.buildMiningStop(remainingDeficit);
    if (miningStop) {
      stops.push(miningStop);
    }

    return stops;
  }

  private buildMiningStop(tonsNeeded: number): TritiumStopPlan | null {
    if (tonsNeeded <= 0) {
      return null;
    }

    return {
      type: 'mine',
      systemName: 'Nearest icy ring / Tritium hotspot',
      stationName: 'Mining contingency',
      tons: tonsNeeded,
      unitPrice: null,
      distanceLy: null,
      note: 'Not enough purchasable Tritium was found within the current constraints. Mine before continuing.',
    };
  }

  private buildBestRouteLabel(origin: string, destination: string, stops: TritiumStopPlan[]): string {
    return [
      origin,
      ...stops.map((stop) => stop.systemName),
      destination,
    ].join(' -> ');
  }

  private toSafeNumber(value: number | null | undefined): number {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? Math.max(0, numericValue) : 0;
  }

  private async copyToClipboard(value: string): Promise<void> {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return;
    }

    const textArea = document.createElement('textarea');
    textArea.value = value;
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
  }
}
