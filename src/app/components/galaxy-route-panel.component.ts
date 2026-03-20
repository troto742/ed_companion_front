import { NgClass, NgFor, NgIf } from '@angular/common';
import { Component, Input, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RealtimeStateService, SpanshRoutePreviewRow } from '../realtime-state.service';
import { StateSnapshot } from '../state.types';

interface SavedRouteEntry {
  id: string;
  routeName: string;
  fileName: string;
  fileType: string;
  uploadedAt: string;
  encodedData: string;
}

const SAVED_ROUTES_STORAGE_KEY = 'elite-companion-saved-routes';
const EXACT_PLOTTER_STORAGE_KEY = 'elite-companion-exact-plotter';
const MAX_SAVED_ROUTES = 15;

@Component({
  selector: 'app-galaxy-route-panel',
  standalone: true,
  imports: [NgIf, NgFor, NgClass, FormsModule],
  template: `
    <article class="panel compact" *ngIf="snapshot as snapshot">
      <div class="route-head">
        <h2>Galaxy Route</h2>
        <div class="route-actions">
          <select
            [disabled]="uploadingRoute || savedRoutes.length === 0"
            (change)="onSavedRouteSelected($event)"
            [value]="selectedSavedRouteId"
            title="Saved routes"
            aria-label="Saved routes"
          >
            <option value="">{{ savedRoutes.length > 0 ? 'Select saved route' : 'No saved routes' }}</option>
            <option *ngFor="let route of savedRoutes" [value]="route.id">
              {{ route.routeName }} ({{ formatSavedDate(route.uploadedAt) }})
            </option>
          </select>
          <button type="button" (click)="routeInput.click()" [disabled]="uploadingRoute">
            {{ uploadingRoute ? 'Uploading...' : 'Upload CSV' }}
          </button>
        </div>
        <input
          #routeInput
          type="file"
          accept=".csv,.xlsx"
          (change)="onRouteFileSelected($event)"
          hidden
        />
      </div>

      <section class="spansh-generator">
        <p class="powered-by">
          Powered by
          <a href="https://spansh.co.uk" target="_blank" rel="noopener noreferrer">Spansh.co.uk</a>
        </p>
        <div class="generator-grid">
          <label>
            <span>Source</span>
            <input
              type="text"
              [(ngModel)]="spanshSource"
              [ngModelOptions]="{ standalone: true }"
              [disabled]="uploadingRoute"
              placeholder="Current system"
            />
          </label>
          <label>
            <span>Destination</span>
            <input
              type="text"
              [(ngModel)]="spanshDestination"
              [ngModelOptions]="{ standalone: true }"
              [disabled]="uploadingRoute"
              placeholder="Colonia"
            />
          </label>
          <label>
            <span>Jump Range</span>
            <input
              type="number"
              min="1"
              step="0.1"
              [(ngModel)]="spanshJumpRange"
              [ngModelOptions]="{ standalone: true }"
              [disabled]="uploadingRoute"
            />
          </label>
          <label>
            <span>Efficiency</span>
            <input
              type="number"
              min="1"
              max="100"
              step="1"
              [(ngModel)]="spanshEfficiency"
              [ngModelOptions]="{ standalone: true }"
              [disabled]="uploadingRoute"
            />
          </label>
        </div>
        <button type="button" (click)="generateSpanshRoute(snapshot)" [disabled]="uploadingRoute">
          {{ uploadingRoute ? 'Generating...' : 'Generate via Spansh' }}
        </button>
      </section>

      <section class="exact-plotter-assist">
        <h3>Exact Plotter Assist</h3>
        <p class="helper-copy">Paste a SLEF/Coriolis ship build to generate an exact route here.</p>
        <div class="generator-grid">
          <label>
            <span>Source</span>
            <input
              type="text"
              [(ngModel)]="exactSource"
              [ngModelOptions]="{ standalone: true }"
              [disabled]="uploadingRoute"
              placeholder="Current system"
            />
          </label>
          <label>
            <span>Destination</span>
            <input
              type="text"
              [(ngModel)]="exactDestination"
              [ngModelOptions]="{ standalone: true }"
              [disabled]="uploadingRoute"
              placeholder="Colonia"
            />
          </label>
          <label>
            <span>Cargo</span>
            <input
              type="number"
              min="0"
              step="1"
              [(ngModel)]="exactCargo"
              [ngModelOptions]="{ standalone: true }"
              [disabled]="uploadingRoute"
            />
          </label>
          <label>
            <span>Reserve Fuel</span>
            <input
              type="number"
              min="0"
              step="0.1"
              [(ngModel)]="exactFuelReserveSize"
              [ngModelOptions]="{ standalone: true }"
              [disabled]="uploadingRoute"
            />
          </label>
        </div>
        <label class="build-label">
          <span>Ship Build</span>
          <textarea
            rows="6"
            [(ngModel)]="exactShipBuild"
            [ngModelOptions]="{ standalone: true }"
            [disabled]="uploadingRoute"
            placeholder="Paste the SLEF or Coriolis ship export here"
          ></textarea>
        </label>
        <div class="exact-actions">
          <button type="button" (click)="saveExactPlotterDraft(snapshot)" [disabled]="uploadingRoute">
            Save Build
          </button>
          <button type="button" (click)="generateExactRoute(snapshot)" [disabled]="uploadingRoute">
            {{ uploadingRoute ? 'Generating...' : 'Generate Exact Route' }}
          </button>
        </div>
      </section>

      <p class="meta progress-line">
        <span>Progress: {{ formatPercent(getRouteProgress(snapshot)) }}</span>
        <span>Jumps left: {{ formatJumpsLeft(getJumpsLeft(snapshot)) }}</span>
        <span>Star status: {{ getStarStatus(snapshot) }}</span>
      </p>
      <div class="meter route-meter">
        <div class="fill" [style.width.%]="getRouteProgress(snapshot)"></div>
      </div>

      <p>
        <strong>Current Star:</strong>
        {{ snapshot.location.starSystem ?? '------' }}
        <span class="meta-inline">({{ getRouteMatchLabel(snapshot) }})</span>
      </p>
      <p class="next-star-line">
        <strong>Next Star:</strong>
        <span>{{ snapshot.route.nextLeg?.systemName ?? '------' }}</span>
        <button
          type="button"
          class="icon-btn"
          (click)="copyNextStar(snapshot)"
          [disabled]="!snapshot.route.nextLeg?.systemName"
          title="Copy next star"
          aria-label="Copy next star"
        >
          &#x29C9;
        </button>
      </p>
      <p><strong>Remaining LY:</strong> {{ formatLy(getRemainingLy(snapshot)) }}</p>
      <p class="meta" *ngIf="copyMessage">{{ copyMessage }}</p>
      <p class="error" *ngIf="routeUploadError">{{ routeUploadError }}</p>

      <section class="route-star-info">
        <h3>Star Info</h3>
        <div class="table-wrap" *ngIf="csvHeaders.length > 0; else noCsvTable">
          <table>
            <thead>
              <tr>
                <th *ngFor="let header of csvHeaders">{{ header }}</th>
              </tr>
            </thead>
            <tbody>
              <tr
                *ngFor="let row of csvRows; let rowIndex = index"
                [ngClass]="getTableRowClass(rowIndex, snapshot)"
              >
                <td *ngFor="let cell of row">{{ cell || '-' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <ng-template #noCsvTable>
          <p class="placeholder">Upload a CSV to show all route rows.</p>
        </ng-template>
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
      margin: 0 0 10px;
      font-size: 1.8rem;
      letter-spacing: 0.4px;
      font-weight: 700;
    }

    .route-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      margin-bottom: 6px;
      flex-wrap: wrap;
    }

    .route-actions {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-left: auto;
      flex-wrap: wrap;
    }

    .panel p {
      margin: 4px 0;
      font-size: 1.4rem;
      line-height: 1.25;
    }

    .meta {
      font-size: 1.1rem;
      opacity: 0.9;
    }

    .progress-line {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      flex-wrap: wrap;
    }

    .meta-inline {
      font-size: 1.05rem;
      opacity: 0.85;
    }

    button {
      border: 4px solid var(--panel-border);
      background: var(--button-bg);
      color: var(--button-text);
      padding: 4px 10px;
      font-size: 1rem;
      font-weight: 700;
      cursor: pointer;
    }

    select {
      border: 4px solid var(--panel-border);
      background: var(--button-bg);
      color: var(--button-text);
      padding: 4px 8px;
      font-size: 0.95rem;
      font-weight: 700;
      min-width: 220px;
      max-width: 340px;
    }

    select:disabled {
      opacity: 0.65;
      cursor: default;
    }

    button:disabled {
      opacity: 0.65;
      cursor: default;
    }

    .meter {
      position: relative;
      height: 44px;
      border: 5px solid var(--panel-border);
      background: var(--meter-bg);
      overflow: hidden;
    }

    .fill {
      position: absolute;
      inset: 0 auto 0 0;
      background: var(--meter-fill);
      transition: width 250ms ease;
    }

    .route-meter {
      height: 30px;
      margin-bottom: 8px;
    }

    .route-meter .fill {
      background: repeating-linear-gradient(
        90deg,
        #000 0px,
        #000 14px,
        #262626 14px,
        #262626 28px
      );
    }

    .next-star-line {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }

    .icon-btn {
      border: 3px solid var(--panel-border);
      background: var(--button-bg);
      padding: 0 8px;
      font-size: 1rem;
      line-height: 1.6;
      min-width: 34px;
    }

    .route-star-info {
      border-top: 4px solid #0a0a0a;
      margin-top: 10px;
      padding-top: 10px;
    }

    .spansh-generator {
      margin-bottom: 10px;
      padding: 10px;
      border: 3px solid var(--panel-border);
      background: var(--table-bg);
      display: grid;
      gap: 10px;
    }

    .generator-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 10px;
    }

    .generator-grid label {
      display: grid;
      gap: 6px;
      font-size: 0.95rem;
      font-weight: 700;
    }

    .generator-grid input {
      border: 3px solid var(--panel-border);
      background: var(--button-bg);
      color: var(--button-text);
      padding: 6px 8px;
      font: inherit;
    }

    .powered-by {
      margin: 0;
      font-size: 0.78rem;
      opacity: 0.85;
    }

    .powered-by a {
      color: inherit;
      font-weight: 700;
    }

    .exact-plotter-assist {
      margin-bottom: 10px;
      padding: 10px;
      border: 3px solid var(--panel-border);
      background: var(--table-bg);
      display: grid;
      gap: 10px;
    }

    .exact-plotter-assist h3 {
      margin: 0;
      font-size: 1.05rem;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }

    .helper-copy {
      margin: 0;
      font-size: 0.8rem;
      line-height: 1.25;
      opacity: 0.8;
    }

    .build-label {
      display: grid;
      gap: 6px;
      font-size: 0.9rem;
      font-weight: 700;
    }

    .build-label textarea {
      border: 3px solid var(--panel-border);
      background: var(--button-bg);
      color: var(--button-text);
      padding: 8px 10px;
      font: inherit;
      resize: vertical;
    }

    .exact-actions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }

    .route-star-info h3 {
      margin: 0 0 8px;
      font-size: 1.35rem;
      letter-spacing: 0.4px;
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

    tbody tr.row-current td {
      background: #ffe08a;
      font-weight: 700;
    }

    tbody tr.row-passed td {
      background: #d8f6d8;
      color: #2d582d;
    }

    .placeholder {
      margin: 0;
      font-size: 1rem;
      letter-spacing: 0.2px;
    }

    .error {
      color: var(--error-color);
      font-size: 1.05rem;
      font-weight: 700;
    }

    @media (max-width: 920px) {
      .generator-grid {
        grid-template-columns: 1fr 1fr;
      }
    }

    @media (max-width: 640px) {
      .generator-grid {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class GalaxyRoutePanelComponent implements OnInit {
  @Input({ required: true }) snapshot!: StateSnapshot;

  uploadingRoute = false;
  routeUploadError: string | null = null;
  copyMessage: string | null = null;
  csvHeaders: string[] = [];
  csvRows: string[][] = [];
  csvRowSystems: string[] = [];
  savedRoutes: SavedRouteEntry[] = [];
  selectedSavedRouteId = '';
  spanshSource = '';
  spanshDestination = '';
  spanshJumpRange = 60;
  spanshEfficiency = 25;
  exactSource = '';
  exactDestination = '';
  exactShipBuild = '';
  exactCargo = 0;
  exactFuelReserveSize = 0;

  private readonly state = inject(RealtimeStateService);

  ngOnInit(): void {
    this.loadSavedRoutesFromStorage();
    this.loadExactPlotterDraft();
  }

  onRouteFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';

    if (!file) {
      return;
    }

    const routeName = this.getRouteNameFromFile(file.name);
    this.uploadingRoute = true;
    this.routeUploadError = null;
    this.copyMessage = null;
    void this.prepareCsvPreview(file);

    this.state.uploadRoute(file, routeName).subscribe({
      next: (result) => {
        this.routeUploadError = null;
        this.uploadingRoute = false;
        void this.saveRouteToStorage(file, result.routeName);
      },
      error: (error: unknown) => {
        const apiError = (error as { error?: { error?: unknown } })?.error?.error;
        this.routeUploadError =
          typeof apiError === 'string' ? apiError : 'No se pudo subir la ruta al backend.';
        this.uploadingRoute = false;
      },
    });
  }

  generateSpanshRoute(snapshot: StateSnapshot): void {
    const sourceSystem = this.spanshSource.trim() || snapshot.location.starSystem?.trim() || '';
    const destinationSystem = this.spanshDestination.trim();

    if (!sourceSystem || !destinationSystem) {
      this.routeUploadError = 'Source and destination systems are required to generate a Spansh route.';
      return;
    }

    this.uploadingRoute = true;
    this.routeUploadError = null;
    this.copyMessage = null;

    this.state.generateSpanshRoute({
      sourceSystem,
      destinationSystem,
      jumpRange: this.spanshJumpRange,
      efficiency: this.spanshEfficiency,
    }).subscribe({
      next: (result) => {
        this.routeUploadError = null;
        this.uploadingRoute = false;
        this.spanshSource = sourceSystem;
        this.applySpanshPreview(result.previewRows);
        const generatedFile = this.buildSpanshCsvFile(result.routeName, result.previewRows);
        void this.saveRouteToStorage(generatedFile, result.routeName);
      },
      error: (error: unknown) => {
        const apiError = (error as { error?: { error?: unknown } })?.error?.error;
        this.routeUploadError =
          typeof apiError === 'string' ? apiError : 'No se pudo generar la ruta con Spansh.';
        this.uploadingRoute = false;
      },
    });
  }

  saveExactPlotterDraft(snapshot: StateSnapshot): void {
    this.persistExactPlotterDraft(snapshot);
    this.copyMessage = 'Exact plotter build saved locally.';
    this.routeUploadError = null;
  }

  generateExactRoute(snapshot: StateSnapshot): void {
    const sourceSystem = this.exactSource.trim() || snapshot.location.starSystem?.trim() || '';
    const destinationSystem = this.exactDestination.trim();
    const shipBuild = this.exactShipBuild.trim();

    if (!sourceSystem || !destinationSystem) {
      this.routeUploadError = 'Source and destination systems are required to generate an exact route.';
      return;
    }

    if (!shipBuild) {
      this.routeUploadError = 'Ship build is required to generate an exact route.';
      return;
    }

    this.uploadingRoute = true;
    this.routeUploadError = null;
    this.copyMessage = null;
    this.persistExactPlotterDraft(snapshot);

    this.state.generateSpanshExactRoute({
      sourceSystem,
      destinationSystem,
      shipBuild,
      cargo: this.exactCargo,
      fuelReserveSize: this.exactFuelReserveSize,
    }).subscribe({
      next: (result) => {
        this.routeUploadError = null;
        this.uploadingRoute = false;
        this.exactSource = sourceSystem;
        this.applySpanshPreview(result.previewRows);
        const generatedFile = this.buildSpanshCsvFile(result.routeName, result.previewRows);
        void this.saveRouteToStorage(generatedFile, result.routeName);
      },
      error: (error: unknown) => {
        const apiError = (error as { error?: { error?: unknown } })?.error?.error;
        this.routeUploadError =
          typeof apiError === 'string' ? apiError : 'No se pudo generar la ruta exacta con Spansh.';
        this.uploadingRoute = false;
      },
    });
  }

  onSavedRouteSelected(event: Event): void {
    const select = event.target as HTMLSelectElement;
    const routeId = select.value;
    this.selectedSavedRouteId = routeId;

    if (!routeId) {
      return;
    }

    const selectedRoute = this.savedRoutes.find((route) => route.id === routeId);
    if (!selectedRoute) {
      return;
    }

    this.uploadingRoute = true;
    this.routeUploadError = null;
    this.copyMessage = null;

    let file: File;
    try {
      file = this.buildFileFromSavedRoute(selectedRoute);
    } catch {
      this.routeUploadError = 'Saved route is invalid and could not be loaded.';
      this.uploadingRoute = false;
      return;
    }

    void this.prepareCsvPreview(file);

    this.state.uploadRoute(file, selectedRoute.routeName).subscribe({
      next: () => {
        this.routeUploadError = null;
        this.uploadingRoute = false;
      },
      error: (error: unknown) => {
        const apiError = (error as { error?: { error?: unknown } })?.error?.error;
        this.routeUploadError =
          typeof apiError === 'string' ? apiError : 'No se pudo cargar la ruta guardada.';
        this.uploadingRoute = false;
      },
    });
  }

  copyNextStar(snapshot: StateSnapshot): void {
    const nextStar = snapshot.route.nextLeg?.systemName?.trim();
    if (!nextStar) {
      return;
    }

    this.copyToClipboard(nextStar)
      .then(() => {
        this.copyMessage = `Copied: ${nextStar}`;
      })
      .catch(() => {
        this.copyMessage = 'Unable to copy next star.';
      });
  }

  getRouteProgress(snapshot: StateSnapshot): number {
    const totalLegs = snapshot.route.legs.length;
    if (!snapshot.route.routeLoaded || totalLegs === 0 || snapshot.route.currentIndex === null) {
      return 0;
    }

    const progress = ((snapshot.route.currentIndex + 1) / totalLegs) * 100;
    return this.normalizePercent(progress);
  }

  getRemainingLy(snapshot: StateSnapshot): number | null {
    if (!snapshot.route.routeLoaded || snapshot.route.legs.length === 0) {
      return null;
    }

    if (snapshot.route.currentIndex !== null) {
      const leg = snapshot.route.legs[snapshot.route.currentIndex];
      return leg?.distanceRemaining ?? null;
    }

    return snapshot.route.legs[0].distanceRemaining;
  }

  getJumpsLeft(snapshot: StateSnapshot): number | null {
    if (!snapshot.route.routeLoaded || snapshot.route.legs.length === 0) {
      return null;
    }

    if (snapshot.route.currentIndex === null) {
      return snapshot.route.legs.length;
    }

    return Math.max(0, snapshot.route.legs.length - (snapshot.route.currentIndex + 1));
  }

  getStarStatus(snapshot: StateSnapshot): string {
    if (!snapshot.route.routeLoaded) {
      return 'N/A';
    }

    const leg = snapshot.route.nextLeg;
    if (!leg) {
      return 'Completed';
    }

    const flags: string[] = [];
    if (leg.neutronStar) {
      flags.push('Neutro');
    }
    if (leg.refuel) {
      flags.push('Refuel');
    }

    return flags.length > 0 ? flags.join(' + ') : 'Normal';
  }

  getRouteMatchLabel(snapshot: StateSnapshot): string {
    if (!snapshot.route.routeLoaded) {
      return 'No route loaded';
    }

    return snapshot.route.currentIndex === null ? 'Not matched in route' : 'Matched with star in route';
  }

  getTableRowClass(rowIndex: number, snapshot: StateSnapshot): string {
    const routeRowIndex = this.getRouteIndexForCsvRow(rowIndex, snapshot);
    if (routeRowIndex === null) {
      return '';
    }

    const currentRouteIndex = snapshot.route.currentIndex;
    if (currentRouteIndex === null) {
      const rowSystem = this.normalizeSystemName(this.csvRowSystems[rowIndex]);
      const currentSystem = this.normalizeSystemName(snapshot.location.starSystem);
      return rowSystem && currentSystem && rowSystem === currentSystem ? 'row-current' : '';
    }

    if (routeRowIndex === currentRouteIndex) {
      return 'row-current';
    }

    return routeRowIndex < currentRouteIndex ? 'row-passed' : '';
  }

  formatPercent(value: number): string {
    return `${Math.round(this.normalizePercent(value))}%`;
  }

  formatLy(value: number | null): string {
    if (value === null || Number.isNaN(value)) {
      return '------';
    }

    return `${value.toFixed(1)} LY`;
  }

  formatJumpsLeft(value: number | null): string {
    if (value === null || Number.isNaN(value) || !Number.isFinite(value)) {
      return '------';
    }

    return `${Math.max(0, Math.trunc(value))}`;
  }

  private normalizePercent(value: number | null | undefined): number {
    if (value === null || value === undefined || Number.isNaN(value) || !Number.isFinite(value)) {
      return 0;
    }

    const normalized = value <= 1 ? value * 100 : value;
    return Math.max(0, Math.min(100, normalized));
  }

  private getRouteNameFromFile(fileName: string): string {
    const dotIndex = fileName.lastIndexOf('.');
    if (dotIndex <= 0) {
      return fileName.trim();
    }

    return fileName.slice(0, dotIndex).trim();
  }

  private applySpanshPreview(rows: SpanshRoutePreviewRow[]): void {
    this.csvHeaders = ['System', 'Distance', 'Remaining', 'Estimated jumps', 'Neutron'];
    this.csvRows = rows.map((row) => [
      row.systemName,
      row.distance === null ? '' : row.distance.toFixed(2),
      row.distanceRemaining === null ? '' : row.distanceRemaining.toFixed(2),
      row.estimatedJumps === null ? '' : String(row.estimatedJumps),
      row.neutronStar ? 'Yes' : 'No',
    ]);
    this.csvRowSystems = rows.map((row) => row.systemName);
  }

  private buildSpanshCsvFile(routeName: string, rows: SpanshRoutePreviewRow[]): File {
    const csvLines = [
      ['systemName', 'distance', 'distanceRemaining', 'estimatedJumps', 'neutronStar'].join(','),
      ...rows.map((row) => [
        this.escapeCsvCell(row.systemName),
        row.distance ?? '',
        row.distanceRemaining ?? '',
        row.estimatedJumps ?? '',
        row.neutronStar ? 'true' : 'false',
      ].join(',')),
    ];

    return new File([csvLines.join('\n')], `${routeName}.csv`, {
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

  private async prepareCsvPreview(file: File): Promise<void> {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      this.csvHeaders = [];
      this.csvRows = [];
      this.csvRowSystems = [];
      return;
    }

    try {
      const content = await file.text();
      const parsedRows = this.parseCsvMatrix(content);
      if (parsedRows.length === 0) {
        this.csvHeaders = [];
        this.csvRows = [];
        this.csvRowSystems = [];
        return;
      }

      const headers = parsedRows[0].map((value, index) => {
        const cleanValue = value.trim().replace(/^\uFEFF/, '');
        return cleanValue || `Column ${index + 1}`;
      });
      const systemColumnIndex = this.findSystemColumnIndex(headers);

      const columnCount = headers.length;
      const rows = parsedRows
        .slice(1)
        .filter((row) => row.some((cell) => cell.trim().length > 0))
        .map((row) => this.normalizeTableRow(row, columnCount));
      const rowSystems = rows.map((row) =>
        systemColumnIndex >= 0 ? row[systemColumnIndex] ?? '' : ''
      );

      this.csvHeaders = headers;
      this.csvRows = rows;
      this.csvRowSystems = rowSystems;
    } catch {
      this.csvHeaders = [];
      this.csvRows = [];
      this.csvRowSystems = [];
      this.routeUploadError = 'CSV could not be parsed for Star Info table.';
    }
  }

  private parseCsvMatrix(content: string): string[][] {
    const rows: string[][] = [];
    let row: string[] = [];
    let field = '';
    let inQuotes = false;

    for (let i = 0; i < content.length; i += 1) {
      const char = content[i];

      if (char === '"') {
        if (inQuotes && content[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }

      if (char === ',' && !inQuotes) {
        row.push(field);
        field = '';
        continue;
      }

      if ((char === '\n' || char === '\r') && !inQuotes) {
        if (char === '\r' && content[i + 1] === '\n') {
          i += 1;
        }
        row.push(field);
        rows.push(row);
        row = [];
        field = '';
        continue;
      }

      field += char;
    }

    row.push(field);
    if (row.length > 1 || row[0].trim().length > 0) {
      rows.push(row);
    }

    return rows;
  }

  private normalizeTableRow(row: string[], columnCount: number): string[] {
    const normalized = row.slice(0, columnCount);
    while (normalized.length < columnCount) {
      normalized.push('');
    }
    return normalized.map((value) => value.trim());
  }

  private findSystemColumnIndex(headers: string[]): number {
    const aliases = new Set(['systemname', 'system', 'starsystem', 'star', 'target']);
    for (let index = 0; index < headers.length; index += 1) {
      if (aliases.has(this.normalizeHeader(headers[index]))) {
        return index;
      }
    }
    return -1;
  }

  private normalizeHeader(value: string): string {
    return value.trim().toLowerCase().replace(/[\s_-]+/g, '');
  }

  private getRouteIndexForCsvRow(rowIndex: number, snapshot: StateSnapshot): number | null {
    if (!snapshot.route.routeLoaded || snapshot.route.legs.length === 0) {
      return null;
    }

    if (this.csvRows.length === snapshot.route.legs.length) {
      return rowIndex < snapshot.route.legs.length ? rowIndex : null;
    }

    const csvSystem = this.normalizeSystemName(this.csvRowSystems[rowIndex]);
    if (!csvSystem) {
      return null;
    }

    for (let index = 0; index < snapshot.route.legs.length; index += 1) {
      if (this.normalizeSystemName(snapshot.route.legs[index].systemName) === csvSystem) {
        return index;
      }
    }

    return null;
  }

  private normalizeSystemName(value: string | null | undefined): string {
    return (value ?? '').trim().toLowerCase();
  }

  private loadExactPlotterDraft(): void {
    try {
      const raw = localStorage.getItem(EXACT_PLOTTER_STORAGE_KEY);
      if (!raw) {
        return;
      }

      const parsed = JSON.parse(raw) as {
        source?: string;
        destination?: string;
        shipBuild?: string;
        cargo?: number;
        fuelReserveSize?: number;
      };

      this.exactSource = typeof parsed.source === 'string' ? parsed.source : '';
      this.exactDestination = typeof parsed.destination === 'string' ? parsed.destination : '';
      this.exactShipBuild = typeof parsed.shipBuild === 'string' ? parsed.shipBuild : '';
      this.exactCargo = typeof parsed.cargo === 'number' ? parsed.cargo : 0;
      this.exactFuelReserveSize = typeof parsed.fuelReserveSize === 'number' ? parsed.fuelReserveSize : 0;
    } catch {
      this.exactSource = '';
      this.exactDestination = '';
      this.exactShipBuild = '';
      this.exactCargo = 0;
      this.exactFuelReserveSize = 0;
    }
  }

  private persistExactPlotterDraft(snapshot: StateSnapshot): void {
    const source = this.exactSource.trim() || snapshot.location.starSystem?.trim() || '';
    const destination = this.exactDestination.trim();
    const shipBuild = this.exactShipBuild.trim();

    this.exactSource = source;
    this.exactDestination = destination;
    this.exactShipBuild = shipBuild;

    try {
      localStorage.setItem(EXACT_PLOTTER_STORAGE_KEY, JSON.stringify({
        source,
        destination,
        shipBuild,
        cargo: this.exactCargo,
        fuelReserveSize: this.exactFuelReserveSize,
      }));
    } catch {
      // ignore storage errors
    }
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

      const routes = parsed
        .filter((entry): entry is SavedRouteEntry => this.isSavedRouteEntry(entry))
        .slice(0, MAX_SAVED_ROUTES);

      this.savedRoutes = routes;
    } catch {
      this.savedRoutes = [];
    }
  }

  private async saveRouteToStorage(file: File, routeName: string): Promise<void> {
    try {
      const encodedData = await this.readFileAsBase64(file);
      const uploadedAt = new Date().toISOString();
      const existing = this.savedRoutes.filter(
        (route) => this.normalizeSystemName(route.routeName) !== this.normalizeSystemName(routeName)
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
      // ignore local save errors; route upload still succeeded
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

  private createSavedRouteId(routeName: string): string {
    const normalized = routeName.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    return `${normalized || 'route'}-${Date.now()}`;
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
