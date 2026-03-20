import { NgIf } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { AppHeaderComponent, AppSection } from './components/app-header.component';
import { ColonizationPanelComponent } from './components/colonization-panel.component';
import { GalaxyRoutePanelComponent } from './components/galaxy-route-panel.component';
import { LocationPanelComponent } from './components/location-panel.component';
import { MissionBoardPanelComponent } from './components/mission-board-panel.component';
import { ShipStatusPanelComponent } from './components/ship-status-panel.component';
import { TradeRecommendationsPanelComponent } from './components/trade-recommendations-panel.component';
import { RealtimeStateService } from './realtime-state.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    NgIf,
    AppHeaderComponent,
    ShipStatusPanelComponent,
    LocationPanelComponent,
    GalaxyRoutePanelComponent,
    MissionBoardPanelComponent,
    ColonizationPanelComponent,
    TradeRecommendationsPanelComponent,
  ],
  host: {
    '[class.dark-mode]': 'isDarkMode',
  },
  template: `
    <app-header
      appName="Elite Companion"
      [activeSection]="activeSection"
      (sectionChange)="onSectionChange($event)"
      (createApiKeyRequest)="onCreateApiKeyClicked()"
    ></app-header>

    <section class="key-output" *ngIf="createdApiKey">
      <p><strong>New Key (share only with that friend):</strong> {{ createdApiKey }}</p>
      <button type="button" (click)="copyCreatedApiKey()">Copy Key</button>
      <button type="button" (click)="dismissCreatedApiKey()">Dismiss</button>
    </section>

    <section class="boot-status" *ngIf="keyActionMessage">
      <p>{{ keyActionMessage }}</p>
    </section>

    <main *ngIf="state.snapshot() as snapshot; else loadingState">
      <section class="hud" *ngIf="activeSection === 'route-planner'">
        <section class="left-column">
          <app-ship-status-panel
            [snapshot]="snapshot"
            [isDarkMode]="isDarkMode"
            (themeToggle)="toggleTheme()"
          />
        </section>

        <section class="right-column">
          <app-location-panel
            [snapshot]="snapshot"
            [isConnected]="state.isConnected()"
            [lastError]="state.lastError()"
          />
          <app-galaxy-route-panel [snapshot]="snapshot" />
        </section>
      </section>

      <section class="mission-layout" *ngIf="activeSection === 'mission-board'">
        <app-mission-board-panel [snapshot]="snapshot" />
      </section>

      <section class="mission-layout" *ngIf="activeSection === 'colonization'">
        <app-colonization-panel [snapshot]="snapshot" />
      </section>

      <section class="mission-layout" *ngIf="activeSection === 'trade-recommendations'">
        <app-trade-recommendations-panel [snapshot]="snapshot" />
      </section>
    </main>

    <ng-template #loadingState>
      <section class="boot-status">
        <p>{{ state.lastError() || 'Waiting for backend state...' }}</p>
      </section>
    </ng-template>
  `,
  styles: `
    :host {
      --app-bg: linear-gradient(145deg, #d8d8d8 0%, #cfcfcf 100%);
      --app-text: #111;
      --panel-bg: #f2f2f2;
      --panel-border: #0a0a0a;
      --button-bg: #fff;
      --button-text: #111;
      --meter-bg: #efefef;
      --meter-fill: #070707;
      --table-bg: #fff;
      --table-head-bg: #e8e8e8;
      --table-border: #222;
      --error-color: #8b0000;
      display: block;
      font-family: "Rajdhani", "Bahnschrift", "Trebuchet MS", sans-serif;
      color: var(--app-text);
      background: var(--app-bg);
      min-height: 100vh;
      padding: 24px 18px;
      box-sizing: border-box;
    }

    :host.dark-mode {
      --app-bg: linear-gradient(145deg, #0f1c32 0%, #0b1324 100%);
      --app-text: #deebff;
      --panel-bg: #142642;
      --panel-border: #31507f;
      --button-bg: #1d355a;
      --button-text: #deebff;
      --meter-bg: #1a2d4b;
      --meter-fill: linear-gradient(90deg, #3f81ff 0%, #25c48c 100%);
      --table-bg: #152844;
      --table-head-bg: #1f3559;
      --table-border: #36507d;
      --error-color: #ffb8c2;
    }

    .hud {
      width: 100%;
      max-width: 100%;
      margin: 0;
      display: grid;
      grid-template-columns: minmax(320px, 32%) minmax(0, 1fr);
      gap: 10px;
      align-items: stretch;
    }

    .left-column,
    .right-column {
      display: grid;
      gap: 10px;
    }

    .left-column {
      grid-template-rows: auto;
    }

    .right-column {
      grid-template-rows: auto auto;
    }

    .boot-status {
      max-width: 920px;
      margin: 24px auto 0;
      border: 4px solid var(--panel-border);
      background: var(--panel-bg);
      padding: 14px 16px;
      font-size: 1.15rem;
    }

    .mission-layout {
      width: 100%;
      max-width: 100%;
    }

    .key-output {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      border: 4px solid var(--panel-border);
      background: var(--panel-bg);
      padding: 10px 12px;
      margin-bottom: 10px;
    }

    .key-output p {
      margin: 0;
      font-size: 1rem;
    }

    button {
      border: 3px solid var(--panel-border);
      background: var(--button-bg);
      color: var(--button-text);
      padding: 4px 8px;
      font-size: 0.95rem;
      font-weight: 700;
      cursor: pointer;
    }

    @media (max-width: 980px) {
      .hud {
        grid-template-columns: 1fr;
      }

      .left-column,
      .right-column {
        grid-template-rows: auto;
      }
    }
  `,
})
export class App implements OnInit, OnDestroy {
  readonly state = inject(RealtimeStateService);
  activeSection: AppSection = 'route-planner';
  isDarkMode = false;
  createdApiKey: string | null = null;
  keyActionMessage: string | null = null;
  private creatingApiKey = false;
  private static readonly THEME_STORAGE_KEY = 'elite-companion-theme';

  ngOnInit(): void {
    this.loadTheme();
    this.state.start();
  }

  ngOnDestroy(): void {
    this.state.stop();
  }

  toggleTheme(): void {
    this.isDarkMode = !this.isDarkMode;
    this.persistTheme();
  }

  onSectionChange(section: AppSection): void {
    this.activeSection = section;
  }

  onCreateApiKeyClicked(): void {
    if (this.creatingApiKey) {
      return;
    }

    const label = window.prompt('Friend label/name for this API key:');
    if (!label?.trim()) {
      return;
    }

    const existingAdminKey = this.state.getAdminKey();
    const adminKeyPrompt = existingAdminKey
      ? 'Admin API key (leave empty to use saved one):'
      : 'Admin API key:';
    const adminKeyInput = window.prompt(adminKeyPrompt) ?? '';
    const adminKey = adminKeyInput.trim() || existingAdminKey;
    if (!adminKey) {
      this.keyActionMessage = 'Admin API key is required to create friend keys.';
      return;
    }

    this.state.setAdminKey(adminKey);
    this.creatingApiKey = true;
    this.keyActionMessage = 'Creating API key...';

    this.state.createApiKey(label, adminKey).subscribe({
      next: (created) => {
        this.createdApiKey = created.apiKey;
        this.keyActionMessage = `Created key for ${created.label} (fingerprint: ${created.keyFingerprint}).`;
        this.creatingApiKey = false;
      },
      error: () => {
        this.keyActionMessage = 'Could not create API key. Check admin key/backend.';
        this.creatingApiKey = false;
      },
    });
  }

  copyCreatedApiKey(): void {
    const value = this.createdApiKey?.trim();
    if (!value) {
      return;
    }

    void this.copyToClipboard(value)
      .then(() => {
        this.keyActionMessage = 'API key copied to clipboard.';
      })
      .catch(() => {
        this.keyActionMessage = 'Could not copy API key.';
      });
  }

  dismissCreatedApiKey(): void {
    this.createdApiKey = null;
  }

  private loadTheme(): void {
    try {
      const savedTheme = localStorage.getItem(App.THEME_STORAGE_KEY);
      if (savedTheme === 'dark') {
        this.isDarkMode = true;
        return;
      }
      if (savedTheme === 'light') {
        this.isDarkMode = false;
        return;
      }

      this.isDarkMode = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
    } catch {
      this.isDarkMode = false;
    }
  }

  private persistTheme(): void {
    try {
      localStorage.setItem(App.THEME_STORAGE_KEY, this.isDarkMode ? 'dark' : 'light');
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
}
