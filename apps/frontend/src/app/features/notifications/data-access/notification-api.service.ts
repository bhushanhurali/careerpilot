import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map } from 'rxjs';

import type { ApiResponse } from '../../../core/auth/auth.models';
import { API_BASE_URL } from '../../../core/config/api.config';
import type { NotificationItem, NotificationQuery } from './notification.models';

@Injectable({ providedIn: 'root' })
export class NotificationApiService {
  private readonly http = inject(HttpClient);
  private readonly url = `${API_BASE_URL}/notifications`;

  list(query: NotificationQuery) {
    return this.http
      .get<
        ApiResponse<{ notifications: NotificationItem[]; unreadCount: number }>
      >(this.url, { params: query })
      .pipe(
        map((response) => ({
          ...this.unwrap(response),
          total: Number(response.meta['total'] ?? 0),
        })),
      );
  }

  markAsRead(id: string) {
    return this.http
      .patch<
        ApiResponse<{ notification: { id: string; readAt: string } }>
      >(`${this.url}/${id}/read`, null)
      .pipe(map((response) => this.unwrap(response).notification));
  }

  private unwrap<T>(response: ApiResponse<T>): T {
    if (!response.success || !response.data) throw new Error('Notification request failed.');
    return response.data;
  }
}
