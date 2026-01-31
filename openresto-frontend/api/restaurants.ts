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

export async function fetchRestaurants(): Promise<RestaurantDto[]> {
  try {
    const base = API_URL?.replace(/\/$/, "") ?? "";
    const endpoint = base
      ? base.includes("/api")
        ? `${base}/restaurants`
        : `${base}/api/restaurants`
      : "/api/restaurants";

    const res = await fetch(endpoint);
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
    const base = API_URL?.replace(/\/$/, "") ?? "";
    const endpoint = base
      ? base.includes("/api")
        ? `${base}/restaurants/${id}`
        : `${base}/api/restaurants/${id}`
      : `/api/restaurants/${id}`;

    const res = await fetch(endpoint);
    if (!res.ok) throw new Error("Failed to fetch restaurant");

    return await res.json();
  } catch (err) {
    console.error("fetchRestaurantById error:", err);
    return null;
  }
}
