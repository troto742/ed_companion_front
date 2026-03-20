import { DatePipe, NgIf } from '@angular/common';
import { Component, Input } from '@angular/core';
import { StateSnapshot } from '../state.types';

@Component({
  selector: 'app-location-panel',
  standalone: true,
  imports: [NgIf, DatePipe],
  template: `
    <article class="panel compact" *ngIf="snapshot as snapshot">
      <div class="location-head">
        <h2>Location</h2>
        <div class="badge" [class.online]="isConnected" [class.offline]="!isConnected">
          {{ isConnected ? 'Live' : 'Offline' }}
        </div>
      </div>
      <p><strong>System:</strong> {{ snapshot.location.starSystem ?? '------' }}</p>
      <p><strong>Body:</strong> {{ snapshot.location.bodyName ?? '------' }}</p>
      <p><strong>Station:</strong> {{ snapshot.location.stationName ?? '------' }}</p>
      <p class="meta"><strong>Updated:</strong> {{ snapshot.location.updatedAt | date:'mediumTime' }}</p>
      <p class="error" *ngIf="lastError">{{ lastError }}</p>
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

    .location-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      margin-bottom: 6px;
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

    .badge {
      border: 3px solid var(--panel-border);
      padding: 4px 10px;
      font-weight: 600;
      font-size: 1rem;
      min-width: 72px;
      text-align: center;
    }

    .badge.online {
      background: #d4ffd7;
    }

    .badge.offline {
      background: #ffd6d6;
    }

    .error {
      color: var(--error-color);
      font-size: 1.05rem;
      font-weight: 700;
    }
  `,
})
export class LocationPanelComponent {
  @Input({ required: true }) snapshot!: StateSnapshot;
  @Input() isConnected = false;
  @Input() lastError: string | null = null;
}

