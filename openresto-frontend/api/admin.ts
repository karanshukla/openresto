import { getAuthHeaders } from "./auth";

const API_URL = process.env.EXPO_PUBLIC_API_URL;

function buildEndpoint(path: string): string {
  const base = API_URL?.replace(/\/$/, "") ?? "";
  if (!base) return `/api${path}`;
  return base.includes("/api") ? `${base}${path}` : `${base}/api${path}`;
}

// ---------- Types ----------

export interface AdminOverviewDto {
  totalRestaurants: number;
  totalBookings: number;
  todayBookings: number;
  totalSeats: number;
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
  seats: number;
}

export interface UpdateBookingRequest {
  date?: string;
  seats?: number;
  customerEmail?: string;
  tableId?: number;
  sectionId?: number;
}

export interface CreateRestaurantRequest {
  name: string;
  address?: string;
}

// ---------- Overview ----------

export async function getAdminOverview(): Promise<AdminOverviewDto | null> {
  try {
    const res = await fetch(buildEndpoint("/admin/overview"), {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error("Failed to fetch overview");
    return await res.json();
  } catch (err) {
    console.error("getAdminOverview error:", err);
    return null;
  }
}

// ---------- Bookings ----------

export async function getAdminBookings(
  restaurantId?: number,
  date?: string,
  cancelled = false
): Promise<BookingDetailDto[]> {
  try {
    const params = new URLSearchParams();
    if (restaurantId != null) params.set("restaurantId", String(restaurantId));
    if (date) params.set("date", date);
    if (cancelled) params.set("cancelled", "true");
    const query = params.toString() ? `?${params}` : "";
    const res = await fetch(buildEndpoint(`/admin/bookings${query}`), {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error("Failed to fetch admin bookings");
    return await res.json();
  } catch (err) {
    console.error("getAdminBookings error:", err);
    return [];
  }
}

export async function getAdminBooking(id: number): Promise<BookingDetailDto | null> {
  try {
    const res = await fetch(buildEndpoint(`/admin/bookings/${id}`), {
      headers: getAuthHeaders(),
    });
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
  const res = await fetch(buildEndpoint("/admin/bookings"), {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(req),
  });

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
    const res = await fetch(buildEndpoint(`/admin/bookings/${id}`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      body: JSON.stringify(req),
    });
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
    const res = await fetch(buildEndpoint(`/admin/bookings/${id}/extend`), {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      body: JSON.stringify({ minutes }),
    });
    if (!res.ok) throw new Error("Failed to extend booking");
    return await res.json();
  } catch (err) {
    console.error("adminExtendBooking error:", err);
    return null;
  }
}

export async function adminDeleteBooking(id: number): Promise<boolean> {
  try {
    const res = await fetch(buildEndpoint(`/admin/bookings/${id}`), {
      method: "DELETE",
      headers: getAuthHeaders(),
    });
    return res.ok;
  } catch (err) {
    console.error("adminDeleteBooking error:", err);
    return false;
  }
}

// ---------- Restaurants ----------

export async function adminCreateRestaurant(
  req: CreateRestaurantRequest
): Promise<{ id: number; name: string; address?: string } | null> {
  try {
    const res = await fetch(buildEndpoint("/admin/restaurants"), {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      body: JSON.stringify(req),
    });
    if (!res.ok) throw new Error("Failed to create restaurant");
    return await res.json();
  } catch (err) {
    console.error("adminCreateRestaurant error:", err);
    return null;
  }
}

export async function adminDeleteRestaurant(id: number): Promise<boolean> {
  try {
    const res = await fetch(buildEndpoint(`/admin/restaurants/${id}`), {
      method: "DELETE",
      headers: getAuthHeaders(),
    });
    return res.ok;
  } catch (err) {
    console.error("adminDeleteRestaurant error:", err);
    return false;
  }
}

// ---------- Tables ----------

export interface SectionWithTables {
  id: number;
  name: string;
  tables: { id: number; name: string; seats: number }[];
}

export async function adminGetTables(restaurantId: number): Promise<SectionWithTables[]> {
  try {
    const res = await fetch(buildEndpoint(`/admin/restaurants/${restaurantId}/tables`), {
      headers: getAuthHeaders(),
    });
    if (!res.ok) return [];
    return await res.json();
  } catch (err) {
    console.error("adminGetTables error:", err);
    return [];
  }
}

// ---------- Email Settings ----------

export interface EmailSettingsDto {
  host: string;
  port: number;
  username: string;
  password: string;
  enableSsl: boolean;
  fromName?: string;
  fromEmail?: string;
  isConfigured: boolean;
}

export async function getEmailSettings(): Promise<EmailSettingsDto> {
  try {
    const res = await fetch(buildEndpoint("/admin/email-settings"), { headers: getAuthHeaders() });
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
    };
  }
}

export async function saveEmailSettings(
  data: Omit<EmailSettingsDto, "isConfigured">
): Promise<{ message: string } | null> {
  try {
    const res = await fetch(buildEndpoint("/admin/email-settings"), {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      body: JSON.stringify(data),
    });
    return await res.json();
  } catch {
    return null;
  }
}

export async function testEmailConnection(): Promise<{ ok: boolean; message: string }> {
  try {
    const res = await fetch(buildEndpoint("/admin/email-settings/test"), {
      method: "POST",
      headers: getAuthHeaders(),
    });
    const data = await res.json();
    return { ok: res.ok, message: data.message };
  } catch (err) {
    return { ok: false, message: "Network error." };
  }
}

// ---------- Brand Settings ----------

export interface BrandSettingsDto {
  appName: string;
  primaryColor: string;
  accentColor?: string;
  logoBase64?: string;
}

export async function saveBrandSettings(
  data: BrandSettingsDto
): Promise<{ message: string } | null> {
  try {
    const res = await fetch(buildEndpoint("/brand"), {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      return { message: err?.message ?? "Failed to save." };
    }
    return await res.json();
  } catch {
    return null;
  }
}
