/**
 * Tests for RestaurantCard image rendering on native (non-web) platforms.
 * Kept separate so Platform.OS can be overridden without affecting web tests.
 */
import { render, screen, waitFor } from "@testing-library/react-native";
import { fetchAvailability } from "@/api/availability";

jest.mock("react-native/Libraries/Utilities/Platform", () => ({
  OS: "ios",
  select: (spec: any) => spec.ios ?? spec.default,
  isTesting: true,
  constants: {},
}));

jest.mock("expo-image", () => ({
  Image: ({ testID, source }: any) =>
    require("react").createElement("Image", { testID: testID ?? "expo-image", source }),
}));

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

jest.mock("@/api/availability", () => ({
  fetchAvailability: jest.fn(),
}));

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock("@/context/BrandContext", () => ({
  useBrand: () => ({ primaryColor: "#0a7ea4", appName: "Test" }),
}));

jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: () => "light",
}));

const mockRestaurant = {
  id: 1,
  name: "Test Bistro",
  address: "123 Main St",
  openTime: "00:00",
  closeTime: "23:59",
  openDays: "1,2,3,4,5,6,7",
  timezone: "UTC",
  tags: [],
  sections: [],
};

describe("RestaurantCard (native platform)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (fetchAvailability as jest.Mock).mockResolvedValue({ slots: [] });
  });

  it("renders expo-image when imageUrl is present on native", async () => {
    const RestaurantCard = require("@/components/restaurant/RestaurantCard").default;
    render(<RestaurantCard restaurant={{ ...mockRestaurant, imageUrl: "/media/photo.jpg" }} />);
    await waitFor(() => expect(screen.getByTestId("expo-image")).toBeTruthy());
  });

  it("does not render expo-image when imageUrl is absent on native", async () => {
    const RestaurantCard = require("@/components/restaurant/RestaurantCard").default;
    render(<RestaurantCard restaurant={mockRestaurant} />);
    await waitFor(() => expect(screen.queryByTestId("expo-image")).toBeNull());
  });
});
