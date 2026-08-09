import { get, post, put, del, buildUrl } from "./client";

export interface TableDto {
  id: number;
  name?: string | null;
  seats: number;
}

export interface SectionDto {
  id: number;
  name: string;
  sortOrder?: number;
  tables: TableDto[];
}

/**
 * A combinable-table group (#271/#273): physical tables an admin flagged as combinable, bookable
 * as one unit for larger parties. `combinedSeats` is the stored capacity; `members` are the
 * physical tables pushed together.
 */
export interface TableGroupDto {
  id: number;
  name?: string | null;
  combinedSeats: number;
  members: TableDto[];
}

/**
 * Best-effort preview of what a table/section delete would orphan. `bookings` is the count of
 * non-cancelled *future* bookings that would lose their table/section reference (the FK-null the
 * delete already performs). Null/undefined when the impact read failed or is unavailable — callers
 * fall back to generic copy rather than blocking the delete.
 */
export interface DeleteImpactDto {
  bookings: number;
}

export interface DayHoursDto {
  /** ISO 8601 day number: 1=Monday … 7=Sunday. */
  day: number;
  open: string;
  close: string;
}

/**
 * Shape of the booking reference handed to customers. Mirrors the backend
 * `BookingRefFormat` enum, which serialises as its member name.
 */
export type BookingRefFormat = "AlphaNumeric" | "Numeric";

export interface RestaurantDto {
  id: number;
  name: string;
  address?: string | null;
  openTime: string;
  closeTime: string;
  /** Resolved hours for every day of the week (7 entries) when provided by the API. */
  openHours?: DayHoursDto[];
  openDays: string;
  timezone: string;
  tags?: string[];
  imageUrl?: string | null;
  /** Optional blurb shown on the location detail page (supports [label](url) links). */
  description?: string | null;
  /** Optional link to this location's menu (PDF, page, etc.). */
  menuUrl?: string | null;
  /** Optional contact phone for this location; falls back to the brand phone when absent. */
  phoneNumber?: string | null;
  /** Optional contact email for this location; falls back to the brand email when absent. */
  emailAddress?: string | null;
  isArchived?: boolean;
  /** When true the whole location is walk-in only — the booking flow is disabled. */
  walkInOnly?: boolean;
  /** Comma-separated ISO days (1=Monday … 7=Sunday) that are walk-in only ("" when none). */
  walkInDays?: string;
  defaultBookingDurationMinutes?: number;
  /** Step (minutes) between selectable booking start times (15/30/60). */
  bookingSlotIntervalMinutes?: number;
  /** Max allowed spare seats over party size, or null for unrestricted (off). */
  maxTableOversizeSeats?: number | null;
  /** Format of references minted for new bookings; existing bookings keep theirs. */
  bookingRefFormat?: BookingRefFormat;
  sections: SectionDto[];
  /** Combinable-table groups defined for this restaurant (#271/#273). Empty/undefined when none. */
  groups?: TableGroupDto[];
}

export async function createRestaurant(name: string): Promise<RestaurantDto | null> {
  try {
    const res = await post("/restaurants", {
      name,
      openTime: "09:00",
      closeTime: "22:00",
      openDays: "1,2,3,4,5,6,7",
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
    if (!res.ok) throw new Error("Failed to create restaurant");
    return await res.json();
  } catch (err) {
    console.error("createRestaurant error:", err);
    return null;
  }
}

export async function fetchRestaurants(): Promise<RestaurantDto[]> {
  try {
    const res = await get("/restaurants");
    if (!res.ok) throw new Error("Failed to fetch restaurants");
    return await res.json();
  } catch (err) {
    console.error("fetchRestaurants error:", err);
    return [];
  }
}

export async function fetchRestaurantById(id: number): Promise<RestaurantDto | null> {
  try {
    const res = await get(`/restaurants/${id}`);
    if (!res.ok) throw new Error("Failed to fetch restaurant");
    return await res.json();
  } catch (err) {
    console.error("fetchRestaurantById error:", err);
    return null;
  }
}

export interface HighlightDto {
  id: number;
  title: string;
  body: string;
  iconKey: string;
  sortOrder: number;
  link?: string | null;
}

export async function fetchHighlights(): Promise<HighlightDto[]> {
  try {
    const res = await get("/highlights");
    if (!res.ok) throw new Error("Failed to fetch highlights");
    return await res.json();
  } catch (err) {
    console.error("fetchHighlights error:", err);
    return [];
  }
}

export interface SocialLinkDto {
  id: number;
  label: string;
  url: string;
  iconKey: string;
  sortOrder: number;
}

export async function fetchSocialLinks(): Promise<SocialLinkDto[]> {
  try {
    const res = await get("/social-links");
    if (!res.ok) throw new Error("Failed to fetch social links");
    return await res.json();
  } catch (err) {
    console.error("fetchSocialLinks error:", err);
    return [];
  }
}

export async function updateRestaurant(
  id: number,
  data: {
    name: string;
    address?: string | null;
    openTime?: string;
    closeTime?: string;
    openHours?: DayHoursDto[];
    openDays?: string;
    timezone?: string;
    tags?: string | null;
    defaultBookingDurationMinutes?: number;
    bookingSlotIntervalMinutes?: number;
    maxTableOversizeSeats?: number | null;
    bookingRefFormat?: BookingRefFormat;
    walkInOnly?: boolean;
    walkInDays?: string;
    description?: string | null;
    menuUrl?: string | null;
    phoneNumber?: string | null;
    emailAddress?: string | null;
  }
): Promise<RestaurantDto | null> {
  try {
    const res = await put(`/restaurants/${id}`, data);
    if (!res.ok) throw new Error("Failed to update restaurant");
    return await res.json();
  } catch (err) {
    console.error("updateRestaurant error:", err);
    return null;
  }
}

export async function addSection(restaurantId: number, name: string): Promise<SectionDto | null> {
  try {
    const res = await post(`/restaurants/${restaurantId}/sections`, { name });
    if (!res.ok) throw new Error("Failed to add section");
    return await res.json();
  } catch (err) {
    console.error("addSection error:", err);
    return null;
  }
}

export async function updateSection(
  restaurantId: number,
  sectionId: number,
  name: string
): Promise<SectionDto | null> {
  try {
    const res = await put(`/restaurants/${restaurantId}/sections/${sectionId}`, { name });
    if (!res.ok) throw new Error("Failed to update section");
    return await res.json();
  } catch (err) {
    console.error("updateSection error:", err);
    return null;
  }
}

export async function deleteSection(restaurantId: number, sectionId: number): Promise<boolean> {
  try {
    const res = await del(`/restaurants/${restaurantId}/sections/${sectionId}`);
    return res.ok;
  } catch (err) {
    console.error("deleteSection error:", err);
    return false;
  }
}

export async function addTable(
  restaurantId: number,
  sectionId: number,
  data: { name?: string; seats: number }
): Promise<TableDto | null> {
  try {
    const res = await post(`/restaurants/${restaurantId}/sections/${sectionId}/tables`, data);
    if (!res.ok) throw new Error("Failed to add table");
    return await res.json();
  } catch (err) {
    console.error("addTable error:", err);
    return null;
  }
}

export async function updateTable(
  restaurantId: number,
  sectionId: number,
  tableId: number,
  data: { name?: string; seats: number }
): Promise<TableDto | null> {
  try {
    const res = await put(
      `/restaurants/${restaurantId}/sections/${sectionId}/tables/${tableId}`,
      data
    );
    if (!res.ok) throw new Error("Failed to update table");
    return await res.json();
  } catch (err) {
    console.error("updateTable error:", err);
    return null;
  }
}

export async function deleteTable(
  restaurantId: number,
  sectionId: number,
  tableId: number
): Promise<boolean> {
  try {
    const res = await del(`/restaurants/${restaurantId}/sections/${sectionId}/tables/${tableId}`);
    return res.ok;
  } catch (err) {
    console.error("deleteTable error:", err);
    return false;
  }
}

// ── Combinable table groups (#273) ─────────────────────────────────────────

export async function createTableGroup(
  restaurantId: number,
  data: { name?: string | null; members: number[]; combinedSeats: number }
): Promise<TableGroupDto | null> {
  try {
    const res = await post(`/restaurants/${restaurantId}/groups`, data);
    if (!res.ok) throw new Error("Failed to create table group");
    return await res.json();
  } catch (err) {
    console.error("createTableGroup error:", err);
    return null;
  }
}

export async function updateTableGroup(
  restaurantId: number,
  groupId: number,
  data: { name?: string | null; members: number[]; combinedSeats: number }
): Promise<TableGroupDto | null> {
  try {
    const res = await put(`/restaurants/${restaurantId}/groups/${groupId}`, data);
    if (!res.ok) throw new Error("Failed to update table group");
    return await res.json();
  } catch (err) {
    console.error("updateTableGroup error:", err);
    return null;
  }
}

export async function deleteTableGroup(restaurantId: number, groupId: number): Promise<boolean> {
  try {
    const res = await del(`/restaurants/${restaurantId}/groups/${groupId}`);
    return res.ok;
  } catch (err) {
    console.error("deleteTableGroup error:", err);
    return false;
  }
}

/**
 * Non-cancelled future bookings that would lose their table reference if this table were deleted.
 * Returns null on any failure (network, 404, non-OK) so the two-step delete UI can degrade to
 * generic copy instead of blocking the destructive action — the count is best-effort friction, not
 * a gate (#270).
 */
export async function fetchTableDeleteImpact(
  restaurantId: number,
  sectionId: number,
  tableId: number
): Promise<DeleteImpactDto | null> {
  try {
    const res = await get(
      `/restaurants/${restaurantId}/sections/${sectionId}/tables/${tableId}/impact`
    );
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.error("fetchTableDeleteImpact error:", err);
    return null;
  }
}

/**
 * Non-cancelled future bookings that would lose their section reference if this section (and all its
 * tables) were deleted. Same best-effort/null-on-failure contract as {@link fetchTableDeleteImpact}.
 */
export async function fetchSectionDeleteImpact(
  restaurantId: number,
  sectionId: number
): Promise<DeleteImpactDto | null> {
  try {
    const res = await get(`/restaurants/${restaurantId}/sections/${sectionId}/impact`);
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.error("fetchSectionDeleteImpact error:", err);
    return null;
  }
}

export async function uploadLocationImage(
  restaurantId: number,
  file: File
): Promise<string | null> {
  try {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(buildUrl(`/media/location/${restaurantId}`), {
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

export async function deleteLocationImage(restaurantId: number): Promise<boolean> {
  try {
    const res = await fetch(buildUrl(`/media/location/${restaurantId}`), {
      method: "DELETE",
      credentials: "include",
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function uploadMenuFile(restaurantId: number, file: File): Promise<string | null> {
  try {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(buildUrl(`/media/menu/${restaurantId}`), {
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

export async function deleteMenuFile(restaurantId: number): Promise<boolean> {
  try {
    const res = await fetch(buildUrl(`/media/menu/${restaurantId}`), {
      method: "DELETE",
      credentials: "include",
    });
    return res.ok;
  } catch {
    return false;
  }
}
