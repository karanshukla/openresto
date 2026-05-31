import { get, post, patch, del, put } from "./client";

// ---------- Types ----------

export interface AdminOverviewDto {
  totalRestaurants: number;
  totalBookings: number;
  todayBookings: number;
  totalSeats: number;
  activeHoldsCount?: number;
  pausedRestaurantsCount?: number;
  occupancyData?: number[];
  todayBookingsList?: BookingDetailDto[];
}

export interface BookingSummaryDto {
  id: number;
  date: string;
  endTime?: string;
  customerEmail: string;
  customerName?: string;
  seats: number;
  restaurantName: string;
  bookingRef: string;
  isCancelled?: boolean;
}

export interface AdminDashboardStats {
  todayCount: number;
  activeHoldsCount: number;
  pausedCount: number;
  totalCovers: number;
  occupancyData: number[];
  recentBookings: BookingSummaryDto[];
}

export async function getAdminDashboardStats(): Promise<AdminDashboardStats | null> {
  try {
    const overview = await getAdminOverview();
    if (!overview) return null;

    return {
      todayCount: overview.todayBookings,
      activeHoldsCount: overview.activeHoldsCount ?? 0,
      pausedCount: overview.pausedRestaurantsCount ?? 0,
      totalCovers: overview.totalSeats,
      occupancyData: overview.occupancyData ?? [],
      recentBookings: (overview.todayBookingsList ?? []).map((b) => ({
        id: b.id,
        date: b.date,
        endTime: b.endTime,
        customerEmail: b.customerEmail,
        customerName: b.customerName,
        seats: b.seats,
        restaurantName: b.restaurantName,
        bookingRef: b.bookingRef ?? "",
        isCancelled: b.isCancelled,
      })),
    };
  } catch (err) {
    console.error("getAdminDashboardStats error:", err);
    return null;
  }
}

export interface BookingDetailDto {
  id: number;
  restaurantId: number;
  restaurantName: string;
  sectionId: number;
  sectionName: string;
  tableId: number;
  tableName: string;
  date: string;
  endTime?: string;
  customerEmail: string;
  customerName?: string;
  seats: number;
  specialRequests?: string;
  bookingRef?: string;
  isCancelled?: boolean;
  cancelledAt?: string;
}

export interface AdminCreateBookingRequest {
  restaurantId: number;
  sectionId: number;
  tableId: number;
  date: string;
  customerEmail: string;
  customerName?: string;
  seats: number;
}

export interface UpdateBookingRequest {
  date?: string;
  seats?: number;
  customerEmail?: string;
  customerName?: string;
  tableId?: number;
  sectionId?: number;
}

export interface CreateRestaurantRequest {
  name: string;
  address?: string;
}

export async function getAdminOverview(): Promise<AdminOverviewDto | null> {
  try {
    const res = await get("/admin/overview");
    if (!res.ok) throw new Error("Failed to fetch overview");
    return await res.json();
  } catch (err) {
    console.error("getAdminOverview error:", err);
    return null;
  }
}

// ---------- Bookings ----------

export type BookingStatusFilter = "active" | "past" | "cancelled" | "all";

export async function getAdminBookings(
  restaurantId?: number,
  date?: string,
  status: BookingStatusFilter = "active",
  email?: string,
  bookingRef?: string
): Promise<BookingDetailDto[]> {
  try {
    const params = new URLSearchParams();
    if (restaurantId != null) params.set("restaurantId", String(restaurantId));
    if (date) params.set("date", date);
    if (status !== "active") params.set("status", status);
    if (email) params.set("email", email);
    if (bookingRef) params.set("bookingRef", bookingRef);
    const query = params.toString() ? `?${params}` : "";
    const res = await get(`/admin/bookings${query}`);
    if (!res.ok) throw new Error("Failed to fetch admin bookings");
    return await res.json();
  } catch (err) {
    console.error("getAdminBookings error:", err);
    return [];
  }
}

export async function adminLookupBookings(query: string): Promise<BookingDetailDto[]> {
  const isEmail = query.includes("@");
  return getAdminBookings(
    undefined,
    undefined,
    "all",
    isEmail ? query : undefined,
    isEmail ? undefined : query
  );
}

export async function getAdminBooking(id: number): Promise<BookingDetailDto | null> {
  try {
    const res = await get(`/admin/bookings/${id}`);
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.error("getAdminBooking error:", err);
    return null;
  }
}

export async function adminCreateBooking(
  req: AdminCreateBookingRequest
): Promise<BookingDetailDto | null> {
  const res = await post("/admin/bookings", req);

  if (res.status === 409) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? "This table is already booked on that date.");
  }

  if (!res.ok) throw new Error("Failed to create booking");
  return await res.json();
}

export async function adminUpdateBooking(
  id: number,
  req: UpdateBookingRequest
): Promise<BookingDetailDto | null> {
  try {
    const res = await patch(`/admin/bookings/${id}`, req);
    if (!res.ok) throw new Error("Failed to update booking");
    return await res.json();
  } catch (err) {
    console.error("adminUpdateBooking error:", err);
    return null;
  }
}

export async function adminExtendBooking(
  id: number,
  minutes: number
): Promise<{ endTime: string } | null> {
  try {
    const res = await post(`/admin/bookings/${id}/extend`, { minutes });
    if (!res.ok) throw new Error("Failed to extend booking");
    return await res.json();
  } catch (err) {
    console.error("adminExtendBooking error:", err);
    return null;
  }
}

export async function adminDeleteBooking(id: number): Promise<boolean> {
  try {
    const res = await del(`/admin/bookings/${id}`);
    return res.ok;
  } catch (err) {
    console.error("adminDeleteBooking error:", err);
    return false;
  }
}

export async function adminPurgeBooking(id: number): Promise<boolean> {
  try {
    const res = await del(`/admin/bookings/${id}/purge`);
    return res.ok;
  } catch (err) {
    console.error("adminPurgeBooking error:", err);
    return false;
  }
}

export async function sendBookingEmail(
  bookingId: number,
  subject: string,
  body: string
): Promise<{ ok: boolean; message: string }> {
  try {
    const res = await post(`/admin/bookings/${bookingId}/email`, { subject, body });
    const data = await res.json();
    return { ok: res.ok, message: data.message };
  } catch {
    return { ok: false, message: "Network error." };
  }
}

export async function adminRestoreBooking(id: number): Promise<boolean> {
  try {
    const res = await post(`/admin/bookings/${id}/restore`);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.message ?? "Failed to restore booking");
    }
    return true;
  } catch (err) {
    console.error("adminRestoreBooking error:", err);
    throw err;
  }
}

export interface AdminUpdateBookingRequest {
  restaurantId?: number;
  sectionId?: number;
  tableId?: number;
  date?: string;
  seats?: number;
  customerEmail?: string;
  customerName?: string;
  specialRequests?: string;
}

export async function adminUpdateBookingFull(
  id: number,
  req: AdminUpdateBookingRequest
): Promise<BookingDetailDto | null> {
  try {
    const res = await put(`/admin/bookings/${id}`, req);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.message ?? "Failed to update booking");
    }
    return await res.json();
  } catch (err) {
    console.error("adminUpdateBookingFull error:", err);
    throw err;
  }
}

export async function adminCreateRestaurant(
  req: CreateRestaurantRequest
): Promise<{ id: number; name: string; address?: string } | null> {
  try {
    const res = await post("/admin/restaurants", req);
    if (!res.ok) throw new Error("Failed to create restaurant");
    return await res.json();
  } catch (err) {
    console.error("adminCreateRestaurant error:", err);
    return null;
  }
}

export async function adminDeleteRestaurant(id: number): Promise<boolean> {
  try {
    const res = await del(`/admin/restaurants/${id}`);
    return res.ok;
  } catch (err) {
    console.error("adminDeleteRestaurant error:", err);
    return false;
  }
}

export async function pauseRestaurantBookings(id: number, minutes: number): Promise<boolean> {
  try {
    const res = await post(`/admin/restaurants/${id}/pause`, { minutes });
    return res.ok;
  } catch (err) {
    console.error("pauseRestaurantBookings error:", err);
    return false;
  }
}

export async function unpauseRestaurantBookings(id: number): Promise<boolean> {
  try {
    const res = await post(`/admin/restaurants/${id}/unpause`, {});
    return res.ok;
  } catch (err) {
    console.error("unpauseRestaurantBookings error:", err);
    return false;
  }
}

export async function extendRestaurantBookings(
  id: number,
  minutes: number
): Promise<{ ok: boolean; extendedBookings: BookingDetailDto[] }> {
  try {
    const res = await post(`/admin/restaurants/${id}/extend`, { minutes });
    if (!res.ok) return { ok: false, extendedBookings: [] };
    const data = await res.json();
    return { ok: true, extendedBookings: data.extendedBookings || [] };
  } catch (err) {
    console.error("extendRestaurantBookings error:", err);
    return { ok: false, extendedBookings: [] };
  }
}

export interface SectionWithTables {
  id: number;
  name: string;
  tables: { id: number; name: string; seats: number }[];
}

export async function adminGetTables(restaurantId: number): Promise<SectionWithTables[]> {
  try {
    const res = await get(`/admin/restaurants/${restaurantId}/tables`);
    if (!res.ok) return [];
    return await res.json();
  } catch (err) {
    console.error("adminGetTables error:", err);
    return [];
  }
}

export async function adminGetRestaurants(): Promise<
  { id: number; name: string; bookingsPausedUntil?: string; activeBookingsCount?: number }[]
> {
  try {
    const res = await get("/admin/restaurants");
    if (!res.ok) return [];
    return await res.json();
  } catch (err) {
    console.error("adminGetRestaurants error:", err);
    return [];
  }
}

export async function adminGetSections(
  restaurantId: number
): Promise<{ id: number; name: string }[]> {
  try {
    const res = await get(`/admin/restaurants/${restaurantId}/sections`);
    if (!res.ok) return [];
    return await res.json();
  } catch (err) {
    console.error("adminGetSections error:", err);
    return [];
  }
}

export interface EmailFailureDto {
  id: number;
  bookingRef: string | null;
  recipientEmail: string;
  errorMessage: string;
  attemptedAt: string;
}

export async function getEmailFailures(): Promise<EmailFailureDto[]> {
  try {
    const res = await get("/admin/email-settings/failures");
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

export interface EmailSettingsDto {
  host: string;
  port: number;
  username: string;
  password: string;
  enableSsl: boolean;
  fromName?: string;
  fromEmail?: string;
  isConfigured: boolean;
  sendBookingConfirmations: boolean;
}

export async function getEmailSettings(): Promise<EmailSettingsDto> {
  try {
    const res = await get("/admin/email-settings");
    if (!res.ok) throw new Error();
    return await res.json();
  } catch {
    return {
      host: "",
      port: 587,
      username: "",
      password: "",
      enableSsl: true,
      isConfigured: false,
      sendBookingConfirmations: false,
    };
  }
}

export async function saveEmailSettings(
  data: Omit<EmailSettingsDto, "isConfigured">
): Promise<{ message: string } | null> {
  try {
    const res = await post("/admin/email-settings", data);
    return await res.json();
  } catch {
    return null;
  }
}

export async function testEmailConnection(): Promise<{ ok: boolean; message: string }> {
  try {
    const res = await post("/admin/email-settings/test");
    const data = await res.json();
    return { ok: res.ok, message: data.message };
  } catch {
    return { ok: false, message: "Network error." };
  }
}

export interface BrandSettingsDto {
  appName: string;
  primaryColor: string;
  accentColor?: string;
  faviconIcon?: string;
}

export async function saveBrandSettings(
  data: BrandSettingsDto
): Promise<{ message: string } | null> {
  try {
    const res = await post("/brand", data);
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      return { message: err?.message ?? "Failed to save." };
    }
    return await res.json();
  } catch {
    return null;
  }
}

export async function uploadHeroImage(file: File): Promise<string | null> {
  try {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${process.env.EXPO_PUBLIC_API_URL ?? "/api"}/media/hero`, {
      method: "POST",
      credentials: "include",
      body: form,
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.url ?? null;
  } catch {
    return null;
  }
}

export async function deleteHeroImage(): Promise<void> {
  try {
    await fetch(`${process.env.EXPO_PUBLIC_API_URL ?? "/api"}/media/hero`, {
      method: "DELETE",
      credentials: "include",
    });
  } catch {
    // ignore
  }
}

// ---------- Highlights ----------

export interface AdminHighlightDto {
  id: number;
  title: string;
  body: string;
  iconKey: string;
  sortOrder: number;
}

export interface CreateHighlightRequest {
  title: string;
  body: string;
  iconKey: string;
  sortOrder: number;
}

export interface UpdateHighlightRequest {
  title: string;
  body: string;
  iconKey: string;
  sortOrder: number;
}

export async function adminGetHighlights(): Promise<AdminHighlightDto[]> {
  try {
    const res = await get("/highlights");
    if (!res.ok) return [];
    return await res.json();
  } catch (err) {
    console.error("adminGetHighlights error:", err);
    return [];
  }
}

export async function adminCreateHighlight(
  req: CreateHighlightRequest
): Promise<AdminHighlightDto | null> {
  try {
    const res = await post("/highlights", req);
    if (!res.ok) throw new Error("Failed to create highlight");
    return await res.json();
  } catch (err) {
    console.error("adminCreateHighlight error:", err);
    return null;
  }
}

export async function adminUpdateHighlight(
  id: number,
  req: UpdateHighlightRequest
): Promise<AdminHighlightDto | null> {
  try {
    const res = await put(`/highlights/${id}`, req);
    if (!res.ok) throw new Error("Failed to update highlight");
    return await res.json();
  } catch (err) {
    console.error("adminUpdateHighlight error:", err);
    return null;
  }
}

export async function adminDeleteHighlight(id: number): Promise<boolean> {
  try {
    const res = await del(`/highlights/${id}`);
    return res.ok;
  } catch (err) {
    console.error("adminDeleteHighlight error:", err);
    return false;
  }
}
