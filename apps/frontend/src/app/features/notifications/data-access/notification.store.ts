import { HttpErrorResponse } from '@angular/common/http';
import { computed, DestroyRef, DOCUMENT, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import {
  catchError,
  EMPTY,
  filter,
  finalize,
  fromEvent,
  map,
  merge,
  Subject,
  switchMap,
  takeUntil,
  tap,
  timer,
} from 'rxjs';

import { AuthStore } from '../../../core/auth/auth.store';
import { NotificationApiService } from './notification-api.service';
import type { NotificationItem, NotificationQuery } from './notification.models';

@Injectable()
export class NotificationStore {
  private readonly destroyRef = inject(DestroyRef);
  private readonly api = inject(NotificationApiService);
  private readonly document = inject(DOCUMENT);
  private readonly auth = inject(AuthStore);
  private readonly userId = computed(() =>
    this.auth.isAuthenticated() ? (this.auth.user()?.id ?? null) : null,
  );
  private readonly refreshRequests = new Subject<void>();
  private readonly sessionEnded = new Subject<void>();
  private readonly items = signal<NotificationItem[]>([]);
  private readonly count = signal<number | null>(null);
  private readonly totalItems = signal(0);
  private readonly fetching = signal(false);
  private readonly loadError = signal<string | null>(null);
  private readonly writeError = signal<string | null>(null);
  private readonly readingId = signal<string | null>(null);
  private readonly inboxOpen = signal(false);
  private readonly listQuery = signal<NotificationQuery>({ page: 1, pageSize: 20, unread: false });

  readonly notifications = this.items.asReadonly();
  readonly unreadCount = this.count.asReadonly();
  readonly total = this.totalItems.asReadonly();
  readonly loading = this.fetching.asReadonly();
  readonly error = this.loadError.asReadonly();
  readonly actionError = this.writeError.asReadonly();
  readonly markingId = this.readingId.asReadonly();
  readonly query = this.listQuery.asReadonly();

  constructor() {
    toObservable(this.userId)
      .pipe(
        switchMap((userId) => {
          this.sessionEnded.next();
          this.count.set(null);
          this.clearList();
          if (!userId) return EMPTY;

          return merge(
            fromEvent(this.document, 'visibilitychange').pipe(map(() => true)),
            timer(0, 60_000).pipe(map(() => false)),
            this.refreshRequests.pipe(map(() => true)),
          ).pipe(
            filter((immediate) => immediate || (!this.loading() && !this.readingId())),
            switchMap(() =>
              this.document.hidden || this.userId() !== userId || this.readingId()
                ? EMPTY
                : this.load(),
            ),
          );
        }),
        takeUntilDestroyed(),
      )
      .subscribe();
  }

  openInbox(): void {
    this.inboxOpen.set(true);
    this.listQuery.set({ page: 1, pageSize: 20, unread: false });
    this.clearList();
    this.refresh();
  }

  closeInbox(): void {
    this.inboxOpen.set(false);
    this.clearList();
    this.refresh();
  }

  refresh(): void {
    this.refreshRequests.next();
  }

  setPage(page: number, pageSize: number): void {
    this.listQuery.update((query) => ({ ...query, page, pageSize }));
    this.items.set([]);
    this.refresh();
  }

  setUnread(unread: boolean): void {
    this.listQuery.update((query) => ({ ...query, page: 1, unread }));
    this.clearList();
    this.refresh();
  }

  markAsRead(id: string): void {
    if (!this.userId() || this.readingId()) return;
    this.writeError.set(null);
    this.readingId.set(id);
    this.refresh();
    this.api
      .markAsRead(id)
      .pipe(
        takeUntil(this.sessionEnded),
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.readingId.set(null)),
      )
      .subscribe({
        next: ({ readAt }) => {
          this.items.update((items) =>
            this.query().unread
              ? items.filter((item) => item.id !== id)
              : items.map((item) => (item.id === id ? { ...item, readAt } : item)),
          );
          this.readingId.set(null);
          this.refresh();
        },
        error: (error: unknown) => {
          if (error instanceof HttpErrorResponse && error.status === 404) {
            this.items.update((items) => items.filter((item) => item.id !== id));
            this.writeError.set('This notification is no longer available.');
          } else {
            this.writeError.set('Could not mark the notification as read. Try again.');
          }
          this.readingId.set(null);
          this.refresh();
        },
      });
  }

  private clearList(): void {
    this.items.set([]);
    this.totalItems.set(0);
    this.loadError.set(null);
    this.writeError.set(null);
  }

  private load() {
    const inbox = this.inboxOpen();
    const query = inbox ? this.query() : { page: 1, pageSize: 1, unread: true };
    this.fetching.set(true);
    this.loadError.set(null);
    return this.api.list(query).pipe(
      tap((result) => {
        this.count.set(result.unreadCount);
        if (!inbox || !this.inboxOpen()) return;
        const lastPage = Math.max(1, Math.ceil(result.total / query.pageSize));
        if (query.page > lastPage) {
          queueMicrotask(() => {
            if (this.inboxOpen() && this.query() === query) this.setPage(lastPage, query.pageSize);
          });
          return;
        }
        this.totalItems.set(result.total);
        this.items.set(result.notifications);
      }),
      catchError(() => {
        this.count.set(null);
        if (inbox && this.inboxOpen()) {
          this.items.set([]);
          this.loadError.set('Could not load notifications.');
        }
        return EMPTY;
      }),
      finalize(() => this.fetching.set(false)),
    );
  }
}
