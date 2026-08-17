import { renderHook, act, waitFor } from "@testing-library/react-native";
import { useBookingLookup } from "@/hooks/useBookingLookup";
import { getBookingByRef, getBookingById, cancelBookingByRef } from "@/api/bookings";
import { fetchRestaurantById } from "@/api/restaurants";

jest.mock("@/api/bookings", () => ({
  getBookingByRef: jest.fn(),
  getBookingById: jest.fn(),
  cancelBookingByRef: jest.fn(),
}));
jest.mock("@/api/restaurants", () => ({
  fetchRestaurantById: jest.fn(),
}));

const mockBooking = {
  id: 1,
  bookingRef: "REF123",
  customerEmail: "test@test.com",
  restaurantId: 5,
  date: "2026-10-10T12:00:00Z",
  seats: 2,
  isCancelled: false,
};

describe("useBookingLookup", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("starts idle", () => {
    const { result } = renderHook(() => useBookingLookup());
    expect(result.current.status).toBe("idle");
    expect(result.current.booking).toBeNull();
  });

  it("resolves found and fetches the restaurant", async () => {
    (getBookingByRef as jest.Mock).mockResolvedValue(mockBooking);
    (fetchRestaurantById as jest.Mock).mockResolvedValue({ id: 5, name: "Toronto Resto" });
    const { result } = renderHook(() => useBookingLookup());

    let outcome;
    await act(async () => {
      outcome = await result.current.lookup("REF123", "test@test.com");
    });

    expect(result.current.status).toBe("found");
    expect(result.current.booking).toEqual(mockBooking);
    expect(result.current.restaurant).toEqual({ id: 5, name: "Toronto Resto" });
    expect(outcome).toEqual({ status: "found", booking: mockBooking });
  });

  it("keeps a found booking when the restaurant fetch fails", async () => {
    (getBookingByRef as jest.Mock).mockResolvedValue(mockBooking);
    (fetchRestaurantById as jest.Mock).mockRejectedValue(new Error("429"));
    const { result } = renderHook(() => useBookingLookup());

    let outcome;
    await act(async () => {
      outcome = await result.current.lookup("REF123", "test@test.com");
    });

    expect(result.current.status).toBe("found");
    expect(result.current.booking).toEqual(mockBooking);
    expect(result.current.restaurant).toBeNull();
    expect(outcome).toEqual({ status: "found", booking: mockBooking });
  });

  it("skips the restaurant fetch when the booking has no restaurantId", async () => {
    (getBookingByRef as jest.Mock).mockResolvedValue({ ...mockBooking, restaurantId: undefined });
    const { result } = renderHook(() => useBookingLookup());

    await act(async () => {
      await result.current.lookup("REF123", "test@test.com");
    });

    expect(fetchRestaurantById).not.toHaveBeenCalled();
  });

  it("resolves notFound when the ref+email lookup comes back null", async () => {
    (getBookingByRef as jest.Mock).mockResolvedValue(null);
    const { result } = renderHook(() => useBookingLookup());

    let outcome;
    await act(async () => {
      outcome = await result.current.lookup("REF123", "test@test.com");
    });

    expect(result.current.status).toBe("notFound");
    expect(result.current.booking).toBeNull();
    expect(outcome).toEqual({ status: "notFound" });
  });

  it("resolves error and does not surface it as not-found when the lookup throws", async () => {
    (getBookingByRef as jest.Mock).mockRejectedValue(new Error("offline"));
    const { result } = renderHook(() => useBookingLookup());

    let outcome;
    await act(async () => {
      outcome = await result.current.lookup("REF123", "test@test.com");
    });

    expect(result.current.status).toBe("error");
    expect(outcome).toEqual({ status: "error" });
  });

  it("tries the legacy numeric id only after the ref+email lookup comes back not-found", async () => {
    (getBookingByRef as jest.Mock).mockResolvedValue(null);
    (getBookingById as jest.Mock).mockResolvedValue(mockBooking);
    const { result } = renderHook(() => useBookingLookup());

    await act(async () => {
      await result.current.lookup("50", "test@test.com", { legacyId: 50 });
    });

    expect(getBookingById).toHaveBeenCalledWith(50);
    expect(result.current.status).toBe("found");
  });

  it("never tries the legacy id when the ref+email lookup already found the booking", async () => {
    (getBookingByRef as jest.Mock).mockResolvedValue(mockBooking);
    const { result } = renderHook(() => useBookingLookup());

    await act(async () => {
      await result.current.lookup("REF123", "test@test.com", { legacyId: 1 });
    });

    expect(getBookingById).not.toHaveBeenCalled();
  });

  it("skips the ref+email call entirely when there's no email, going straight to the legacy id", async () => {
    (getBookingById as jest.Mock).mockResolvedValue(mockBooking);
    const { result } = renderHook(() => useBookingLookup());

    await act(async () => {
      await result.current.lookup("50", "", { legacyId: 50 });
    });

    expect(getBookingByRef).not.toHaveBeenCalled();
    expect(getBookingById).toHaveBeenCalledWith(50);
    expect(result.current.status).toBe("found");
  });

  it("resets back to idle and clears the booking", async () => {
    (getBookingByRef as jest.Mock).mockResolvedValue(mockBooking);
    const { result } = renderHook(() => useBookingLookup());

    await act(async () => {
      await result.current.lookup("REF123", "test@test.com");
    });
    expect(result.current.status).toBe("found");

    act(() => result.current.reset());

    expect(result.current.status).toBe("idle");
    expect(result.current.booking).toBeNull();
    expect(result.current.restaurant).toBeNull();
  });

  describe("cancelBooking", () => {
    it("does nothing when there's no booking loaded", async () => {
      const { result } = renderHook(() => useBookingLookup());
      await act(async () => {
        await result.current.cancelBooking();
      });
      expect(cancelBookingByRef).not.toHaveBeenCalled();
    });

    it("does not resurrect a cleared booking if reset() runs while cancelBookingByRef is in flight", async () => {
      (getBookingByRef as jest.Mock).mockResolvedValue(mockBooking);
      let resolveCancel: (v: unknown) => void = () => {};
      (cancelBookingByRef as jest.Mock).mockReturnValue(
        new Promise((resolve) => {
          resolveCancel = resolve;
        })
      );
      const { result } = renderHook(() => useBookingLookup());

      await act(async () => {
        await result.current.lookup("REF123", "test@test.com");
      });

      let cancelPromise: Promise<void>;
      act(() => {
        cancelPromise = result.current.cancelBooking();
      });
      act(() => result.current.reset());
      expect(result.current.booking).toBeNull();

      await act(async () => {
        resolveCancel(true);
        await cancelPromise;
      });

      // The updater reads prev, not the stale closed-over booking, so a reset mid-flight
      // stays cleared instead of the cancel response bringing the old booking back.
      expect(result.current.booking).toBeNull();
    });

    it("cancels and optimistically flips isCancelled without refetching", async () => {
      (getBookingByRef as jest.Mock).mockResolvedValue(mockBooking);
      (cancelBookingByRef as jest.Mock).mockResolvedValue(true);
      const { result } = renderHook(() => useBookingLookup());

      await act(async () => {
        await result.current.lookup("REF123", "test@test.com");
      });
      await act(async () => {
        await result.current.cancelBooking();
      });

      expect(cancelBookingByRef).toHaveBeenCalledWith("REF123", "test@test.com");
      expect(getBookingByRef).toHaveBeenCalledTimes(1);
      expect(result.current.booking?.isCancelled).toBe(true);
      expect(result.current.showCancelConfirm).toBe(false);
    });

    it("surfaces a cancellation failure through errorMessage instead of throwing", async () => {
      (getBookingByRef as jest.Mock).mockResolvedValue(mockBooking);
      (cancelBookingByRef as jest.Mock).mockRejectedValue(new Error("Failed to cancel booking."));
      const { result } = renderHook(() => useBookingLookup());

      await act(async () => {
        await result.current.lookup("REF123", "test@test.com");
      });
      await act(async () => {
        await result.current.cancelBooking();
      });

      await waitFor(() => expect(result.current.errorMessage).toBe("Failed to cancel booking."));
      expect(result.current.booking?.isCancelled).toBe(false);
      expect(result.current.cancelling).toBe(false);
    });

    it("falls back to an empty customerEmail when the booking has none", async () => {
      (getBookingByRef as jest.Mock).mockResolvedValue({
        ...mockBooking,
        customerEmail: undefined,
      });
      (cancelBookingByRef as jest.Mock).mockResolvedValue(true);
      const { result } = renderHook(() => useBookingLookup());

      await act(async () => {
        await result.current.lookup("REF123", "test@test.com");
      });
      await act(async () => {
        await result.current.cancelBooking();
      });

      expect(cancelBookingByRef).toHaveBeenCalledWith("REF123", "");
    });
  });
});
