import React from "react";
import { render, screen, waitFor } from "@testing-library/react-native";
import HomeScreen from "@/app/index";

jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: () => "light",
}));

jest.mock("@/context/BrandContext", () => ({
  useBrand: () => ({ appName: "Open Resto", primaryColor: "#0a7ea4" }),
}));

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

jest.mock("@/context/ThemeContext", () => ({
  useTheme: () => ({ colorScheme: "light", toggle: jest.fn() }),
}));

jest.mock("react-native-safe-area-context", () => {
  const inset = { top: 0, right: 0, bottom: 0, left: 0 };
  return {
    SafeAreaProvider: jest.fn(({ children }) => children),
    SafeAreaConsumer: jest.fn(({ children }) => children(inset)),
    useSafeAreaInsets: jest.fn(() => inset),
    useSafeAreaFrame: jest.fn(() => ({ x: 0, y: 0, width: 0, height: 0 })),
  };
});

jest.mock("expo-router", () => ({
  Link: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  usePathname: () => "/",
  useRouter: () => ({ back: jest.fn() }),
  Stack: {
    Screen: () => null,
  },
}));

jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => ({ width: 1024, height: 768 }),
}));

const mockRestaurants = [
  {
    id: 1,
    name: "Pasta Place",
    address: "123 Main St",
    openTime: "09:00",
    closeTime: "22:00",
    openDays: "1,2,3,4,5,6,7",
    timezone: "UTC",
    sections: [
      {
        id: 1,
        name: "Main",
        restaurantId: 1,
        tables: [{ id: 1, name: "T1", seats: 4, sectionId: 1 }],
      },
    ],
  },
];

jest.mock("@/api/restaurants", () => ({
  fetchRestaurants: jest.fn(() => Promise.resolve(mockRestaurants)),
}));

describe("HomeScreen", () => {
  it("renders the brand name in hero", async () => {
    render(<HomeScreen />);
    await waitFor(() => {
      expect(screen.getAllByText("Open Resto").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("shows restaurant count after loading", async () => {
    render(<HomeScreen />);
    await waitFor(() => {
      expect(screen.getByText("1 restaurant")).toBeTruthy();
    });
  });

  it("renders restaurant cards after loading", async () => {
    render(<HomeScreen />);
    await waitFor(() => {
      expect(screen.getByText("Pasta Place")).toBeTruthy();
    });
  });

  it("shows hero subtitle", async () => {
    render(<HomeScreen />);
    await waitFor(() => {
      expect(
        screen.getByText("Browse available restaurants and book a table in seconds.")
      ).toBeTruthy();
    });
  });
});
