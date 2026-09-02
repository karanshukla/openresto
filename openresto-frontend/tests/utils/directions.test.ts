import { Linking, Platform } from "react-native";
import {
  APPLE_MAPS_SEARCH,
  GOOGLE_MAPS_SEARCH,
  directionsUrl,
  openDirections,
} from "@/utils/directions";

describe("directionsUrl", () => {
  it("hands iOS to Apple Maps", () => {
    expect(directionsUrl("1 Main St", "ios")).toBe(`${APPLE_MAPS_SEARCH}1%20Main%20St`);
  });

  it("hands Android to Google Maps", () => {
    expect(directionsUrl("1 Main St", "android")).toBe(`${GOOGLE_MAPS_SEARCH}1%20Main%20St`);
  });

  it("defaults web to Google Maps", () => {
    expect(directionsUrl("1 Main St", "web")).toBe(`${GOOGLE_MAPS_SEARCH}1%20Main%20St`);
  });

  it("reads the running platform when none is given", () => {
    const original = Platform.OS;
    (Platform as unknown as { OS: string }).OS = "ios";
    try {
      expect(directionsUrl("Rue de Rivoli")).toBe(`${APPLE_MAPS_SEARCH}Rue%20de%20Rivoli`);
    } finally {
      (Platform as unknown as { OS: string }).OS = original;
    }
  });
});

describe("openDirections", () => {
  it("opens the platform's maps link for the address", async () => {
    const openURLSpy = jest.spyOn(Linking, "openURL").mockResolvedValue(undefined);
    await openDirections("456 Ocean Ave");
    expect(openURLSpy).toHaveBeenCalledWith(directionsUrl("456 Ocean Ave"));
    openURLSpy.mockRestore();
  });
});
