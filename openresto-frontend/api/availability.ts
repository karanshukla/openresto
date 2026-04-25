import { get } from "./client";

export interface TimeSlotDto {
  time: string;
  isAvailable: boolean;
  category: "Lunch" | "Dinner" | "Off-Peak";
}

export interface AvailabilityResponseDto {
  restaurantId: number;
  date: string;
  slots: TimeSlotDto[];
}

export async function fetchAvailability(
  restaurantId: number,
  date: string,
  seats: number
): Promise<AvailabilityResponseDto | null> {
  try {
    const res = await get(`/availability/${restaurantId}?date=${date}&seats=${seats}`);
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.error("fetchAvailability error:", err);
    return null;
  }
}
