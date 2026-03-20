import { NgFor, NgIf } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { StateSnapshot } from '../state.types';

@Component({
  selector: 'app-ship-status-panel',
  standalone: true,
  imports: [NgIf, NgFor],
  template: `
    <article class="panel ship-panel" *ngIf="snapshot as snapshot">
      <div class="ship-head">
        <h2><span class="ship-icon">&#x1F680;</span> Ship Status</h2>
        <button type="button" class="theme-btn" (click)="onThemeToggle()">
          {{ isDarkMode ? 'Light' : 'Dark' }}
        </button>
      </div>

      <section class="ship-block">
        <h3>Vessel</h3>
        <div class="kv-row">
          <span>Name</span>
          <strong>{{ formatText(snapshot.ship.shipName) }}</strong>
        </div>
        <div class="kv-row">
          <span>Identifier</span>
          <strong>{{ formatText(snapshot.ship.shipIdent) }}</strong>
        </div>
        <div class="kv-row">
          <span>Model</span>
          <strong>{{ formatShipModel(snapshot.ship.shipType) }}</strong>
        </div>
        <div class="kv-row">
          <span>Ship ID</span>
          <strong>{{ formatInteger(snapshot.ship.shipId) }}</strong>
        </div>
      </section>

      <section class="ship-block">
        <h3>Performance</h3>
        <div class="kv-row">
          <span>Max Jump Range</span>
          <strong>{{ formatLy(snapshot.ship.maxJumpRange) }}</strong>
        </div>
        <div class="kv-row">
          <span>Last Jump</span>
          <strong>{{ formatLy(snapshot.ship.lastJumpDistance) }}</strong>
        </div>
        <div class="kv-row">
          <span>Cargo</span>
          <strong>{{ formatCargo(snapshot) }}</strong>
        </div>
        <div class="kv-row">
          <span>Fuel Capacity</span>
          <strong>{{ formatFuelCapacity(snapshot) }}</strong>
        </div>
      </section>

      <section class="ship-block">
        <div class="ship-line">
          <span>Hull Integrity</span>
          <strong>{{ formatPercent(getHullPercent(snapshot)) }}</strong>
        </div>
        <div class="meter ship-meter hull-meter">
          <div class="fill" [style.width.%]="getHullPercent(snapshot)"></div>
        </div>
      </section>

      <section class="ship-block">
        <div class="ship-line">
          <span>Shields</span>
          <strong>{{ formatPercent(getShieldsPercent(snapshot)) }}</strong>
        </div>
        <div class="meter ship-meter shield-meter">
          <div class="fill" [style.width.%]="getShieldsPercent(snapshot)"></div>
        </div>
        <p class="shield-state">Status: {{ getShieldStateLabel(snapshot) }}</p>
      </section>

      <section class="ship-block">
        <h3>Fuel</h3>
        <div class="kv-row">
          <span>Main Tank</span>
          <strong>{{ formatTons(snapshot.ship.fuel.main) }}</strong>
        </div>
        <div class="kv-row">
          <span>Reserve</span>
          <strong>{{ formatTons(snapshot.ship.fuel.reserve) }}</strong>
        </div>
        <div class="kv-row total">
          <span>Total</span>
          <strong>{{ formatTons(getFuelTotal(snapshot)) }}</strong>
        </div>
      </section>

      <section class="ship-block">
        <h3>Active Status</h3>
        <div class="status-grid" *ngIf="getActiveFlags(snapshot) as activeFlags">
          <span class="status-tag" *ngFor="let flag of activeFlags">{{ flag }}</span>
          <p class="placeholder" *ngIf="activeFlags.length === 0">No active flags</p>
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

    .ship-panel {
      color: var(--app-text);
      box-shadow: none;
      height: 100%;
    }

    .ship-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      border-bottom: 1px solid rgba(120, 120, 120, 0.35);
      padding-bottom: 8px;
      margin-bottom: 12px;
    }

    .ship-panel h2 {
      margin: 0;
      font-size: 1.8rem;
      text-transform: uppercase;
      letter-spacing: 1px;
      font-weight: 700;
    }

    .ship-icon {
      font-size: 0.95rem;
      margin-right: 6px;
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

    .theme-btn {
      border-width: 3px;
      padding: 3px 9px;
      font-size: 0.9rem;
      min-width: 70px;
    }

    .ship-block {
      background: rgba(120, 120, 120, 0.08);
      border: 1px solid rgba(120, 120, 120, 0.2);
      border-radius: 8px;
      padding: 10px;
      margin-top: 10px;
    }

    .ship-block h3 {
      margin: 0 0 8px;
      font-size: 1.2rem;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      opacity: 0.85;
    }

    .ship-line {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      font-size: 1.05rem;
      margin-bottom: 8px;
    }

    .ship-line strong {
      color: inherit;
    }

    .ship-meter {
      position: relative;
      height: 20px;
      border: 1px solid rgba(120, 120, 120, 0.5);
      background: var(--meter-bg);
      overflow: hidden;
    }

    .ship-meter .fill {
      position: absolute;
      inset: 0 auto 0 0;
      background: var(--meter-fill);
      transition: width 250ms ease;
    }

    .shield-meter .fill {
      background: var(--meter-fill);
    }

    .shield-state {
      margin: 6px 0 0;
      font-size: 0.95rem;
      opacity: 0.85;
    }

    .kv-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      padding: 5px 0;
      border-bottom: 1px solid rgba(150, 177, 221, 0.12);
      font-size: 1.05rem;
    }

    .kv-row.total {
      border-bottom: 0;
      padding-top: 7px;
      margin-top: 2px;
      color: #f2f7ff;
      font-weight: 700;
    }

    .status-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .status-tag {
      border: 3px solid var(--panel-border);
      border-radius: 999px;
      background: var(--button-bg);
      color: var(--button-text);
      padding: 4px 10px;
      font-size: 0.92rem;
      font-weight: 700;
    }

    .placeholder {
      color: inherit;
      opacity: 0.8;
      font-size: 0.95rem;
      margin: 0;
    }
  `,
})
export class ShipStatusPanelComponent {
  @Input({ required: true }) snapshot!: StateSnapshot;
  @Input() isDarkMode = false;
  @Output() themeToggle = new EventEmitter<void>();

  onThemeToggle(): void {
    this.themeToggle.emit();
  }

  getActiveFlags(snapshot: StateSnapshot): string[] {
    return Object.entries(snapshot.ship.interpretedFlags)
      .filter(([, isActive]) => isActive)
      .map(([flag]) => this.humanizeFlag(flag));
  }

  getHullPercent(snapshot: StateSnapshot): number {
    return this.normalizePercent(snapshot.ship.hull);
  }

  getShieldsPercent(snapshot: StateSnapshot): number {
    const shieldValue =
      snapshot.ship.shields ?? (snapshot.ship.interpretedFlags['shieldsUp'] ? 100 : 0);

    return this.normalizePercent(shieldValue);
  }

  getShieldStateLabel(snapshot: StateSnapshot): string {
    return this.getShieldsPercent(snapshot) > 0 ? 'UP' : 'DOWN';
  }

  getFuelTotal(snapshot: StateSnapshot): number | null {
    const main = snapshot.ship.fuel.main;
    const reserve = snapshot.ship.fuel.reserve;

    if (main === null && reserve === null) {
      return null;
    }

    return (main ?? 0) + (reserve ?? 0);
  }

  formatPercent(value: number): string {
    return `${Math.round(this.normalizePercent(value))}%`;
  }

  formatTons(value: number | null): string {
    if (value === null || Number.isNaN(value)) {
      return '-';
    }

    return `${value.toFixed(1)}t`;
  }

  formatText(value: string | null): string {
    const normalized = value?.trim();
    return normalized ? normalized : '-';
  }

  formatShipModel(value: string | null): string {
    if (!value) {
      return '-';
    }

    const normalized = value
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase())
      .trim();
    return normalized || '-';
  }

  formatInteger(value: number | null): string {
    if (value === null || Number.isNaN(value) || !Number.isFinite(value)) {
      return '-';
    }

    return `${Math.trunc(value)}`;
  }

  formatLy(value: number | null): string {
    if (value === null || Number.isNaN(value) || !Number.isFinite(value)) {
      return '-';
    }

    return `${value.toFixed(2)} ly`;
  }

  formatCargo(snapshot: StateSnapshot): string {
    const current = snapshot.ship.cargo;
    const capacity = snapshot.ship.cargoCapacity;

    if (current === null && capacity === null) {
      return '-';
    }

    if (current !== null && capacity !== null && capacity > 0) {
      const percent = Math.max(0, Math.min(100, (current / capacity) * 100));
      return `${this.formatTons(current)} / ${this.formatTons(capacity)} (${Math.round(percent)}%)`;
    }

    return current !== null ? this.formatTons(current) : this.formatTons(capacity);
  }

  formatFuelCapacity(snapshot: StateSnapshot): string {
    const main = snapshot.ship.fuelCapacityMain;
    const reserve = snapshot.ship.fuelCapacityReserve;

    if (main === null && reserve === null) {
      return '-';
    }

    if (main !== null && reserve !== null) {
      return `${this.formatTons(main)} + ${this.formatTons(reserve)}`;
    }

    return main !== null ? this.formatTons(main) : this.formatTons(reserve);
  }

  private normalizePercent(value: number | null | undefined): number {
    if (value === null || value === undefined || Number.isNaN(value) || !Number.isFinite(value)) {
      return 0;
    }

    const normalized = value <= 1 ? value * 100 : value;
    return Math.max(0, Math.min(100, normalized));
  }

  private humanizeFlag(flag: string): string {
    return flag
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }
}
