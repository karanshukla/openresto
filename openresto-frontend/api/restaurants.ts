import { getAuthHeaders } from "./auth";

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
  sections: SectionDto[];
}

const API_URL = process.env.EXPO_PUBLIC_API_URL;

function buildEndpoint(path: string): string {
  const base = API_URL?.replace(/\/$/, "") ?? "";
  if (!base) return `/api${path}`;
  return base.includes("/api") ? `${base}${path}` : `${base}/api${path}`;
}

export async function fetchRestaurants(): Promise<RestaurantDto[]> {
  try {
    const res = await fetch(buildEndpoint("/restaurants"));
    if (!res.ok) throw new Error("Failed to fetch restaurants");
    return await res.json();
  } catch (err) {
    console.error("fetchRestaurants error:", err);
    return [];
  }
}

export async function fetchRestaurantById(
  id: number
): Promise<RestaurantDto | null> {
  try {
    const res = await fetch(buildEndpoint(`/restaurants/${id}`));
    if (!res.ok) throw new Error("Failed to fetch restaurant");
    return await res.json();
  } catch (err) {
    console.error("fetchRestaurantById error:", err);
    return null;
  }
}

// ── Restaurant update ──────────────────────────────────────────────────────

export async function updateRestaurant(
  id: number,
  data: { name: string; address?: string | null }
): Promise<RestaurantDto | null> {
  try {
    const res = await fetch(buildEndpoint(`/restaurants/${id}`), {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Failed to update restaurant");
    return await res.json();
  } catch (err) {
    console.error("updateRestaurant error:", err);
    return null;
  }
}

// ── Section management ─────────────────────────────────────────────────────

export async function addSection(
  restaurantId: number,
  name: string
): Promise<SectionDto | null> {
  try {
    const res = await fetch(
      buildEndpoint(`/restaurants/${restaurantId}/sections`),
      {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ name }),
      }
    );
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
    const res = await fetch(
      buildEndpoint(`/restaurants/${restaurantId}/sections/${sectionId}`),
      {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ name }),
      }
    );
    if (!res.ok) throw new Error("Failed to update section");
    return await res.json();
  } catch (err) {
    console.error("updateSection error:", err);
    return null;
  }
}

export async function deleteSection(
  restaurantId: number,
  sectionId: number
): Promise<boolean> {
  try {
    const res = await fetch(
      buildEndpoint(`/restaurants/${restaurantId}/sections/${sectionId}`),
      { method: "DELETE", headers: getAuthHeaders() }
    );
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
    const res = await fetch(
      buildEndpoint(
        `/restaurants/${restaurantId}/sections/${sectionId}/tables`
      ),
      {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify(data),
      }
    );
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
    const res = await fetch(
      buildEndpoint(
        `/restaurants/${restaurantId}/sections/${sectionId}/tables/${tableId}`
      ),
      {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify(data),
      }
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
    const res = await fetch(
      buildEndpoint(
        `/restaurants/${restaurantId}/sections/${sectionId}/tables/${tableId}`
      ),
      { method: "DELETE", headers: getAuthHeaders() }
    );
    return res.ok;
  } catch (err) {
    console.error("deleteTable error:", err);
    return false;
  }
}
