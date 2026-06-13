import { get, post, patch, del } from "./client";

// ---------- Types ----------

export type NotificationType = "BookingCreated" | "BookingCancelled" | "RestaurantNearlyFull";

export interface AdminNotificationDto {
  id: number;
  restaurantId: number;
  restaurantName: string;
  bookingId: number | null;
  bookingRef: string;
  type: NotificationType;
  customerName: string;
  bookingDate: string;
  seats: number;
  isRead: boolean;
  createdAt: string;
  pushSentAt: string | null;
  pushError: string | null;
}

export interface NotificationsPage {
  items: AdminNotificationDto[];
  totalCount: number;
}

export interface PushSubscribeRequest {
  endpoint: string;
  p256dh: string;
  auth: string;
}

// ---------- Functions ----------

export async function getNotifications(params: {
  restaurantId?: number;
  type?: string;
  unreadOnly?: boolean;
  page?: number;
  pageSize?: number;
}): Promise<NotificationsPage | null> {
  try {
    const p = new URLSearchParams();
    if (params.restaurantId != null) p.set("restaurantId", String(params.restaurantId));
    if (params.type) p.set("type", params.type);
    if (params.unreadOnly) p.set("unreadOnly", "true");
    if (params.page != null) p.set("page", String(params.page));
    if (params.pageSize != null) p.set("pageSize", String(params.pageSize));
    const query = p.toString() ? `?${p}` : "";
    const res = await get(`/admin/notifications${query}`);
    if (!res.ok) throw new Error("Failed to fetch notifications");
    return await res.json();
  } catch (err) {
    console.error("getNotifications error:", err);
    return null;
  }
}

export async function getUnreadCount(restaurantId?: number): Promise<number> {
  try {
    const query = restaurantId != null ? `?restaurantId=${restaurantId}` : "";
    const res = await get(`/admin/notifications/unread-count${query}`);
    if (!res.ok) return 0;
    const data = await res.json();
    return data.count ?? 0;
  } catch {
    return 0;
  }
}

export async function markRead(notificationId: number): Promise<void> {
  try {
    await patch(`/admin/notifications/${notificationId}/read`);
  } catch (err) {
    console.error("markRead error:", err);
  }
}

export async function markAllRead(restaurantId: number): Promise<void> {
  try {
    await patch(`/admin/notifications/read-all?restaurantId=${restaurantId}`);
  } catch (err) {
    console.error("markAllRead error:", err);
  }
}

export async function getVapidPublicKey(): Promise<string | null> {
  try {
    const res = await get("/admin/push/vapid-public-key");
    if (res.status === 204) return null;
    if (!res.ok) return null;
    const data = await res.json();
    return data.publicKey ?? null;
  } catch (err) {
    console.error("getVapidPublicKey error:", err);
    return null;
  }
}

export async function subscribePush(
  restaurantId: number,
  sub: PushSubscribeRequest
): Promise<void> {
  try {
    await post(`/admin/push/subscribe?restaurantId=${restaurantId}`, sub);
  } catch (err) {
    console.error("subscribePush error:", err);
  }
}

export async function unsubscribePush(endpoint: string): Promise<void> {
  try {
    await del("/admin/push/subscribe", { body: endpoint });
  } catch (err) {
    console.error("unsubscribePush error:", err);
  }
}

export async function deleteNotification(id: number): Promise<void> {
  try {
    await del(`/admin/notifications/${id}`);
  } catch (err) {
    console.error("deleteNotification error:", err);
  }
}

export async function deleteNotifications(ids: number[]): Promise<void> {
  try {
    await del("/admin/notifications", { body: ids });
  } catch (err) {
    console.error("deleteNotifications error:", err);
  }
}

export async function deleteAllNotifications(params: {
  restaurantId?: number;
  type?: string;
  unreadOnly?: boolean;
}): Promise<void> {
  try {
    const p = new URLSearchParams();
    if (params.restaurantId != null) p.set("restaurantId", String(params.restaurantId));
    if (params.type) p.set("type", params.type);
    if (params.unreadOnly) p.set("unreadOnly", "true");
    const query = p.toString() ? `?${p}` : "";
    await del(`/admin/notifications/all${query}`);
  } catch (err) {
    console.error("deleteAllNotifications error:", err);
  }
}
