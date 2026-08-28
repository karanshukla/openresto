import React from "react";
import { render, screen, waitFor, fireEvent, act } from "@testing-library/react-native";
import AdminSidebar from "@/components/layout/AdminSidebar";
import { AuthProvider } from "@/context/AuthContext";

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

const mockBrand: { primaryColor: string; appName: string; faviconIcon?: string } = {
  primaryColor: "#0a7ea4",
  appName: "Open Resto",
};

jest.mock("@/context/BrandContext", () => ({
  useBrand: () => mockBrand,
}));

jest.mock("@/context/ThemeContext", () => ({
  useTheme: () => ({ toggle: jest.fn() }),
}));

jest.mock("@/api/auth", () => ({
  logout: jest.fn().mockResolvedValue(undefined),
  checkSession: jest.fn().mockResolvedValue({
    id: 1,
    email: "admin@test.com",
    displayName: "Admin Person",
    role: "Owner",
  }),
}));

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
    render(
      <AuthProvider>
        <AdminSidebar />
      </AuthProvider>
    );
    await waitFor(() => expect(screen.getByText("Open Resto")).toBeTruthy());
  });

  it("shows location count after data loads", async () => {
    render(
      <AuthProvider>
        <AdminSidebar />
      </AuthProvider>
    );
    await waitFor(() => expect(screen.getByText("Managing 2 locations")).toBeTruthy());
  });

  it("renders navigation items grouped into sections", async () => {
    render(
      <AuthProvider>
        <AdminSidebar />
      </AuthProvider>
    );
    await waitFor(() => {
      expect(screen.getByText("MANAGE")).toBeTruthy();
      expect(screen.getByText("Overview")).toBeTruthy();
      expect(screen.getByText("Bookings")).toBeTruthy();
      expect(screen.getByText("CONFIGURE")).toBeTruthy();
      expect(screen.getByText("Brand")).toBeTruthy();
      expect(screen.getByText("Email & Push")).toBeTruthy();
      expect(screen.getByText("Account")).toBeTruthy();
    });
  });

  it("shows the Users entry to an Owner", async () => {
    render(
      <AuthProvider>
        <AdminSidebar />
      </AuthProvider>
    );
    await waitFor(() => expect(screen.getByText("Users")).toBeTruthy());
    fireEvent.press(screen.getByText("Users"));
    expect(mockPush).toHaveBeenCalledWith("/admin/settings/users");
  });

  it("hides the Users entry from a Manager", async () => {
    const { checkSession } = require("@/api/auth");
    (checkSession as jest.Mock).mockResolvedValueOnce({
      id: 2,
      email: "manager@test.com",
      displayName: "Manager Person",
      role: "Manager",
    });
    render(
      <AuthProvider>
        <AdminSidebar />
      </AuthProvider>
    );
    await waitFor(() => expect(screen.getByText("CONFIGURE")).toBeTruthy());
    expect(screen.queryByText("Users")).toBeNull();
  });

  it("shows the API Keys entry to an Owner", async () => {
    render(
      <AuthProvider>
        <AdminSidebar />
      </AuthProvider>
    );
    await waitFor(() => expect(screen.getByText("API Keys")).toBeTruthy());
    fireEvent.press(screen.getByText("API Keys"));
    expect(mockPush).toHaveBeenCalledWith("/admin/settings/api-keys");
  });

  it("hides the API Keys entry from a Manager", async () => {
    const { checkSession } = require("@/api/auth");
    (checkSession as jest.Mock).mockResolvedValueOnce({
      id: 2,
      email: "manager@test.com",
      displayName: "Manager Person",
      role: "Manager",
    });
    render(
      <AuthProvider>
        <AdminSidebar />
      </AuthProvider>
    );
    await waitFor(() => expect(screen.getByText("CONFIGURE")).toBeTruthy());
    expect(screen.queryByText("API Keys")).toBeNull();
  });

  it("wears the mark the brand settings selected, not a generic one", async () => {
    mockBrand.faviconIcon = "wine";
    try {
      render(
        <AuthProvider>
          <AdminSidebar />
        </AuthProvider>
      );
      expect(await screen.findByTestId("brand-glyph")).toBeTruthy();
    } finally {
      delete mockBrand.faviconIcon;
    }
  });

  it("wears the generic mark when the brand has selected none", () => {
    render(
      <AuthProvider>
        <AdminSidebar />
      </AuthProvider>
    );
    expect(screen.queryByTestId("brand-glyph")).toBeNull();
  });

  it("navigates to brand settings when Brand is pressed", async () => {
    render(
      <AuthProvider>
        <AdminSidebar />
      </AuthProvider>
    );
    await waitFor(() => expect(screen.getByText("Brand")).toBeTruthy());
    fireEvent.press(screen.getByText("Brand"));
    expect(mockPush).toHaveBeenCalledWith("/admin/settings/brand");
  });

  it("navigates to overview when Overview is pressed", async () => {
    render(
      <AuthProvider>
        <AdminSidebar />
      </AuthProvider>
    );
    await waitFor(() => expect(screen.getByText("Overview")).toBeTruthy());
    fireEvent.press(screen.getByText("Overview"));
    expect(mockPush).toHaveBeenCalledWith("/admin/dashboard");
  });

  it("navigates to bookings when Bookings is pressed", async () => {
    render(
      <AuthProvider>
        <AdminSidebar />
      </AuthProvider>
    );
    await waitFor(() => expect(screen.getByText("Bookings")).toBeTruthy());
    fireEvent.press(screen.getByText("Bookings"));
    expect(mockPush).toHaveBeenCalledWith("/admin/bookings");
  });

  it("calls logout and redirects when Log out is pressed", async () => {
    const { logout } = require("@/api/auth");
    render(
      <AuthProvider>
        <AdminSidebar />
      </AuthProvider>
    );
    await waitFor(() => expect(screen.getByText("Log out")).toBeTruthy());
    await act(async () => {
      fireEvent.press(screen.getByText("Log out"));
    });
    expect(logout).toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith("/admin/login");
  });

  it("navigates to site root when Back to site is pressed", async () => {
    render(
      <AuthProvider>
        <AdminSidebar />
      </AuthProvider>
    );
    await waitFor(() => expect(screen.getByText("Back to site")).toBeTruthy());
    fireEvent.press(screen.getByText("Back to site"));
    expect(mockPush).toHaveBeenCalledWith("/");
  });

  it("shows lookup input and Search button", async () => {
    render(
      <AuthProvider>
        <AdminSidebar />
      </AuthProvider>
    );
    await waitFor(() =>
      expect(screen.getByPlaceholderText("Name, email or reference…")).toBeTruthy()
    );
    expect(screen.getByText("Search")).toBeTruthy();
  });

  it("shows not_found when lookup returns empty", async () => {
    const { adminLookupBookings } = require("@/api/admin");
    (adminLookupBookings as jest.Mock).mockResolvedValue([]);
    render(
      <AuthProvider>
        <AdminSidebar />
      </AuthProvider>
    );
    await waitFor(() =>
      expect(screen.getByPlaceholderText("Name, email or reference…")).toBeTruthy()
    );
    fireEvent.changeText(screen.getByPlaceholderText("Name, email or reference…"), "unknown");
    await act(async () => {
      fireEvent.press(screen.getByText("Search"));
    });
    await waitFor(() => expect(screen.getByText("No booking found.")).toBeTruthy());
  });

  it("opens booking popup when lookup returns single result", async () => {
    const { adminLookupBookings } = require("@/api/admin");
    (adminLookupBookings as jest.Mock).mockResolvedValue([{ id: 42 }]);
    render(
      <AuthProvider>
        <AdminSidebar />
      </AuthProvider>
    );
    await waitFor(() =>
      expect(screen.getByPlaceholderText("Name, email or reference…")).toBeTruthy()
    );
    fireEvent.changeText(
      screen.getByPlaceholderText("Name, email or reference…"),
      "john@example.com"
    );
    await act(async () => {
      fireEvent.press(screen.getByText("Search"));
    });
    await waitFor(() => expect(adminLookupBookings).toHaveBeenCalledWith("john@example.com"));
  });

  it("navigates to bookings with email param when multiple results", async () => {
    const { adminLookupBookings } = require("@/api/admin");
    (adminLookupBookings as jest.Mock).mockResolvedValue([{ id: 1 }, { id: 2 }]);
    render(
      <AuthProvider>
        <AdminSidebar />
      </AuthProvider>
    );
    await waitFor(() =>
      expect(screen.getByPlaceholderText("Name, email or reference…")).toBeTruthy()
    );
    fireEvent.changeText(
      screen.getByPlaceholderText("Name, email or reference…"),
      "multi@example.com"
    );
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
    render(
      <AuthProvider>
        <AdminSidebar />
      </AuthProvider>
    );
    await waitFor(() => expect(screen.getByText("Search")).toBeTruthy());
    await act(async () => {
      fireEvent.press(screen.getByText("Search"));
    });
    expect(adminLookupBookings).not.toHaveBeenCalled();
  });

  it("clears lookup status when query changes", async () => {
    const { adminLookupBookings } = require("@/api/admin");
    (adminLookupBookings as jest.Mock).mockResolvedValue([]);
    render(
      <AuthProvider>
        <AdminSidebar />
      </AuthProvider>
    );
    await waitFor(() =>
      expect(screen.getByPlaceholderText("Name, email or reference…")).toBeTruthy()
    );
    fireEvent.changeText(screen.getByPlaceholderText("Name, email or reference…"), "test");
    await act(async () => {
      fireEvent.press(screen.getByText("Search"));
    });
    await waitFor(() => expect(screen.getByText("No booking found.")).toBeTruthy());
    fireEvent.changeText(screen.getByPlaceholderText("Name, email or reference…"), "new");
    expect(screen.queryByText("No booking found.")).toBeNull();
  });

  it("shows dark mode toggle text", async () => {
    render(
      <AuthProvider>
        <AdminSidebar />
      </AuthProvider>
    );
    await waitFor(() => expect(screen.getByText("Dark mode")).toBeTruthy());
  });

  it("shows single location text for 1 restaurant", async () => {
    const { fetchRestaurants } = require("@/api/restaurants");
    (fetchRestaurants as jest.Mock).mockResolvedValue([{ id: 1 }]);
    render(
      <AuthProvider>
        <AdminSidebar />
      </AuthProvider>
    );
    await waitFor(() => expect(screen.getByText("Managing 1 location")).toBeTruthy());
  });
});
