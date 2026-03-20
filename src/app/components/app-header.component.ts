import { Component, EventEmitter, Input, Output } from '@angular/core';

export type AppSection = 'route-planner' | 'mission-board' | 'colonization' | 'trade-recommendations';

@Component({
  selector: 'app-header',
  standalone: true,
  template: `
    <header class="app-header">
      <div class="header-main">
        <h1>{{ appName }}</h1>
        <nav class="nav-tabs" aria-label="Main navigation">
          <button
            type="button"
            class="nav-tab"
            [class.active]="activeSection === 'route-planner'"
            (click)="sectionChange.emit('route-planner')"
          >
            System Route Planner
          </button>
          <button
            type="button"
            class="nav-tab"
            [class.active]="activeSection === 'mission-board'"
            (click)="sectionChange.emit('mission-board')"
          >
            Mission Board
          </button>
          <button
            type="button"
            class="nav-tab"
            [class.active]="activeSection === 'colonization'"
            (click)="sectionChange.emit('colonization')"
          >
            Colonization
          </button>
          <button
            type="button"
            class="nav-tab"
            [class.active]="activeSection === 'trade-recommendations'"
            (click)="sectionChange.emit('trade-recommendations')"
          >
            Trade Recommendations
          </button>
        </nav>
      </div>
      <div class="header-actions">
        <button type="button" class="header-btn" (click)="createApiKeyRequest.emit()">Create API Key</button>
        <button type="button" class="header-btn" (click)="logoutRequest.emit()">Change API Key</button>
      </div>
    </header>
  `,
  styles: `
    .app-header {
      width: 100%;
      max-width: 100%;
      margin: 0 0 10px;
      border: 5px solid var(--panel-border);
      background: var(--panel-bg);
      padding: 10px 14px;
      box-sizing: border-box;
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 10px;
      flex-wrap: wrap;
    }

    .header-main {
      display: grid;
      gap: 8px;
    }

    .app-header h1 {
      margin: 0;
      font-size: 1.8rem;
      letter-spacing: 0.8px;
      text-transform: uppercase;
    }

    .header-btn {
      border: 3px solid var(--panel-border);
      background: var(--button-bg);
      color: var(--button-text);
      padding: 6px 10px;
      font-size: 1rem;
      font-weight: 700;
      cursor: pointer;
      white-space: nowrap;
    }

    .header-actions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      justify-content: flex-end;
    }

    .nav-tabs {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }

    .nav-tab {
      border: 3px solid var(--panel-border);
      background: transparent;
      color: var(--button-text);
      padding: 4px 10px;
      font-size: 0.92rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.3px;
      cursor: pointer;
    }

    .nav-tab.active {
      background: var(--button-bg);
    }
  `,
})
export class AppHeaderComponent {
  @Input() appName = 'Elite Companion';
  @Input() activeSection: AppSection = 'route-planner';
  @Output() createApiKeyRequest = new EventEmitter<void>();
  @Output() logoutRequest = new EventEmitter<void>();
  @Output() sectionChange = new EventEmitter<AppSection>();
}
