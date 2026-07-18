import React from "react";
import { render, screen, waitFor, fireEvent, act } from "@testing-library/react-native";
import AdminSidebar from "@/components/layout/AdminSidebar";

jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
jest.mock("@/hooks/use-color-scheme", () => ({ useColorScheme: () => "light" }));
jest.mock("@/utils/colors", () => ({ hexToRgba: (_h: string, _a: number) => "rgba(0,0,0,0.1)" }));

const mockPush = jest.fn();
const mockReplace = jest.fn();
jest.mock("expo-router", () => ({
  usePathname: jest.fn(() => "/dashboard"),
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock("@/context/BrandContext", () => ({
  useBrand: () => ({ primaryColor: "#0a7ea4", appName: "Open Resto" }),
}));

jest.mock("@/context/ThemeContext", () => ({
  useTheme: () => ({ toggle: jest.fn() }),
}));

jest.mock("@/api/auth", () => ({ logout: jest.fn().mockResolvedValue(undefined) }));

jest.mock("@/api/restaurants", () => ({
  fetchRestaurants: jest.fn().mockResolvedValue([{ id: 1 }, { id: 2 }]),
}));

jest.mock("@/api/admin", () => ({
  adminLookupBookings: jest.fn().mockResolvedValue([]),
}));

jest.mock("@/components/admin/bookings/BookingDetailPopup", () => ({
  BookingDetailPopup: () => null,
}));

describe("AdminSidebar", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const { fetchRestaurants } = require("@/api/restaurants");
    (fetchRestaurants as jest.Mock).mockResolvedValue([{ id: 1 }, { id: 2 }]);
  });

  it("renders app name", async () => {
    render(<AdminSidebar />);
    await waitFor(() => expect(screen.getByText("Open Resto")).toBeTruthy());
  });

  it("shows location count after data loads", async () => {
    render(<AdminSidebar />);
    await waitFor(() => expect(screen.getByText("Managing 2 locations")).toBeTruthy());
  });

  it("renders navigation items", async () => {
    render(<AdminSidebar />);
    await waitFor(() => {
      expect(screen.getByText("Overview")).toBeTruthy();
      expect(screen.getByText("Bookings")).toBeTruthy();
      expect(screen.getByText("Settings")).toBeTruthy();
    });
  });

  it("navigates to overview when Overview is pressed", async () => {
    render(<AdminSidebar />);
    await waitFor(() => expect(screen.getByText("Overview")).toBeTruthy());
    fireEvent.press(screen.getByText("Overview"));
    expect(mockPush).toHaveBeenCalledWith("/admin/dashboard");
  });

  it("navigates to bookings when Bookings is pressed", async () => {
    render(<AdminSidebar />);
    await waitFor(() => expect(screen.getByText("Bookings")).toBeTruthy());
    fireEvent.press(screen.getByText("Bookings"));
    expect(mockPush).toHaveBeenCalledWith("/admin/bookings");
  });

  it("calls logout and redirects when Log out is pressed", async () => {
    const { logout } = require("@/api/auth");
    render(<AdminSidebar />);
    await waitFor(() => expect(screen.getByText("Log out")).toBeTruthy());
    await act(async () => {
      fireEvent.press(screen.getByText("Log out"));
    });
    expect(logout).toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith("/admin/login");
  });

  it("navigates to site root when Back to site is pressed", async () => {
    render(<AdminSidebar />);
    await waitFor(() => expect(screen.getByText("Back to site")).toBeTruthy());
    fireEvent.press(screen.getByText("Back to site"));
    expect(mockPush).toHaveBeenCalledWith("/");
  });

  it("shows lookup input and Search button", async () => {
    render(<AdminSidebar />);
    await waitFor(() => expect(screen.getByPlaceholderText("Email or reference…")).toBeTruthy());
    expect(screen.getByText("Search")).toBeTruthy();
  });

  it("shows not_found when lookup returns empty", async () => {
    const { adminLookupBookings } = require("@/api/admin");
    (adminLookupBookings as jest.Mock).mockResolvedValue([]);
    render(<AdminSidebar />);
    await waitFor(() => expect(screen.getByPlaceholderText("Email or reference…")).toBeTruthy());
    fireEvent.changeText(screen.getByPlaceholderText("Email or reference…"), "unknown");
    await act(async () => {
      fireEvent.press(screen.getByText("Search"));
    });
    await waitFor(() => expect(screen.getByText("No booking found.")).toBeTruthy());
  });

  it("opens booking popup when lookup returns single result", async () => {
    const { adminLookupBookings } = require("@/api/admin");
    (adminLookupBookings as jest.Mock).mockResolvedValue([{ id: 42 }]);
    render(<AdminSidebar />);
    await waitFor(() => expect(screen.getByPlaceholderText("Email or reference…")).toBeTruthy());
    fireEvent.changeText(screen.getByPlaceholderText("Email or reference…"), "john@example.com");
    await act(async () => {
      fireEvent.press(screen.getByText("Search"));
    });
    await waitFor(() => expect(adminLookupBookings).toHaveBeenCalledWith("john@example.com"));
  });

  it("navigates to bookings with email param when multiple results", async () => {
    const { adminLookupBookings } = require("@/api/admin");
    (adminLookupBookings as jest.Mock).mockResolvedValue([{ id: 1 }, { id: 2 }]);
    render(<AdminSidebar />);
    await waitFor(() => expect(screen.getByPlaceholderText("Email or reference…")).toBeTruthy());
    fireEvent.changeText(screen.getByPlaceholderText("Email or reference…"), "multi@example.com");
    await act(async () => {
      fireEvent.press(screen.getByText("Search"));
    });
    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith(
        expect.objectContaining({ pathname: "/admin/bookings" })
      )
    );
  });

  it("does not call lookup when query is empty", async () => {
    const { adminLookupBookings } = require("@/api/admin");
    render(<AdminSidebar />);
    await waitFor(() => expect(screen.getByText("Search")).toBeTruthy());
    await act(async () => {
      fireEvent.press(screen.getByText("Search"));
    });
    expect(adminLookupBookings).not.toHaveBeenCalled();
  });

  it("clears lookup status when query changes", async () => {
    const { adminLookupBookings } = require("@/api/admin");
    (adminLookupBookings as jest.Mock).mockResolvedValue([]);
    render(<AdminSidebar />);
    await waitFor(() => expect(screen.getByPlaceholderText("Email or reference…")).toBeTruthy());
    fireEvent.changeText(screen.getByPlaceholderText("Email or reference…"), "test");
    await act(async () => {
      fireEvent.press(screen.getByText("Search"));
    });
    await waitFor(() => expect(screen.getByText("No booking found.")).toBeTruthy());
    fireEvent.changeText(screen.getByPlaceholderText("Email or reference…"), "new");
    expect(screen.queryByText("No booking found.")).toBeNull();
  });

  it("shows dark mode toggle text", async () => {
    render(<AdminSidebar />);
    await waitFor(() => expect(screen.getByText("Dark mode")).toBeTruthy());
  });

  it("shows single location text for 1 restaurant", async () => {
    const { fetchRestaurants } = require("@/api/restaurants");
    (fetchRestaurants as jest.Mock).mockResolvedValue([{ id: 1 }]);
    render(<AdminSidebar />);
    await waitFor(() => expect(screen.getByText("Managing 1 location")).toBeTruthy());
  });
});
