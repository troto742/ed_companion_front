import { NgFor, NgIf } from '@angular/common';
import { Component, Input, inject } from '@angular/core';
import { RealtimeStateService, SpanshRoutePreviewRow } from '../realtime-state.service';
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
  imports: [NgIf, NgFor],
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
          This button runs the fixed Stratum Tectonica filters from your HAR and uses your current
          in-game system as reference_system.
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

      <section class="route-star-info" *ngIf="previewRows.length > 0">
        <h3>Imported Preview</h3>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>System</th>
                <th>Distance</th>
                <th>Estimated jumps</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let row of previewRows">
                <td>{{ row.systemName }}</td>
                <td>{{ formatLy(row.distance) }}</td>
                <td>{{ row.estimatedJumps ?? '-' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
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

    .import-box {
      margin-bottom: 10px;
      padding: 10px;
      border: 3px solid var(--panel-border);
      background: var(--table-bg);
      display: grid;
      gap: 10px;
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

    .route-star-info {
      border-top: 4px solid #0a0a0a;
      margin-top: 10px;
      padding-top: 10px;
    }

    .route-star-info h3 {
      margin: 0 0 8px;
      font-size: 1.3rem;
    }

    .table-wrap {
      max-height: 460px;
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
  `,
})
export class ExobiologyRoutePanelComponent {
  @Input({ required: true }) snapshot!: StateSnapshot;

  importingRoute = false;
  routeImportError: string | null = null;
  importSuccessMessage: string | null = null;
  previewRows: SpanshRoutePreviewRow[] = [];

  private readonly state = inject(RealtimeStateService);

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
        this.previewRows = result.previewRows;
        this.importSuccessMessage = `Route loaded: ${result.routeName} (${result.legs} legs).`;
      },
      error: (error: unknown) => {
        const apiError = (error as { error?: { error?: unknown } })?.error?.error;
        this.routeImportError =
          typeof apiError === 'string' ? apiError : 'No se pudo importar la ruta de Stratum Tectonica.';
        this.importingRoute = false;
      },
    });
  }

  formatLy(value: number | null): string {
    if (value === null || Number.isNaN(value)) {
      return '-';
    }

    return `${value.toFixed(2)} LY`;
  }
}
