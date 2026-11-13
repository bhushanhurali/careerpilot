import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, OnDestroy, OnInit } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule } from '@angular/material/paginator';
import { RouterLink } from '@angular/router';

import { NotificationStore } from '../data-access/notification.store';

@Component({
  selector: 'cp-notification-center',
  imports: [
    DatePipe,
    MatButtonModule,
    MatButtonToggleModule,
    MatIconModule,
    MatPaginatorModule,
    RouterLink,
  ],
  templateUrl: './notification-center.component.html',
  styleUrl: './notification-center.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotificationCenterComponent implements OnInit, OnDestroy {
  protected readonly store = inject(NotificationStore);

  ngOnInit(): void {
    this.store.openInbox();
  }

  ngOnDestroy(): void {
    this.store.closeInbox();
  }
}
