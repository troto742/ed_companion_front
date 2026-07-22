import { NgFor, NgIf } from '@angular/common';
import { Component, Input, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  RealtimeStateService,
  SpanshExobiologySystemCandidate,
} from '../realtime-state.service';
import { StateSnapshot } from '../state.types';

const SAVED_ROUTES_STORAGE_KEY = 'elite-companion-saved-routes';
const MAX_SAVED_ROUTES = 50;

interface SavedRouteEntry {
  id: string;
  routeName: string;
  fileName: string;
  fileType: string;
  uploadedAt: string;
  encodedData: string;
}

@Component({
  selector: 'app-exobiology-route-panel',
  standalone: true,
  imports: [NgIf, NgFor, FormsModule],
  template: `
    <article class="panel compact" *ngIf="snapshot as snapshot">
      <div class="panel-head">
        <h2>High-value Exobiology</h2>
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
          Searches all planet types and atmospheres. Only planets whose identified biological samples
          all meet the selected value are included.
        </p>
        <div class="filters-grid">
          <label>
            <span>Min. biological signals</span>
            <input type="number" min="1" max="20" step="1" [(ngModel)]="minBiologicalSignals" [disabled]="importingRoute" />
          </label>
          <label>
            <span>Min. value per sample (M CR)</span>
            <input type="number" min="0" step="1" [(ngModel)]="minSampleValueMillions" [disabled]="importingRoute" />
          </label>
        </div>
        <button
          type="button"
          (click)="searchHighValueExobiology(snapshot)"
          [disabled]="importingRoute || !snapshot.location.starSystem"
        >
          {{ importingRoute ? 'Searching...' : 'Search High-value Planets' }}
        </button>
      </section>

      <section class="saved-box">
        <h3>Saved Routes</h3>
        <div class="saved-actions">
          <select
            [disabled]="importingRoute || savedRoutes.length === 0"
            [value]="selectedSavedRouteId"
            (change)="onSavedRouteSelected($event)"
            title="Saved routes"
            aria-label="Saved routes"
          >
            <option value="">{{ savedRoutes.length > 0 ? 'Select saved route' : 'No saved routes' }}</option>
            <option *ngFor="let route of savedRoutes" [value]="route.id">
              {{ route.routeName }} ({{ formatSavedDate(route.uploadedAt) }})
            </option>
          </select>
          <button type="button" (click)="loadSelectedSavedRoute()" [disabled]="importingRoute || !selectedSavedRouteId">
            {{ importingRoute ? 'Loading...' : 'Load Saved Route' }}
          </button>
        </div>
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
        <button
          type="button"
          (click)="saveFilteredRoute(snapshot)"
          [disabled]="importingRoute || filteredCurrentRouteSystems.length === 0"
        >
          {{ importingRoute ? 'Saving...' : 'Save Filtered Route' }}
        </button>
        <p class="meta small">
          Showing {{ filteredCurrentRouteSystems.length }} / {{ currentRouteSystems.length }} systems from current route.
        </p>
      </section>

      <section class="systems-list" *ngIf="currentRouteSystems.length > 0">
        <h3>Systems And Planets</h3>
        <details class="system-card" *ngFor="let system of filteredCurrentRouteSystems; trackBy: trackBySystem">
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
                  <th>Bio signals</th>
                  <th>Samples (value)</th>
                  <th>Subtype</th>
                  <th>Atmosphere</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let body of system.bodies">
                  <td>{{ body.bodyName }}</td>
                  <td>{{ formatLs(body.distanceToArrivalLs) }}</td>
                  <td>{{ body.biologicalSignals }}</td>
                  <td>
                    <span *ngFor="let sample of body.samples; let last = last">
                      {{ sample.name }} ({{ formatCredits(sample.value) }})<span *ngIf="!last">, </span>
                    </span>
                  </td>
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
    .filters-box,
    .saved-box {
      margin-bottom: 10px;
      padding: 10px;
      border: 3px solid var(--panel-border);
      background: var(--table-bg);
      display: grid;
      gap: 10px;
    }

    .saved-box h3 {
      margin: 0;
      font-size: 1.1rem;
    }

    .saved-actions {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }

    .saved-actions select {
      border: 3px solid var(--panel-border);
      background: var(--button-bg);
      color: var(--button-text);
      padding: 6px 8px;
      font: inherit;
      min-width: 280px;
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
export class ExobiologyRoutePanelComponent implements OnInit {
  @Input({ required: true }) snapshot!: StateSnapshot;

  importingRoute = false;
  routeImportError: string | null = null;
  importSuccessMessage: string | null = null;
  exobiologySystems: SpanshExobiologySystemCandidate[] = [];
  maxLyFilter = '';
  maxLsFilter = '';
  lastReferenceSystem = '';
  savedRoutes: SavedRouteEntry[] = [];
  selectedSavedRouteId = '';
  minBiologicalSignals = 3;
  minSampleValueMillions = 10;

  private readonly state = inject(RealtimeStateService);

  ngOnInit(): void {
    this.loadSavedRoutesFromStorage();
  }

  get currentRouteSystems(): SpanshExobiologySystemCandidate[] {
    const legs = this.snapshot?.route?.legs ?? [];
    if (legs.length === 0) {
      return [];
    }

    const bySystem = new Map<string, SpanshExobiologySystemCandidate>();
    for (const system of this.exobiologySystems) {
      bySystem.set(this.normalizeSystemName(system.systemName), system);
    }

    const uniqueFromRoute: SpanshExobiologySystemCandidate[] = [];
    const seenRouteSystems = new Set<string>();
    for (const leg of legs) {
      const systemName = leg.systemName?.trim();
      if (!systemName) {
        continue;
      }

      const normalized = this.normalizeSystemName(systemName);
      if (seenRouteSystems.has(normalized)) {
        continue;
      }
      seenRouteSystems.add(normalized);

      const exobioSystem = bySystem.get(normalized);
      const sortedBodies = this.sortBodiesByLs(exobioSystem?.bodies ?? []);
      uniqueFromRoute.push({
        systemName,
        distanceLy: exobioSystem?.distanceLy ?? leg.distance ?? null,
        nearestBodyLs: this.getNearestBodyLs(sortedBodies, exobioSystem?.nearestBodyLs ?? null),
        bodies: sortedBodies
      });
    }

    return uniqueFromRoute;
  }

  get filteredCurrentRouteSystems(): SpanshExobiologySystemCandidate[] {
    const maxLy = this.parseMaxFilter(this.maxLyFilter);
    const maxLs = this.parseMaxFilter(this.maxLsFilter);

    return this.currentRouteSystems
      .filter((system) => {
        const lyAllowed = maxLy === null || (system.distanceLy !== null && system.distanceLy <= maxLy);
        const lsAllowed = maxLs === null || (system.nearestBodyLs !== null && system.nearestBodyLs <= maxLs);
        return lyAllowed && lsAllowed;
      })
      .sort((left, right) => {
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

        return left.systemName.localeCompare(right.systemName);
      });
  }

  searchHighValueExobiology(snapshot: StateSnapshot): void {
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
    this.lastReferenceSystem = referenceSystem;

    this.state.importSpanshExobiologyRoute({
      criteria: {
        minBiologicalSignals: Math.max(1, Math.trunc(Number(this.minBiologicalSignals) || 3)),
        minSampleValue: Math.max(0, Number(this.minSampleValueMillions) || 0) * 1_000_000,
      },
      search: {
        filters: {
          // Spansh requires at least one native body-search constraint. This is a
          // deliberately broad radius, not a planet-composition restriction.
          distance: {
            min: '0',
            max: '40000',
          },
          // These broad planet-level filters reduce the Spansh result set. The backend
          // still verifies the Biological signal specifically and every unique sample.
          signal_count: {
            comparison: '>=',
            value: Math.max(1, Math.trunc(Number(this.minBiologicalSignals) || 3)),
          },
          landmark_value: {
            comparison: '>=',
            value: Math.max(0, Number(this.minSampleValueMillions) || 0) * 1_000_000,
          },
        },
        page: 0,
        reference_system: referenceSystem,
        size: 30,
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
          typeof apiError === 'string' ? apiError : 'No se pudo importar la ruta de exobiología rentable.';
        this.importingRoute = false;
      },
    });
  }

  trackBySystem(_index: number, system: SpanshExobiologySystemCandidate): string {
    return system.systemName;
  }

  saveFilteredRoute(snapshot: StateSnapshot): void {
    if (this.filteredCurrentRouteSystems.length === 0) {
      this.routeImportError = 'No filtered systems available to save.';
      return;
    }

    const initialSystem =
      this.lastReferenceSystem.trim() ||
      snapshot.location.starSystem?.trim() ||
      'exobiology';
    const routeName = `${initialSystem} High-value Exobiology`;
    const routeFile = this.buildFilteredRouteCsvFile(routeName, this.filteredCurrentRouteSystems);

    this.importingRoute = true;
    this.routeImportError = null;

    this.state.uploadRoute(routeFile, routeName).subscribe({
      next: (result) => {
        this.importingRoute = false;
        this.importSuccessMessage = `Filtered route saved: ${result.routeName} (${result.legs} legs).`;
        void this.saveRouteToStorage(routeFile, result.routeName);
      },
      error: (error: unknown) => {
        const apiError = (error as { error?: { error?: unknown } })?.error?.error;
        this.routeImportError =
          typeof apiError === 'string' ? apiError : 'No se pudo guardar la ruta filtrada.';
        this.importingRoute = false;
      },
    });
  }

  onSavedRouteSelected(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.selectedSavedRouteId = select.value;
  }

  loadSelectedSavedRoute(): void {
    if (!this.selectedSavedRouteId) {
      return;
    }

    const selectedRoute = this.savedRoutes.find((route) => route.id === this.selectedSavedRouteId);
    if (!selectedRoute) {
      this.routeImportError = 'Saved route not found.';
      return;
    }

    let file: File;
    try {
      file = this.buildFileFromSavedRoute(selectedRoute);
    } catch {
      this.routeImportError = 'Saved route is invalid and could not be loaded.';
      return;
    }

    this.importingRoute = true;
    this.routeImportError = null;

    this.state.uploadRoute(file, selectedRoute.routeName).subscribe({
      next: (result) => {
        this.importingRoute = false;
        this.importSuccessMessage = `Loaded saved route: ${result.routeName} (${result.legs} legs).`;
      },
      error: (error: unknown) => {
        const apiError = (error as { error?: { error?: unknown } })?.error?.error;
        this.routeImportError =
          typeof apiError === 'string' ? apiError : 'No se pudo cargar la ruta guardada.';
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

  formatLs(value: number | null): string {
    if (value === null || Number.isNaN(value)) {
      return '-';
    }

    return `${Math.round(value).toLocaleString()} LS`;
  }

  formatCredits(value: number): string {
    return `${(value / 1_000_000).toLocaleString(undefined, { maximumFractionDigits: 2 })} M CR`;
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

  private sortBodiesByLs(
    bodies: SpanshExobiologySystemCandidate['bodies']
  ): SpanshExobiologySystemCandidate['bodies'] {
    return [...bodies].sort((left, right) => {
      const leftLs = left.distanceToArrivalLs;
      const rightLs = right.distanceToArrivalLs;
      if (leftLs === null && rightLs !== null) {
        return 1;
      }
      if (leftLs !== null && rightLs === null) {
        return -1;
      }
      if (leftLs !== null && rightLs !== null && leftLs !== rightLs) {
        return leftLs - rightLs;
      }
      return left.bodyName.localeCompare(right.bodyName);
    });
  }

  private getNearestBodyLs(
    bodies: SpanshExobiologySystemCandidate['bodies'],
    fallback: number | null
  ): number | null {
    const nearestWithDistance = bodies.find(
      (body) => body.distanceToArrivalLs !== null && Number.isFinite(body.distanceToArrivalLs)
    );
    return nearestWithDistance?.distanceToArrivalLs ?? fallback;
  }

  private normalizeSystemName(value: string | null | undefined): string {
    return (value ?? '').trim().toLowerCase();
  }

  formatSavedDate(timestamp: string): string {
    const parsed = Date.parse(timestamp);
    if (Number.isNaN(parsed)) {
      return 'Unknown date';
    }

    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(parsed));
  }

  private buildFilteredRouteCsvFile(
    routeName: string,
    systems: SpanshExobiologySystemCandidate[]
  ): File {
    const safeFileName = routeName.replace(/[\\/:*?"<>|]/g, '-').trim() || 'high-value-exobiology-route';
    const csvLines = [
      ['systemName', 'distance', 'distanceRemaining', 'estimatedJumps', 'refuel', 'neutronStar'].join(','),
      ...systems.map((system, index) => [
        this.escapeCsvCell(system.systemName),
        system.distanceLy ?? '',
        '',
        Math.max(0, systems.length - index - 1),
        'false',
        'false',
      ].join(',')),
    ];

    return new File([csvLines.join('\n')], `${safeFileName}.csv`, {
      type: 'text/csv',
      lastModified: Date.now(),
    });
  }

  private escapeCsvCell(value: string): string {
    if (!value.includes(',') && !value.includes('"') && !value.includes('\n')) {
      return value;
    }

    return `"${value.replace(/"/g, '""')}"`;
  }

  private loadSavedRoutesFromStorage(): void {
    try {
      const raw = localStorage.getItem(SAVED_ROUTES_STORAGE_KEY);
      if (!raw) {
        this.savedRoutes = [];
        return;
      }

      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) {
        this.savedRoutes = [];
        return;
      }

      this.savedRoutes = parsed
        .filter((entry): entry is SavedRouteEntry => this.isSavedRouteEntry(entry))
        .slice(0, MAX_SAVED_ROUTES);
    } catch {
      this.savedRoutes = [];
    }
  }

  private async saveRouteToStorage(file: File, routeName: string): Promise<void> {
    try {
      const encodedData = await this.readFileAsBase64(file);
      const uploadedAt = new Date().toISOString();
      const existing = this.savedRoutes.filter(
        (route) => this.normalizeRouteName(route.routeName) !== this.normalizeRouteName(routeName)
      );

      const routeToSave: SavedRouteEntry = {
        id: this.createSavedRouteId(routeName),
        routeName,
        fileName: file.name,
        fileType: file.type || 'application/octet-stream',
        uploadedAt,
        encodedData,
      };

      const nextRoutes = [routeToSave, ...existing].slice(0, MAX_SAVED_ROUTES);
      localStorage.setItem(SAVED_ROUTES_STORAGE_KEY, JSON.stringify(nextRoutes));
      this.savedRoutes = nextRoutes;
      this.selectedSavedRouteId = routeToSave.id;
    } catch {
      // ignore local save errors
    }
  }

  private isSavedRouteEntry(value: unknown): value is SavedRouteEntry {
    if (!value || typeof value !== 'object') {
      return false;
    }

    const candidate = value as Partial<SavedRouteEntry>;
    return (
      typeof candidate.id === 'string' &&
      typeof candidate.routeName === 'string' &&
      typeof candidate.fileName === 'string' &&
      typeof candidate.fileType === 'string' &&
      typeof candidate.uploadedAt === 'string' &&
      typeof candidate.encodedData === 'string'
    );
  }

  private createSavedRouteId(routeName: string): string {
    const normalized = routeName.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    return `${normalized || 'route'}-${Date.now()}`;
  }

  private normalizeRouteName(value: string): string {
    return value.trim().toLowerCase();
  }

  private async readFileAsBase64(file: File): Promise<string> {
    const buffer = await file.arrayBuffer();
    return this.arrayBufferToBase64(buffer);
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    const chunkSize = 0x8000;

    for (let index = 0; index < bytes.length; index += chunkSize) {
      const chunk = bytes.subarray(index, index + chunkSize);
      binary += String.fromCharCode(...chunk);
    }

    return btoa(binary);
  }

  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const length = binary.length;
    const bytes = new Uint8Array(length);

    for (let index = 0; index < length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }

    return bytes.buffer;
  }

  private buildFileFromSavedRoute(savedRoute: SavedRouteEntry): File {
    const buffer = this.base64ToArrayBuffer(savedRoute.encodedData);
    const blob = new Blob([buffer], { type: savedRoute.fileType || 'application/octet-stream' });
    return new File([blob], savedRoute.fileName, {
      type: savedRoute.fileType || undefined,
      lastModified: Date.parse(savedRoute.uploadedAt) || Date.now(),
    });
  }
}
