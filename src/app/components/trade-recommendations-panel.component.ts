import { DecimalPipe, NgFor, NgIf } from '@angular/common';
import { Component, Input, OnChanges, SimpleChanges, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  RealtimeStateService,
  TradeRecommendation,
  TradeRecommendationsResult,
} from '../realtime-state.service';
import { StateSnapshot } from '../state.types';

interface SystemTradeTotal {
  systemName: string;
  routes: number;
  totalProfitPerUnit: number;
  totalPotentialProfit: number;
}

@Component({
  selector: 'app-trade-recommendations-panel',
  standalone: true,
  imports: [NgIf, NgFor, DecimalPipe, FormsModule],
  template: `
    <article class="panel" *ngIf="snapshot as snapshot">
      <header class="head">
        <h2>Trade Recommendations</h2>
        <p class="meta">Best buy/sell routes by profit, volume and distance.</p>
      </header>

      <section class="filters">
        <label>
          Commodity
          <input type="text" [(ngModel)]="commodityId" placeholder="Required (e.g. gold)" />
        </label>
        <label>
          Top N
          <input type="number" [(ngModel)]="topN" min="1" max="100" />
        </label>
        <label>
          Min Profit
          <input type="number" [(ngModel)]="minProfit" min="1" />
        </label>
        <label>
          Max Distance
          <input type="number" [(ngModel)]="maxDistance" min="1" max="500" [disabled]="useFleetCarrier" />
        </label>
        <label>
          Min Supply
          <input type="number" [(ngModel)]="minSupply" min="1" />
        </label>
        <label>
          Min Demand
          <input type="number" [(ngModel)]="minDemand" min="1" />
        </label>
        <label class="checkbox-field">
          <input type="checkbox" [(ngModel)]="useFleetCarrier" />
          Use Fleet Carrier Mode (500 ly)
        </label>
        <label class="checkbox-field">
          <input type="checkbox" [(ngModel)]="onlyStations" />
          Only Stations (No Planets)
        </label>
        <button type="button" (click)="loadRecommendations(snapshot)" [disabled]="loading">
          {{ loading ? 'Loading...' : 'Search Routes' }}
        </button>
      </section>

      <p class="error" *ngIf="errorMessage">{{ errorMessage }}</p>

      <div class="table-wrap" *ngIf="result?.recommendations?.length; else noResults">
        <table>
          <thead>
            <tr>
              <th>Commodity</th>
              <th>Origin</th>
              <th>Destination</th>
              <th>Buy</th>
              <th>Sell</th>
              <th>Profit/u</th>
              <th>Distance</th>
              <th>Supply</th>
              <th>Demand</th>
              <th>Volume</th>
              <th>Score</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let row of (result?.recommendations || [])">
              <td>{{ row.commodityName }}</td>
              <td>{{ row.origin.systemName }} / {{ row.origin.stationName }}</td>
              <td>{{ row.destination.systemName }} / {{ row.destination.stationName }}</td>
              <td>{{ formatCredits(row.buyPrice) }}</td>
              <td>{{ formatCredits(row.sellPrice) }}</td>
              <td>{{ formatCredits(row.profitPerUnit) }}</td>
              <td>{{ row.distanceLy === null ? '-' : (row.distanceLy | number:'1.0-1') + ' ly' }}</td>
              <td>{{ row.sourceSupply | number:'1.0-0' }}</td>
              <td>{{ row.destinationDemand | number:'1.0-0' }}</td>
              <td>{{ row.estimatedVolume | number:'1.0-0' }}</td>
              <td>{{ row.score | number:'1.0-0' }}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <th colspan="3">System (Destination)</th>
              <th colspan="2">Routes</th>
              <th colspan="3">Total Profit/u</th>
              <th colspan="3">Total Potential Profit</th>
            </tr>
            <tr *ngFor="let total of getTotalsByDestinationSystem(result?.recommendations || [])">
              <th colspan="3">{{ total.systemName }}</th>
              <th colspan="2">{{ total.routes | number:'1.0-0' }}</th>
              <th colspan="3">{{ formatCredits(total.totalProfitPerUnit) }}</th>
              <th colspan="3">{{ formatCredits(total.totalPotentialProfit) }}</th>
            </tr>
          </tfoot>
        </table>
      </div>

      <ng-template #noResults>
        <p class="placeholder" *ngIf="!loading">
          {{ result ? 'No recommendations found with current filters.' : 'Run a search to load trading routes.' }}
        </p>
      </ng-template>
    </article>
  `,
  styles: `
    .panel {
      background: var(--panel-bg);
      border: 5px solid var(--panel-border);
      padding: 14px;
      box-sizing: border-box;
    }

    .head {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 10px;
      flex-wrap: wrap;
      margin-bottom: 10px;
    }

    h2 {
      margin: 0;
      font-size: 1.8rem;
      text-transform: uppercase;
      letter-spacing: 0.4px;
    }

    .meta {
      margin: 0;
      font-size: 0.95rem;
      opacity: 0.85;
    }

    .filters {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 8px;
      border: 3px solid var(--panel-border);
      padding: 10px;
      background: color-mix(in srgb, var(--panel-bg) 90%, #ffffff 10%);
      margin-bottom: 10px;
    }

    .filters label {
      display: grid;
      gap: 4px;
      font-size: 0.85rem;
      font-weight: 700;
      text-transform: uppercase;
    }

    .filters .checkbox-field {
      display: flex;
      align-items: center;
      gap: 8px;
      text-transform: none;
      font-weight: 700;
      font-size: 0.88rem;
      padding-top: 18px;
    }

    .filters input {
      border: 2px solid var(--panel-border);
      background: var(--table-bg);
      color: var(--app-text);
      padding: 4px 6px;
      font-size: 0.92rem;
      box-sizing: border-box;
    }

    .filters button {
      align-self: end;
      border: 3px solid var(--panel-border);
      background: var(--button-bg);
      color: var(--button-text);
      padding: 6px 10px;
      font-size: 0.9rem;
      font-weight: 700;
      cursor: pointer;
    }

    .table-wrap {
      max-height: 60vh;
      overflow: auto;
      border: 2px solid var(--panel-border);
      background: var(--table-bg);
    }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.88rem;
    }

    th,
    td {
      border: 1px solid var(--table-border);
      padding: 6px 8px;
      text-align: left;
      white-space: nowrap;
    }

    th {
      position: sticky;
      top: 0;
      background: var(--table-head-bg);
      z-index: 1;
    }

    tfoot th {
      position: sticky;
      bottom: 0;
      background: var(--table-head-bg);
      z-index: 1;
    }

    .error {
      margin: 0 0 8px;
      color: var(--error-color);
      font-size: 0.92rem;
      font-weight: 700;
    }

    .placeholder {
      margin: 6px 0 0;
      font-size: 0.95rem;
      opacity: 0.85;
    }
  `,
})
export class TradeRecommendationsPanelComponent implements OnChanges {
  @Input() snapshot!: StateSnapshot;

  private readonly state = inject(RealtimeStateService);

  commodityId = '';
  topN = 25;
  minProfit = 1;
  maxDistance = 120;
  minSupply = 1;
  minDemand = 1;
  useFleetCarrier = false;
  onlyStations = false;

  loading = false;
  errorMessage: string | null = null;
  result: TradeRecommendationsResult | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    void changes;
  }

  loadRecommendations(snapshot: StateSnapshot): void {
    void snapshot;
    const commodityId = this.commodityId.trim();
    if (!commodityId) {
      this.errorMessage = 'Commodity is required.';
      return;
    }

    this.loading = true;
    this.errorMessage = null;

    this.state
      .getTradeRecommendations({
        topN: this.topN,
        minProfit: this.minProfit,
        maxDistance: this.useFleetCarrier ? 500 : this.maxDistance,
        commodityId,
        minSupply: this.minSupply,
        minDemand: this.minDemand,
        useFleetCarrier: this.useFleetCarrier,
        onlyStations: this.onlyStations,
      })
      .subscribe({
        next: (result) => {
          this.result = result;
          this.loading = false;
        },
        error: () => {
          this.errorMessage = 'Trade recommendations request failed.';
          this.loading = false;
        },
      });
  }

  formatCredits(value: number | null): string {
    if (value === null || !Number.isFinite(value)) {
      return '-';
    }

    return `${Math.round(value).toLocaleString('en-US')} CR`;
  }

  getTotalsByDestinationSystem(rows: TradeRecommendation[]): SystemTradeTotal[] {
    const grouped = new Map<string, SystemTradeTotal>();
    for (const row of rows) {
      const systemName = row.destination.systemName?.trim() || 'Unknown';
      const current = grouped.get(systemName) ?? {
        systemName,
        routes: 0,
        totalProfitPerUnit: 0,
        totalPotentialProfit: 0,
      };

      const profitPerUnit = Number.isFinite(row.profitPerUnit) ? row.profitPerUnit : 0;
      const volume = Number.isFinite(row.estimatedVolume) ? row.estimatedVolume : 0;
      current.routes += 1;
      current.totalProfitPerUnit += profitPerUnit;
      current.totalPotentialProfit += (profitPerUnit * volume);

      grouped.set(systemName, current);
    }

    return [...grouped.values()].sort((left, right) => {
      if (right.totalPotentialProfit !== left.totalPotentialProfit) {
        return right.totalPotentialProfit - left.totalPotentialProfit;
      }

      return right.totalProfitPerUnit - left.totalProfitPerUnit;
    });
  }
}
