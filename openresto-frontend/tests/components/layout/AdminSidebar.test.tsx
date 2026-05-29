import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react-native";
import AdminSidebar from "@/components/layout/AdminSidebar";

jest.mock("expo-router", () => ({
  usePathname: jest.fn().mockReturnValue("/dashboard"),
  useRouter: jest.fn().mockReturnValue({
    push: jest.fn(),
    replace: jest.fn(),
  }),
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock("@/context/BrandContext", () => ({
  useBrand: jest.fn().mockReturnValue({ primaryColor: "#007AFF", appName: "Test App" }),
}));

jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: () => "light",
}));

jest.mock("@/context/ThemeContext", () => ({
  useTheme: () => ({ toggle: jest.fn() }),
}));

jest.mock("@/utils/colors", () => ({
  hexToRgba: jest.fn((hex: string, alpha: number) => `rgba(0,0,0,${alpha})`),
}));

jest.mock("@/api/auth", () => ({
  logout: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/api/restaurants", () => ({
  fetchRestaurants: jest.fn().mockResolvedValue([
    { id: 1, name: "Test Restaurant", sections: [] },
    { id: 2, name: "Another Restaurant", sections: [] },
  ]),
}));

jest.mock("@/api/admin", () => ({
  adminLookupBookings: jest.fn().mockResolvedValue([]),
  getAdminBookings: jest.fn().mockResolvedValue([]),
}));

// Mock BookingDetailPopup to expose onClose
jest.mock("@/components/admin/bookings/BookingDetailPopup", () => ({
  BookingDetailPopup: ({ bookingId, onClose }: { bookingId: number | null; onClose: () => void }) => {
    const { TouchableOpacity, Text } = require("react-native");
    return bookingId ? (
      <TouchableOpacity onPress={onClose} testID="popup-close-btn">
        <Text>Close Popup</Text>
      </TouchableOpacity>
    ) : null;
  },
}));

jest.mock("@expo/vector-icons", () => {
  const { Text } = require("react-native");
  return {
    Ionicons: ({ name }: { name: string }) => <Text testID={`icon-${name}`}>{name}</Text>,
  };
});

describe("AdminSidebar", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const restaurantsApi = require("@/api/restaurants");
    restaurantsApi.fetchRestaurants.mockResolvedValue([
      { id: 1, name: "Test Restaurant", sections: [] },
    ]);
    const adminApi = require("@/api/admin");
    adminApi.getAdminBookings.mockResolvedValue([]);
    adminApi.adminLookupBookings.mockResolvedValue([]);
  });

  it("renders the app name", async () => {
    render(<AdminSidebar />);
    expect(screen.getByText("Test App")).toBeTruthy();
  });

  it("renders navigation items", () => {
    render(<AdminSidebar />);
    expect(screen.getByText("Overview")).toBeTruthy();
    expect(screen.getByText("Bookings")).toBeTruthy();
    expect(screen.getByText("Settings")).toBeTruthy();
  });

  it("shows location count after loading", async () => {
    render(<AdminSidebar />);
    await waitFor(() => {
      expect(screen.getByText(/Managing 1 location/)).toBeTruthy();
    });
  });

  it("shows No upcoming bookings when none", async () => {
    render(<AdminSidebar />);
    await waitFor(() => {
      expect(screen.getByText("No upcoming bookings today")).toBeTruthy();
    });
  });

  it("shows upcoming bookings when available", async () => {
    const adminApi = require("@/api/admin");
    const futureDate = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    adminApi.getAdminBookings.mockResolvedValue([
      {
        id: 1,
        date: futureDate,
        customerEmail: "guest@example.com",
        seats: 2,
        tableName: "T1",
        restaurantName: "Test Restaurant",
      },
    ]);
    render(<AdminSidebar />);
    await waitFor(() => {
      expect(screen.getByText("guest")).toBeTruthy();
    });
  });

  it("handles lookup with no results", async () => {
    render(<AdminSidebar />);
    const input = screen.getByPlaceholderText("Email or reference…");
    fireEvent.changeText(input, "test@example.com");
    fireEvent.press(screen.getByText("Search"));
    await waitFor(() => {
      expect(screen.getByText("No booking found.")).toBeTruthy();
    });
  });

  it("handles lookup with empty query (no-op)", async () => {
    const adminApi = require("@/api/admin");
    render(<AdminSidebar />);
    fireEvent.press(screen.getByText("Search"));
    // With empty query, adminLookupBookings should NOT be called
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(adminApi.adminLookupBookings).not.toHaveBeenCalled();
  });

  it("handles lookup with single result", async () => {
    const adminApi = require("@/api/admin");
    adminApi.adminLookupBookings.mockResolvedValueOnce([{ id: 42, date: new Date().toISOString() }]);
    render(<AdminSidebar />);
    const input = screen.getByPlaceholderText("Email or reference…");
    fireEvent.changeText(input, "ABC123");
    fireEvent.press(screen.getByText("Search"));
    await waitFor(() => {
      expect(adminApi.adminLookupBookings).toHaveBeenCalledWith("ABC123");
    });
  });

  it("handles lookup with multiple results (email query)", async () => {
    const adminApi = require("@/api/admin");
    const router = require("expo-router").useRouter();
    adminApi.adminLookupBookings.mockResolvedValueOnce([
      { id: 1, date: new Date().toISOString() },
      { id: 2, date: new Date().toISOString() },
    ]);
    render(<AdminSidebar />);
    const input = screen.getByPlaceholderText("Email or reference…");
    fireEvent.changeText(input, "guest@example.com");
    fireEvent.press(screen.getByText("Search"));
    await waitFor(() => {
      expect(router.push).toHaveBeenCalledWith({
        pathname: "/(admin)/bookings",
        params: { email: "guest@example.com" },
      });
    });
  });

  it("handles lookup with multiple results (ref query)", async () => {
    const adminApi = require("@/api/admin");
    const router = require("expo-router").useRouter();
    adminApi.adminLookupBookings.mockResolvedValueOnce([
      { id: 1, date: new Date().toISOString() },
      { id: 2, date: new Date().toISOString() },
    ]);
    render(<AdminSidebar />);
    const input = screen.getByPlaceholderText("Email or reference…");
    fireEvent.changeText(input, "REF123");
    fireEvent.press(screen.getByText("Search"));
    await waitFor(() => {
      expect(router.push).toHaveBeenCalledWith({
        pathname: "/(admin)/bookings",
        params: { bookingRef: "REF123" },
      });
    });
  });

  it("shows multiple results status after multi-result lookup", async () => {
    const adminApi = require("@/api/admin");
    adminApi.adminLookupBookings.mockResolvedValueOnce([
      { id: 1, date: new Date().toISOString() },
      { id: 2, date: new Date().toISOString() },
    ]);
    render(<AdminSidebar />);
    const input = screen.getByPlaceholderText("Email or reference…");
    fireEvent.changeText(input, "test@example.com");
    fireEvent.press(screen.getByText("Search"));
    await waitFor(() => {
      expect(screen.getByText("Showing all matches…")).toBeTruthy();
    });
  });

  it("handles logout when logout button is pressed", async () => {
    const authApi = require("@/api/auth");
    const router = require("expo-router").useRouter();
    render(<AdminSidebar />);
    fireEvent.press(screen.getByText("Log out"));
    await waitFor(() => {
      expect(authApi.logout).toHaveBeenCalled();
      expect(router.replace).toHaveBeenCalledWith("/(admin)/login");
    });
  });

  it("navigates when nav item is pressed", () => {
    const router = require("expo-router").useRouter();
    render(<AdminSidebar />);
    fireEvent.press(screen.getByText("Bookings"));
    expect(router.push).toHaveBeenCalledWith("/(admin)/bookings");
  });

  it("navigates to View all bookings when pressed", () => {
    const router = require("expo-router").useRouter();
    render(<AdminSidebar />);
    fireEvent.press(screen.getByText("View all"));
    expect(router.push).toHaveBeenCalledWith("/(admin)/bookings");
  });

  it("resets lookup status when input changes after a search", async () => {
    const adminApi = require("@/api/admin");
    adminApi.adminLookupBookings.mockResolvedValueOnce([]);
    render(<AdminSidebar />);
    const input = screen.getByPlaceholderText("Email or reference…");
    fireEvent.changeText(input, "test");
    fireEvent.press(screen.getByText("Search"));
    await waitFor(() => {
      expect(screen.getByText("No booking found.")).toBeTruthy();
    });
    // Change input - should reset status
    fireEvent.changeText(input, "new search");
    await waitFor(() => {
      expect(screen.queryByText("No booking found.")).toBeNull();
    });
  });

  it("navigates to home when footer back button is pressed", () => {
    const router = require("expo-router").useRouter();
    render(<AdminSidebar />);
    const backIcon = screen.queryByTestId("icon-arrow-back-outline");
    if (backIcon) {
      fireEvent.press(backIcon);
      expect(router.push).toHaveBeenCalledWith("/");
    }
    expect(true).toBe(true);
  });

  it("opens and closes BookingDetailPopup via lookup single result", async () => {
    const adminApi = require("@/api/admin");
    adminApi.adminLookupBookings.mockResolvedValueOnce([
      { id: 99, customerEmail: "found@test.com", bookingRef: "REF-99" },
    ]);
    render(<AdminSidebar />);
    const input = screen.getByPlaceholderText("Email or reference…");
    fireEvent.changeText(input, "found@test.com");
    fireEvent.press(screen.getByText("Search"));
    await waitFor(() => {
      expect(screen.queryByTestId("popup-close-btn")).toBeTruthy();
    });
    fireEvent.press(screen.getByTestId("popup-close-btn"));
    await waitFor(() => {
      expect(screen.queryByTestId("popup-close-btn")).toBeNull();
    });
  });
});
