import { get, post, put, del, buildUrl } from "./client";

export interface TableDto {
  id: number;
  name?: string | null;
  seats: number;
}

export interface SectionDto {
  id: number;
  name: string;
  tables: TableDto[];
}

export interface DayHoursDto {
  /** ISO 8601 day number: 1=Monday … 7=Sunday. */
  day: number;
  open: string;
  close: string;
}

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
  isArchived?: boolean;
  /** When true the whole location is walk-in only — the booking flow is disabled. */
  walkInOnly?: boolean;
  /** Comma-separated ISO days (1=Monday … 7=Sunday) that are walk-in only ("" when none). */
  walkInDays?: string;
  defaultBookingDurationMinutes?: number;
  sections: SectionDto[];
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
    walkInOnly?: boolean;
    walkInDays?: string;
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
