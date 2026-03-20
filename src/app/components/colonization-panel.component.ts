import { DatePipe, NgFor, NgIf } from '@angular/common';
import { Component, Input, inject } from '@angular/core';
import { CommoditySearchResult, RealtimeStateService } from '../realtime-state.service';
import { StateSnapshot } from '../state.types';

@Component({
  selector: 'app-colonization-panel',
  standalone: true,
  imports: [NgIf, NgFor, DatePipe],
  template: `
    <article class="panel" *ngIf="snapshot as snapshot">
      <header class="head">
        <h2>Colonization</h2>
        <p class="meta">Staging view for colonization logistics.</p>
      </header>

      <section class="block">
        <h3>Current Context</h3>
        <p><strong>System:</strong> {{ snapshot.location.starSystem ?? '-' }}</p>
        <p><strong>Station:</strong> {{ snapshot.location.stationName ?? '-' }}</p>
        <p>
          <strong>Updated:</strong>
          {{ snapshot.location.updatedAt ? (snapshot.location.updatedAt | date:'short') : '-' }}
        </p>
      </section>

      <section class="block">
        <h3>Colonization Required Commodities</h3>
        <p class="meta" *ngIf="snapshot.colonization.isColonizing; else notColonizingText">
          System under colonization: {{ snapshot.colonization.systemName ?? snapshot.location.starSystem ?? '-' }}
        </p>
        <ng-template #notColonizingText>
          <p class="meta">No active colonization detected for this commander.</p>
        </ng-template>

        <div class="table-wrap" *ngIf="snapshot.colonization.isColonizing && snapshot.colonization.requiredCommodities.length > 0; else noCommodityMissions">
          <table>
            <thead>
              <tr>
                <th>Commodity</th>
                <th>Required</th>
                <th>Provided</th>
                <th>Remaining</th>
                <th>Payment</th>
                <th>Search</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let need of snapshot.colonization.requiredCommodities">
                <td>{{ need.name }}</td>
                <td>{{ formatInteger(need.requiredAmount) }}</td>
                <td>{{ formatInteger(need.providedAmount) }}</td>
                <td>{{ formatInteger(need.remainingAmount) }}</td>
                <td>{{ formatCredits(need.payment) }}</td>
                <td>
                  <button
                    type="button"
                    class="search-btn"
                    [disabled]="isSearching(need.name)"
                    (click)="searchCommodityNeed(snapshot, need.name, need.remainingAmount)"
                  >
                    {{ isSearching(need.name) ? 'Searching...' : 'Search' }}
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <ng-template #noCommodityMissions>
          <p class="placeholder" *ngIf="snapshot.colonization.isColonizing">
            No required commodities found in colonization depot event.
          </p>
          <p class="placeholder" *ngIf="!snapshot.colonization.isColonizing">
            Start/track a colonization project to populate this section.
          </p>
        </ng-template>
        <p class="error" *ngIf="lastSearchError">{{ lastSearchError }}</p>
      </section>
    </article>

    <section class="modal-backdrop" *ngIf="modalResult" (click)="closeCommodityModal()">
      <article class="modal-card" (click)="$event.stopPropagation()">
        <header class="modal-head">
          <h3>Colonization Commodity Search</h3>
          <button type="button" class="close-btn" (click)="closeCommodityModal()">Close</button>
        </header>
        <p class="meta"><strong>Context:</strong> {{ modalMissionTitle }}</p>
        <p class="meta">
          <strong>Source:</strong> {{ modalResult.sourceSystem }} |
          <strong>Commodity:</strong> {{ modalResult.commodity }}
        </p>

        <div class="table-wrap" *ngIf="getMergedTopRows(modalResult).length > 0; else noRows">
          <table>
            <thead>
              <tr>
                <th>System</th>
                <th>Station</th>
                <th>
                  <button type="button" class="sort-btn" (click)="toggleSort('price')">
                    Coste {{ getSortLabel('price') }}
                  </button>
                </th>
                <th>
                  <button type="button" class="sort-btn" (click)="toggleSort('supply')">
                    Supply {{ getSortLabel('supply') }}
                  </button>
                </th>
                <th>
                  <button type="button" class="sort-btn" (click)="toggleSort('distanceLy')">
                    Distancia {{ getSortLabel('distanceLy') }}
                  </button>
                </th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let row of getSortedModalRows(modalResult)">
                <td>{{ row.systemName }}</td>
                <td>{{ row.stationName }}</td>
                <td>{{ formatCredits(row.price) }}</td>
                <td>{{ formatInteger(row.supply) }}</td>
                <td>{{ formatDistance(row.distanceLy) }}</td>
                <td>{{ row.updatedAt ? (row.updatedAt | date:'short') : '-' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <ng-template #noRows>
          <p class="placeholder">No market data for this commodity.</p>
        </ng-template>
      </article>
    </section>
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

    h3 {
      margin: 0 0 8px;
      font-size: 1.2rem;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }

    .block {
      margin-top: 10px;
      border: 3px solid var(--panel-border);
      padding: 10px;
      background: color-mix(in srgb, var(--panel-bg) 90%, #ffffff 10%);
    }

    .block p {
      margin: 4px 0;
      font-size: 1rem;
    }

    .meta {
      margin: 0;
      font-size: 0.95rem;
      opacity: 0.85;
    }

    .table-wrap {
      max-height: 380px;
      overflow: auto;
      border: 2px solid var(--panel-border);
      background: var(--table-bg);
      margin-top: 8px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.92rem;
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

    .placeholder {
      margin: 6px 0;
      font-size: 0.95rem;
      opacity: 0.85;
    }

    .search-btn {
      border: 2px solid var(--panel-border);
      background: var(--button-bg);
      color: var(--button-text);
      padding: 3px 8px;
      font-size: 0.82rem;
      font-weight: 700;
      cursor: pointer;
    }

    .error {
      margin: 8px 0 0;
      color: var(--error-color);
      font-size: 0.9rem;
      font-weight: 700;
    }

    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.48);
      display: grid;
      place-items: center;
      padding: 16px;
      z-index: 45;
    }

    .modal-card {
      width: min(1100px, 100%);
      max-height: 82vh;
      overflow: auto;
      border: 5px solid var(--panel-border);
      background: var(--panel-bg);
      padding: 12px;
      box-sizing: border-box;
    }

    .modal-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      margin-bottom: 8px;
    }

    .close-btn {
      border: 2px solid var(--panel-border);
      background: var(--button-bg);
      color: var(--button-text);
      padding: 4px 10px;
      font-weight: 700;
      cursor: pointer;
    }

    .sort-btn {
      border: 0;
      background: transparent;
      color: inherit;
      font: inherit;
      font-weight: 700;
      cursor: pointer;
      padding: 0;
    }
  `,
})
export class ColonizationPanelComponent {
  @Input({ required: true }) snapshot!: StateSnapshot;

  private readonly state = inject(RealtimeStateService);
  private searchingCommodityKeys = new Set<string>();

  modalResult: CommoditySearchResult | null = null;
  modalMissionTitle = '';
  lastSearchError: string | null = null;
  sortField: 'price' | 'distanceLy' | 'supply' = 'price';
  sortDirection: 'asc' | 'desc' = 'asc';

  formatCredits(value: number | null): string {
    if (value === null || Number.isNaN(value)) {
      return '-';
    }

    return `${Math.round(value).toLocaleString('en-US')} CR`;
  }

  isSearching(commodity: string): boolean {
    return this.searchingCommodityKeys.has(commodity.toLowerCase());
  }

  searchCommodityNeed(snapshot: StateSnapshot, commodityName: string, remainingAmount: number | null): void {
    const sourceSystem = snapshot.colonization.systemName?.trim() || snapshot.location.starSystem?.trim() || '';
    const commodity = commodityName?.trim() || '';
    const minSupply = remainingAmount && remainingAmount > 0 ? remainingAmount : 1;
    const searchKey = commodity.toLowerCase();

    if (!sourceSystem || !commodity) {
      this.lastSearchError = 'Missing source system or commodity for this mission.';
      return;
    }

    this.lastSearchError = null;
    this.searchingCommodityKeys.add(searchKey);
    this.state.searchCommodityMarkets(sourceSystem, commodity, 8, minSupply).subscribe({
      next: (result) => {
        this.modalResult = result;
        this.modalMissionTitle = `Need ${commodity} (${Math.max(1, minSupply)} units)`;
        this.searchingCommodityKeys.delete(searchKey);
      },
      error: () => {
        this.lastSearchError = 'Commodity search failed.';
        this.searchingCommodityKeys.delete(searchKey);
      },
    });
  }

  closeCommodityModal(): void {
    this.modalResult = null;
    this.modalMissionTitle = '';
  }

  toggleSort(field: 'price' | 'distanceLy' | 'supply'): void {
    if (this.sortField === field) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
      return;
    }

    this.sortField = field;
    this.sortDirection = 'asc';
  }

  getSortLabel(field: 'price' | 'distanceLy' | 'supply'): string {
    if (this.sortField !== field) {
      return '';
    }

    return this.sortDirection === 'asc' ? '↑' : '↓';
  }

  getSortedModalRows(result: CommoditySearchResult): Array<{
    systemName: string;
    stationName: string;
    price: number | null;
    supply: number | null;
    distanceLy: number | null;
    updatedAt: string | null;
  }> {
    const rows = this.getMergedTopRows(result);
    const direction = this.sortDirection === 'asc' ? 1 : -1;

    return [...rows].sort((left, right) => {
      const a = left[this.sortField];
      const b = right[this.sortField];

      if (a === null && b === null) {
        return 0;
      }

      if (a === null) {
        return 1;
      }

      if (b === null) {
        return -1;
      }

      return (a - b) * direction;
    });
  }

  getMergedTopRows(result: CommoditySearchResult): Array<{
    systemName: string;
    stationName: string;
    price: number | null;
    supply: number | null;
    distanceLy: number | null;
    updatedAt: string | null;
  }> {
    const rows = new Map<string, {
      systemName: string;
      stationName: string;
      price: number | null;
      supply: number | null;
      distanceLy: number | null;
      updatedAt: string | null;
    }>();

    const add = (source: (typeof result.cheapest)[number] | undefined): void => {
      if (!source) {
        return;
      }

      const key = `${source.marketId ?? 'x'}|${source.systemName}|${source.stationName}`;
      if (rows.has(key)) {
        return;
      }

      rows.set(key, {
        systemName: source.systemName,
        stationName: source.stationName,
        price: source.price,
        supply: source.supply,
        distanceLy: source.distanceLy,
        updatedAt: source.updatedAt,
      });
    };

    for (const row of result.cheapest.slice(0, 6)) {
      add(row);
    }

    for (const row of result.nearest.slice(0, 6)) {
      add(row);
    }

    return [...rows.values()].slice(0, 6);
  }

  formatDistance(value: number | null): string {
    if (value === null || Number.isNaN(value)) {
      return '-';
    }

    return `${value.toFixed(1)} ly`;
  }

  formatInteger(value: number | null): string {
    if (value === null || Number.isNaN(value)) {
      return '-';
    }

    return Math.round(value).toLocaleString('en-US');
  }
}
