import { DatePipe, NgFor, NgIf, SlicePipe } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import {
  FriendRequestSummary,
  FriendSummary,
  FriendsDashboard,
  RealtimeStateService,
} from '../realtime-state.service';

@Component({
  selector: 'app-friends-panel',
  standalone: true,
  imports: [NgIf, NgFor, DatePipe, SlicePipe],
  template: `
    <article class="panel">
      <header class="panel-head">
        <div>
          <h2>Friends</h2>
          <p class="meta" *ngIf="dashboard">
            Active window: {{ dashboard.activeWindowDays }} days | Users: {{ dashboard.users.length }}
          </p>
        </div>
        <button type="button" class="action-btn" (click)="loadFriends()" [disabled]="isLoading">
          {{ isLoading ? 'Refreshing...' : 'Refresh' }}
        </button>
      </header>

      <p class="error" *ngIf="errorMessage">{{ errorMessage }}</p>

      <section class="section" *ngIf="dashboard as data">
        <h3>Requests</h3>
        <div class="request-row" *ngIf="data.pendingIncoming.length > 0; else noIncoming">
          <article class="request-card" *ngFor="let request of data.pendingIncoming">
            <strong>{{ request.fromTenantLabel }}</strong>
            <span>requested friendship</span>
            <button type="button" class="action-btn" (click)="acceptRequest(request)" [disabled]="isBusy(request.fromTenantId)">
              Accept
            </button>
          </article>
        </div>
        <ng-template #noIncoming>
          <p class="placeholder">No incoming requests.</p>
        </ng-template>

        <div class="request-row" *ngIf="data.pendingOutgoing.length > 0">
          <article class="request-card muted" *ngFor="let request of data.pendingOutgoing">
            <strong>{{ request.toTenantLabel }}</strong>
            <span>pending response</span>
          </article>
        </div>
      </section>

      <section class="section" *ngIf="dashboard as data">
        <h3>Active Users</h3>
        <div class="user-grid" *ngIf="data.users.length > 0; else noUsers">
          <article class="user-card" *ngFor="let user of data.users">
            <header class="card-head">
              <div>
                <h4>{{ user.tenantLabel }}</h4>
                <p class="meta">{{ user.keyFingerprint }} | {{ user.lastSeenAt | date:'short' }}</p>
              </div>
              <span class="badge" [class.online]="user.activeStatus === 'online'">{{ user.activeStatus }}</span>
            </header>

            <dl>
              <div>
                <dt>Ship</dt>
                <dd>{{ formatShip(user) }}</dd>
              </div>
              <div>
                <dt>System</dt>
                <dd>{{ user.location.starSystem ?? '-' }}</dd>
              </div>
              <div>
                <dt>Fuel</dt>
                <dd>{{ formatFuel(user) }}</dd>
              </div>
              <div>
                <dt>Hull / Shields</dt>
                <dd>{{ formatPercent(user.ship.hull) }} / {{ formatPercent(user.ship.shields) }}</dd>
              </div>
            </dl>

            <button
              type="button"
              class="action-btn"
              *ngIf="user.relationshipStatus === 'none'"
              (click)="sendRequest(user)"
              [disabled]="isBusy(user.tenantId)"
            >
              Send Friend Request
            </button>
            <button
              type="button"
              class="action-btn"
              *ngIf="user.relationshipStatus === 'pending_received'"
              (click)="acceptUser(user)"
              [disabled]="isBusy(user.tenantId)"
            >
              Accept Request
            </button>
            <p class="status-copy" *ngIf="user.relationshipStatus === 'pending_sent'">Request sent.</p>
            <p class="status-copy" *ngIf="user.relationshipStatus === 'accepted'">Friend.</p>
          </article>
        </div>
      </section>

      <section class="section" *ngIf="dashboard as data">
        <h3>Friend Status</h3>
        <div class="friend-grid" *ngIf="data.friends.length > 0; else noFriends">
          <article class="friend-card" *ngFor="let friend of data.friends">
            <header class="card-head">
              <div>
                <h4>{{ friend.tenantLabel }}</h4>
                <p class="meta">{{ friend.activeStatus }} | {{ friend.lastSeenAt | date:'short' }}</p>
              </div>
              <span class="badge">{{ friend.missions.active.length }} missions</span>
            </header>

            <div class="status-grid">
              <p><strong>Ship:</strong> {{ formatShip(friend) }}</p>
              <p><strong>System:</strong> {{ friend.location.starSystem ?? '-' }}</p>
              <p><strong>Station:</strong> {{ friend.location.stationName ?? '-' }}</p>
              <p><strong>Fuel:</strong> {{ formatFuel(friend) }}</p>
              <p><strong>Cargo:</strong> {{ formatInteger(friend.ship.cargo) }}</p>
              <p><strong>Hull:</strong> {{ formatPercent(friend.ship.hull) }}</p>
            </div>

            <div class="mission-list" *ngIf="friend.missions.active.length > 0">
              <p class="mini-title">Accepted Missions</p>
              <p *ngFor="let mission of friend.missions.active | slice:0:5">
                {{ mission.localizedName ?? mission.name ?? 'Unknown mission' }}
              </p>
            </div>
          </article>
        </div>
      </section>
    </article>

    <ng-template #noUsers>
      <p class="placeholder">No active users detected in the last month.</p>
    </ng-template>

    <ng-template #noFriends>
      <p class="placeholder">No accepted friends yet.</p>
    </ng-template>
  `,
  styles: `
    .panel {
      background: var(--panel-bg);
      border: 5px solid var(--panel-border);
      padding: 14px;
      box-sizing: border-box;
    }

    .panel-head,
    .card-head,
    .request-card {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 10px;
      flex-wrap: wrap;
    }

    h2,
    h3,
    h4,
    p {
      margin: 0;
    }

    h2,
    h3 {
      text-transform: uppercase;
    }

    h2 {
      font-size: 1.8rem;
    }

    h3 {
      font-size: 1.15rem;
      margin-bottom: 8px;
    }

    h4 {
      font-size: 1.1rem;
    }

    .section {
      margin-top: 14px;
    }

    .meta,
    .placeholder,
    .status-copy {
      opacity: 0.82;
      font-size: 0.95rem;
    }

    .error {
      margin-top: 8px;
      color: var(--error-color);
      font-weight: 700;
    }

    .user-grid,
    .friend-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 10px;
    }

    .user-card,
    .friend-card,
    .request-card {
      border: 3px solid var(--panel-border);
      background: color-mix(in srgb, var(--panel-bg) 88%, #ffffff 12%);
      padding: 10px;
    }

    .request-row {
      display: grid;
      gap: 8px;
      margin-bottom: 8px;
    }

    .muted {
      opacity: 0.78;
    }

    dl,
    .status-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
      margin: 10px 0;
    }

    dt {
      font-weight: 700;
      text-transform: uppercase;
      font-size: 0.78rem;
      opacity: 0.78;
    }

    dd {
      margin: 0;
      overflow-wrap: anywhere;
    }

    .badge {
      border: 2px solid var(--panel-border);
      padding: 2px 8px;
      text-transform: uppercase;
      font-weight: 700;
      font-size: 0.78rem;
    }

    .badge.online {
      background: #d5f7dc;
      color: #0a3d1b;
    }

    .action-btn {
      border: 2px solid var(--panel-border);
      background: var(--button-bg);
      color: var(--button-text);
      padding: 4px 8px;
      font-weight: 700;
      cursor: pointer;
    }

    .mission-list {
      display: grid;
      gap: 4px;
      margin-top: 8px;
    }

    .mini-title {
      font-weight: 700;
      text-transform: uppercase;
      font-size: 0.82rem;
    }

    @media (max-width: 720px) {
      dl,
      .status-grid {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class FriendsPanelComponent implements OnInit {
  private readonly state = inject(RealtimeStateService);
  dashboard: FriendsDashboard | null = null;
  isLoading = false;
  errorMessage = '';
  private readonly busyTenantIds = new Set<string>();

  ngOnInit(): void {
    this.loadFriends();
  }

  loadFriends(): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.state.getFriendsDashboard().subscribe({
      next: (dashboard) => {
        this.dashboard = dashboard;
        this.isLoading = false;
      },
      error: () => {
        this.errorMessage = 'Could not load Friends data.';
        this.isLoading = false;
      },
    });
  }

  sendRequest(user: FriendSummary): void {
    this.busyTenantIds.add(user.tenantId);
    this.state.sendFriendRequest(user.tenantId).subscribe({
      next: () => {
        this.busyTenantIds.delete(user.tenantId);
        this.loadFriends();
      },
      error: () => {
        this.busyTenantIds.delete(user.tenantId);
        this.errorMessage = 'Could not send friend request.';
      },
    });
  }

  acceptUser(user: FriendSummary): void {
    this.acceptByTenantId(user.tenantId);
  }

  acceptRequest(request: FriendRequestSummary): void {
    this.acceptByTenantId(request.fromTenantId);
  }

  isBusy(tenantId: string): boolean {
    return this.busyTenantIds.has(tenantId);
  }

  formatShip(friend: FriendSummary): string {
    return [friend.ship.shipName, friend.ship.shipType, friend.ship.shipIdent]
      .filter((value): value is string => Boolean(value?.trim()))
      .join(' / ') || '-';
  }

  formatFuel(friend: FriendSummary): string {
    const fuel = friend.ship.fuel.main;
    const capacity = friend.ship.fuelCapacityMain;
    if (fuel === null) {
      return '-';
    }

    if (capacity !== null && capacity > 0) {
      return `${fuel.toFixed(1)} / ${capacity.toFixed(1)} T`;
    }

    return `${fuel.toFixed(1)} T`;
  }

  formatPercent(value: number | null): string {
    if (value === null || Number.isNaN(value)) {
      return '-';
    }

    return `${Math.round(value * 100)}%`;
  }

  formatInteger(value: number | null): string {
    if (value === null || Number.isNaN(value)) {
      return '-';
    }

    return Math.round(value).toLocaleString('en-US');
  }

  private acceptByTenantId(fromTenantId: string): void {
    this.busyTenantIds.add(fromTenantId);
    this.state.acceptFriendRequest(fromTenantId).subscribe({
      next: () => {
        this.busyTenantIds.delete(fromTenantId);
        this.loadFriends();
      },
      error: () => {
        this.busyTenantIds.delete(fromTenantId);
        this.errorMessage = 'Could not accept friend request.';
      },
    });
  }
}
