import { NgFor, NgIf } from '@angular/common';
import { Component, Input, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  RealtimeStateService,
  SpanshExobiologySystemCandidate,
} from '../realtime-state.service';
import { StateSnapshot } from '../state.types';

const STRATUM_TECTONICA_ATMOSPHERES = [
  'Hot thin Carbon dioxide',
  'Hot thin Sulphur dioxide',
  'Thin Carbon dioxide',
  'Thin Carbon dioxide-rich',
  'Thin Sulphur dioxide',
  'Thin Water',
  'Thin Water-rich',
  'Thin Oxygen',
  'Thin Ammonia',
  'Thin Ammonia and Oxygen',
  'Thin Ammonia-rich',
];

const STRATUM_TECTONICA_SUBTYPES = ['High metal content world'];

@Component({
  selector: 'app-exobiology-route-panel',
  standalone: true,
  imports: [NgIf, NgFor, FormsModule],
  template: `
    <article class="panel compact" *ngIf="snapshot as snapshot">
      <div class="panel-head">
        <h2>Stratum Tectonica Farm</h2>
        <p class="powered-by">
          Powered by
          <a href="https://spansh.co.uk" target="_blank" rel="noopener noreferrer">Spansh.co.uk</a>
        </p>
      </div>

      <section class="import-box">
        <p class="meta">
          <strong>Current system:</strong>
          {{ snapshot.location.starSystem ?? 'Unknown' }}
        </p>
        <p class="meta small">
          Runs fixed Stratum Tectonica filters and uses your current system as reference_system.
        </p>
        <button
          type="button"
          (click)="searchStratumTectonicaFarm(snapshot)"
          [disabled]="importingRoute || !snapshot.location.starSystem"
        >
          {{ importingRoute ? 'Searching...' : 'Search Stratum Tectonica Farm' }}
        </button>
      </section>

      <p class="meta"><strong>Loaded route:</strong> {{ snapshot.route.routeName ?? 'None' }}</p>
      <p class="meta"><strong>Legs loaded:</strong> {{ snapshot.route.legs.length }}</p>
      <p class="success" *ngIf="importSuccessMessage">{{ importSuccessMessage }}</p>
      <p class="error" *ngIf="routeImportError">{{ routeImportError }}</p>

      <section class="filters-box" *ngIf="exobiologySystems.length > 0">
        <h3>Nearest Filters</h3>
        <div class="filters-grid">
          <label>
            <span>Max LY</span>
            <input
              type="number"
              min="0"
              step="1"
              [(ngModel)]="maxLyFilter"
              [ngModelOptions]="{ standalone: true }"
              [disabled]="importingRoute"
              placeholder="No limit"
            />
          </label>
          <label>
            <span>Max LS</span>
            <input
              type="number"
              min="0"
              step="1"
              [(ngModel)]="maxLsFilter"
              [ngModelOptions]="{ standalone: true }"
              [disabled]="importingRoute"
              placeholder="No limit"
            />
          </label>
        </div>
        <p class="meta small">
          Showing {{ filteredSystems.length }} / {{ exobiologySystems.length }} systems.
        </p>
      </section>

      <section class="systems-list" *ngIf="exobiologySystems.length > 0">
        <h3>Systems And Planets</h3>
        <details class="system-card" *ngFor="let system of filteredSystems; trackBy: trackBySystem">
          <summary>
            <span class="system-name">{{ system.systemName }}</span>
            <span class="system-distance">{{ formatLy(system.distanceLy) }}</span>
            <span class="system-ls">Nearest LS: {{ formatLs(system.nearestBodyLs) }}</span>
            <span class="system-count">Bodies: {{ system.bodies.length }}</span>
          </summary>
          <div class="body-list-wrap">
            <table>
              <thead>
                <tr>
                  <th>Planet</th>
                  <th>LS</th>
                  <th>Subtype</th>
                  <th>Atmosphere</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let body of system.bodies">
                  <td>{{ body.bodyName }}</td>
                  <td>{{ formatLs(body.distanceToArrivalLs) }}</td>
                  <td>{{ body.subtype ?? '-' }}</td>
                  <td>{{ body.atmosphere ?? '-' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </details>
      </section>
    </article>
  `,
  styles: `
    .panel {
      background: var(--panel-bg);
      border: 5px solid var(--panel-border);
      padding: 14px;
      box-sizing: border-box;
    }

    .compact h2 {
      margin: 0;
      font-size: 1.8rem;
      letter-spacing: 0.4px;
      font-weight: 700;
    }

    .panel-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      flex-wrap: wrap;
      margin-bottom: 10px;
    }

    .powered-by {
      margin: 0;
      font-size: 0.8rem;
      opacity: 0.85;
    }

    .powered-by a {
      color: inherit;
      font-weight: 700;
    }

    .import-box,
    .filters-box {
      margin-bottom: 10px;
      padding: 10px;
      border: 3px solid var(--panel-border);
      background: var(--table-bg);
      display: grid;
      gap: 10px;
    }

    .filters-grid {
      display: grid;
      gap: 10px;
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .filters-grid label {
      display: grid;
      gap: 6px;
      font-size: 0.92rem;
      font-weight: 700;
    }

    .filters-grid input {
      border: 3px solid var(--panel-border);
      background: var(--button-bg);
      color: var(--button-text);
      padding: 6px 8px;
      font: inherit;
    }

    .meta {
      margin: 4px 0;
      font-size: 1rem;
    }

    .meta.small {
      font-size: 0.9rem;
      opacity: 0.9;
      line-height: 1.35;
    }

    .success {
      color: #245b24;
      font-weight: 700;
      margin: 4px 0;
    }

    .error {
      color: var(--error-color);
      font-size: 1.05rem;
      font-weight: 700;
      margin: 4px 0;
    }

    button {
      border: 4px solid var(--panel-border);
      background: var(--button-bg);
      color: var(--button-text);
      padding: 6px 10px;
      font-size: 1rem;
      font-weight: 700;
      cursor: pointer;
      width: fit-content;
    }

    button:disabled {
      opacity: 0.65;
      cursor: default;
    }

    .systems-list {
      border-top: 4px solid #0a0a0a;
      margin-top: 10px;
      padding-top: 10px;
      display: grid;
      gap: 8px;
    }

    .systems-list h3 {
      margin: 0 0 4px;
      font-size: 1.3rem;
    }

    .system-card {
      border: 3px solid var(--panel-border);
      background: var(--table-bg);
      padding: 6px 8px;
    }

    .system-card summary {
      display: grid;
      grid-template-columns: minmax(200px, 1.5fr) minmax(95px, auto) minmax(120px, auto) minmax(90px, auto);
      gap: 8px;
      align-items: center;
      cursor: pointer;
      list-style: none;
      font-weight: 700;
    }

    .system-card summary::-webkit-details-marker {
      display: none;
    }

    .system-name {
      font-weight: 700;
      word-break: break-word;
    }

    .system-distance,
    .system-ls,
    .system-count {
      font-size: 0.9rem;
      opacity: 0.92;
    }

    .body-list-wrap {
      margin-top: 8px;
      max-height: 280px;
      overflow: auto;
      border: 1px solid var(--table-border);
    }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.9rem;
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

    @media (max-width: 860px) {
      .filters-grid {
        grid-template-columns: 1fr;
      }

      .system-card summary {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class ExobiologyRoutePanelComponent {
  @Input({ required: true }) snapshot!: StateSnapshot;

  importingRoute = false;
  routeImportError: string | null = null;
  importSuccessMessage: string | null = null;
  exobiologySystems: SpanshExobiologySystemCandidate[] = [];
  maxLyFilter = '';
  maxLsFilter = '';

  private readonly state = inject(RealtimeStateService);

  get filteredSystems(): SpanshExobiologySystemCandidate[] {
    const maxLy = this.parseMaxFilter(this.maxLyFilter);
    const maxLs = this.parseMaxFilter(this.maxLsFilter);

    return this.exobiologySystems
      .filter((system) => {
        const lyAllowed = maxLy === null || (system.distanceLy !== null && system.distanceLy <= maxLy);
        const lsAllowed = maxLs === null || (system.nearestBodyLs !== null && system.nearestBodyLs <= maxLs);
        return lyAllowed && lsAllowed;
      })
      .sort((left, right) => {
        const leftLs = left.nearestBodyLs;
        const rightLs = right.nearestBodyLs;

        if (leftLs === null && rightLs !== null) {
          return 1;
        }
        if (leftLs !== null && rightLs === null) {
          return -1;
        }
        if (leftLs !== null && rightLs !== null && leftLs !== rightLs) {
          return leftLs - rightLs;
        }

        const leftLy = left.distanceLy;
        const rightLy = right.distanceLy;
        if (leftLy === null && rightLy !== null) {
          return 1;
        }
        if (leftLy !== null && rightLy === null) {
          return -1;
        }
        if (leftLy !== null && rightLy !== null && leftLy !== rightLy) {
          return leftLy - rightLy;
        }

        return left.systemName.localeCompare(right.systemName);
      });
  }

  searchStratumTectonicaFarm(snapshot: StateSnapshot): void {
    const referenceSystem = snapshot.location.starSystem?.trim() ?? '';
    if (!referenceSystem) {
      this.routeImportError = 'Current system is required. Sync location first.';
      this.importSuccessMessage = null;
      return;
    }

    this.importingRoute = true;
    this.routeImportError = null;
    this.importSuccessMessage = null;
    this.exobiologySystems = [];
    this.maxLyFilter = '';
    this.maxLsFilter = '';

    this.state.importSpanshExobiologyRoute({
      search: {
        filters: {
          atmosphere: {
            value: STRATUM_TECTONICA_ATMOSPHERES,
          },
          distance: {
            min: '0',
            max: '40000',
          },
          gravity: {
            comparison: '<=>',
            value: ['0.00', 0.27],
          },
          subtype: {
            value: STRATUM_TECTONICA_SUBTYPES,
          },
          updated_at: {
            comparison: '<=>',
            value: ['2016-11-06T15:17:20.000Z', '2021-04-02T04:22:19.310Z'],
          },
        },
        page: 0,
        reference_system: referenceSystem,
        size: 10,
        sort: [
          {
            distance: {
              direction: 'asc',
            },
          },
        ],
      },
    }).subscribe({
      next: (result) => {
        this.importingRoute = false;
        this.exobiologySystems = result.exobiologySystems ?? [];
        this.importSuccessMessage =
          `Route loaded: ${result.routeName} (${result.legs} systems, ${this.exobiologySystems.length} with body data).`;
      },
      error: (error: unknown) => {
        const apiError = (error as { error?: { error?: unknown } })?.error?.error;
        this.routeImportError =
          typeof apiError === 'string' ? apiError : 'No se pudo importar la ruta de Stratum Tectonica.';
        this.importingRoute = false;
      },
    });
  }

  trackBySystem(_index: number, system: SpanshExobiologySystemCandidate): string {
    return system.systemName;
  }

  formatLy(value: number | null): string {
    if (value === null || Number.isNaN(value)) {
      return '-';
    }

    return `${value.toFixed(2)} LY`;
  }

  formatLs(value: number | null): string {
    if (value === null || Number.isNaN(value)) {
      return '-';
    }

    return `${Math.round(value).toLocaleString()} LS`;
  }

  private parseMaxFilter(value: string): number | null {
    const normalized = value.trim();
    if (!normalized) {
      return null;
    }

    const parsed = Number(normalized);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return null;
    }

    return parsed;
  }
}
