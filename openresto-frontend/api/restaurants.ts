import { get, post, put, del } from "./client";

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

export interface RestaurantDto {
  id: number;
  name: string;
  address?: string | null;
  openTime: string;
  closeTime: string;
  openDays: string;
  sections: SectionDto[];
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

export async function updateRestaurant(
  id: number,
  data: { name: string; address?: string | null; openTime?: string; closeTime?: string; openDays?: string }
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

// ── Section management ─────────────────────────────────────────────────────

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

// ── Table management ───────────────────────────────────────────────────────

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
