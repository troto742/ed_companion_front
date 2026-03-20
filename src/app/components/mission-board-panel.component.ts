import { DatePipe, NgFor, NgIf, SlicePipe } from '@angular/common';
import { Component, Input, inject } from '@angular/core';
import {
  CommoditySearchResult,
  RealtimeStateService,
} from '../realtime-state.service';
import { MissionState, StateSnapshot } from '../state.types';

@Component({
  selector: 'app-mission-board-panel',
  standalone: true,
  imports: [NgIf, NgFor, DatePipe, SlicePipe],
  template: `
    <article class="panel" *ngIf="snapshot as snapshot">
      <header class="board-head">
        <h2>Mission Board</h2>
        <p class="meta">
          Active: {{ snapshot.missions.active.length }} | History: {{ snapshot.missions.history.length }}
        </p>
      </header>

      <section class="mission-section">
        <h3>Ongoing Missions</h3>
        <div class="mission-grid" *ngIf="snapshot.missions.active.length > 0; else noActiveMissions">
          <article class="mission-card" *ngFor="let mission of snapshot.missions.active">
            <div class="mission-card-head">
              <strong>{{ getMissionTitle(mission) }}</strong>
              <span class="badge status-active">Active</span>
            </div>
            <p><strong>ID:</strong> {{ mission.missionId }}</p>
            <p><strong>Faction:</strong> {{ mission.faction ?? '-' }}</p>
            <p><strong>From:</strong> {{ mission.originSystem ?? '-' }} / {{ mission.originStation ?? '-' }}</p>
            <p><strong>To:</strong> {{ mission.destinationSystem ?? '-' }} / {{ mission.destinationStation ?? '-' }}</p>
            <p><strong>Target:</strong> {{ mission.targetFaction ?? mission.targetType ?? '-' }}</p>
            <p><strong>Cargo:</strong> {{ mission.commodity ?? '-' }} ({{ mission.commodityCount ?? 0 }})</p>
            <p><strong>Passengers:</strong> {{ mission.passengerCount ?? 0 }} {{ mission.passengerType ?? '' }}</p>
            <p><strong>Reward:</strong> {{ formatCredits(mission.reward) }}</p>
            <p><strong>Expires:</strong> {{ mission.expiry ? (mission.expiry | date:'medium') : '-' }}</p>
            <button
              type="button"
              class="search-btn"
              (click)="searchCommodityForMission(mission)"
              [disabled]="isSearching(mission.missionId)"
            >
              {{ isSearching(mission.missionId) ? 'Searching...' : 'Commodity Search' }}
            </button>
            <p class="error" *ngIf="searchErrors[mission.missionId]">{{ searchErrors[mission.missionId] }}</p>
          </article>
        </div>
      </section>

      <section class="mission-section">
        <h3>Recent Mission Results</h3>
        <div class="table-wrap" *ngIf="snapshot.missions.history.length > 0; else noMissionHistory">
          <table>
            <thead>
              <tr>
                <th>Status</th>
                <th>Mission</th>
                <th>ID</th>
                <th>Destination</th>
                <th>Reward</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let mission of snapshot.missions.history | slice:0:30">
                <td><span class="badge" [class]="'status-' + mission.status">{{ mission.status }}</span></td>
                <td>{{ getMissionTitle(mission) }}</td>
                <td>{{ mission.missionId }}</td>
                <td>{{ mission.destinationSystem ?? '-' }} / {{ mission.destinationStation ?? '-' }}</td>
                <td>{{ formatCredits(mission.reward) }}</td>
                <td>{{ mission.updatedAt | date:'short' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </article>

    <ng-template #noActiveMissions>
      <p class="placeholder">No active missions detected from journal yet.</p>
    </ng-template>

    <ng-template #noMissionHistory>
      <p class="placeholder">No mission completions/failures logged yet.</p>
    </ng-template>

    <section class="modal-backdrop" *ngIf="modalResult" (click)="closeCommodityModal()">
      <article class="modal-card" (click)="$event.stopPropagation()">
        <header class="modal-head">
          <h3>Commodity Search</h3>
          <button type="button" class="close-btn" (click)="closeCommodityModal()">Close</button>
        </header>
        <p class="meta"><strong>Mission:</strong> {{ modalMissionTitle }}</p>
        <p class="meta">
          <strong>Source:</strong> {{ modalResult.sourceSystem }} |
          <strong>Commodity:</strong> {{ modalResult.commodity }}
        </p>
        <div class="table-wrap" *ngIf="getMergedTopRows(modalResult).length > 0; else noMergedRows">
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
        <ng-template #noMergedRows>
          <p class="placeholder">No market data for this mission.</p>
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

    .board-head {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 10px;
      margin-bottom: 10px;
      flex-wrap: wrap;
    }

    h2 {
      margin: 0;
      font-size: 1.8rem;
      letter-spacing: 0.4px;
      font-weight: 700;
      text-transform: uppercase;
    }

    h3 {
      margin: 0 0 8px;
      font-size: 1.2rem;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .meta {
      margin: 0;
      font-size: 1rem;
      opacity: 0.85;
    }

    .mission-section {
      margin-top: 12px;
    }

    .mission-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(270px, 1fr));
      gap: 10px;
    }

    .mission-card {
      border: 3px solid var(--panel-border);
      background: color-mix(in srgb, var(--panel-bg) 88%, #ffffff 12%);
      padding: 10px;
    }

    .mission-card p {
      margin: 4px 0;
      font-size: 0.96rem;
    }

    .mission-card-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      margin-bottom: 6px;
    }

    .search-btn {
      border: 2px solid var(--panel-border);
      background: var(--button-bg);
      color: var(--button-text);
      padding: 4px 8px;
      font-size: 0.85rem;
      font-weight: 700;
      cursor: pointer;
      margin-top: 6px;
    }

    .error {
      margin: 6px 0 0;
      color: var(--error-color);
      font-size: 0.85rem;
      font-weight: 700;
    }

    .badge {
      border: 2px solid var(--panel-border);
      padding: 2px 8px;
      text-transform: uppercase;
      font-size: 0.78rem;
      font-weight: 700;
      letter-spacing: 0.3px;
      white-space: nowrap;
    }

    .status-active {
      background: #d5f7dc;
      color: #0a3d1b;
    }

    .status-completed {
      background: #d7ecff;
      color: #0b2f56;
    }

    .status-failed {
      background: #ffdfe1;
      color: #5a1317;
    }

    .status-abandoned {
      background: #f2e3cc;
      color: #583d15;
    }

    .table-wrap {
      max-height: 360px;
      overflow: auto;
      border: 3px solid var(--panel-border);
      background: var(--table-bg);
    }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.95rem;
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
      font-size: 1rem;
      opacity: 0.86;
    }

    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.48);
      display: grid;
      place-items: center;
      padding: 16px;
      z-index: 40;
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
export class MissionBoardPanelComponent {
  @Input({ required: true }) snapshot!: StateSnapshot;
  private readonly state = inject(RealtimeStateService);
  searchResults: Record<number, CommoditySearchResult> = {};
  searchErrors: Record<number, string> = {};
  private searchingMissionIds = new Set<number>();
  modalResult: CommoditySearchResult | null = null;
  modalMissionTitle = '';
  sortField: 'price' | 'distanceLy' | 'supply' = 'price';
  sortDirection: 'asc' | 'desc' = 'asc';

  getMissionTitle(mission: MissionState): string {
    const localized = mission.localizedName?.trim();
    if (localized) {
      return localized;
    }

    const rawName = mission.name?.trim();
    if (!rawName) {
      return 'Unknown mission';
    }

    const cleaned = rawName
      .replace(/^Mission_/i, '')
      .replace(/_name$/i, '')
      .replace(/_/g, ' ')
      .trim();

    if (!cleaned) {
      return rawName;
    }

    return cleaned
      .split(/\s+/)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  formatCredits(value: number | null): string {
    if (value === null || Number.isNaN(value)) {
      return '-';
    }

    return `${Math.round(value).toLocaleString('en-US')} CR`;
  }

  isSearching(missionId: number): boolean {
    return this.searchingMissionIds.has(missionId);
  }

  searchCommodityForMission(mission: MissionState): void {
    const sourceSystem = mission.originSystem?.trim() || this.snapshot.location.starSystem?.trim() || '';
    const commodity = mission.commodity?.trim() || this.deriveCommodityFromMissionTitle(mission) || '';
    const minSupply = mission.commodityCount && mission.commodityCount > 0 ? mission.commodityCount : 1;

    if (!sourceSystem || !commodity) {
      this.searchErrors[mission.missionId] =
        'Missing source system or commodity. Need MissionAccepted/CargoDepot data.';
      return;
    }

    this.searchErrors[mission.missionId] = '';
    this.searchingMissionIds.add(mission.missionId);
    this.state.searchCommodityMarkets(sourceSystem, commodity, 8, minSupply).subscribe({
      next: (result) => {
        this.searchResults[mission.missionId] = result;
        this.modalResult = result;
        this.modalMissionTitle = this.getMissionTitle(mission);
        this.searchingMissionIds.delete(mission.missionId);
      },
      error: () => {
        this.searchErrors[mission.missionId] = 'Commodity search failed.';
        this.searchingMissionIds.delete(mission.missionId);
      },
    });
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
    const directionMultiplier = this.sortDirection === 'asc' ? 1 : -1;

    return [...rows].sort((left, right) => {
      const leftValue = left[this.sortField];
      const rightValue = right[this.sortField];

      if (leftValue === null && rightValue === null) {
        return 0;
      }

      if (leftValue === null) {
        return 1;
      }

      if (rightValue === null) {
        return -1;
      }

      return (leftValue - rightValue) * directionMultiplier;
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

  private deriveCommodityFromMissionTitle(mission: MissionState): string {
    const title = (mission.localizedName?.trim() || mission.name?.trim() || '').replace(/\s+/g, ' ');
    if (!title) {
      return '';
    }

    const patterns = [
      /(?:source and return|mine|deliver|acquire)\s+\d+\s+units?\s+of\s+(.+)$/i,
      /(?:source and return|mine|deliver|acquire)\s+\d+\s+(.+)$/i,
    ];

    for (const pattern of patterns) {
      const match = title.match(pattern);
      const commodity = match?.[1]?.trim() || '';
      if (commodity) {
        return commodity;
      }
    }

    return '';
  }
}
