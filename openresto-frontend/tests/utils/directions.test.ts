import { Linking, Platform } from "react-native";
import {
  ANDROID_GEO_SCHEME,
  APPLE_MAPS_SCHEME,
  APPLE_MAPS_SEARCH,
  GOOGLE_MAPS_SEARCH,
  directionsFallbackUrl,
  directionsUrl,
  openDirections,
} from "@/utils/directions";

const onPlatform = async (os: string, body: () => Promise<void> | void) => {
  const original = Platform.OS;
  (Platform as unknown as { OS: string }).OS = os;
  try {
    await body();
  } finally {
    (Platform as unknown as { OS: string }).OS = original;
  }
};

describe("directionsUrl", () => {
  it("hands iOS to the Maps app through its own scheme", () => {
    expect(directionsUrl("1 Main St", "ios")).toBe(`${APPLE_MAPS_SCHEME}1%20Main%20St`);
  });

  it("hands Android to its maps app through a geo intent", () => {
    expect(directionsUrl("1 Main St", "android")).toBe(`${ANDROID_GEO_SCHEME}1%20Main%20St`);
  });

  it("gives web a Google Maps page", () => {
    expect(directionsUrl("1 Main St", "web")).toBe(`${GOOGLE_MAPS_SEARCH}1%20Main%20St`);
  });

  it("reads the running platform when none is given", async () => {
    await onPlatform("ios", () => {
      expect(directionsUrl("Rue de Rivoli")).toBe(`${APPLE_MAPS_SCHEME}Rue%20de%20Rivoli`);
    });
  });
});

describe("directionsFallbackUrl", () => {
  it("falls back to the Apple Maps page on iOS and the Google one elsewhere", () => {
    expect(directionsFallbackUrl("1 Main St", "ios")).toBe(`${APPLE_MAPS_SEARCH}1%20Main%20St`);
    expect(directionsFallbackUrl("1 Main St", "android")).toBe(
      `${GOOGLE_MAPS_SEARCH}1%20Main%20St`
    );
  });
});

describe("openDirections", () => {
  let openURLSpy: jest.SpyInstance;
  beforeEach(() => {
    openURLSpy = jest.spyOn(Linking, "openURL");
    openURLSpy.mockReset();
  });
  afterEach(() => openURLSpy.mockRestore());

  it("opens the platform's maps link for the address", async () => {
    openURLSpy.mockResolvedValue(undefined);
    await onPlatform("android", async () => {
      await openDirections("456 Ocean Ave");
      expect(openURLSpy).toHaveBeenCalledTimes(1);
      expect(openURLSpy).toHaveBeenCalledWith(`${ANDROID_GEO_SCHEME}456%20Ocean%20Ave`);
    });
  });

  it("falls back to the https page when nothing answers the scheme", async () => {
    openURLSpy.mockRejectedValueOnce(new Error("no handler")).mockResolvedValueOnce(undefined);
    await onPlatform("ios", async () => {
      await openDirections("456 Ocean Ave");
      expect(openURLSpy).toHaveBeenCalledTimes(2);
      expect(openURLSpy).toHaveBeenNthCalledWith(1, `${APPLE_MAPS_SCHEME}456%20Ocean%20Ave`);
      expect(openURLSpy).toHaveBeenNthCalledWith(2, `${APPLE_MAPS_SEARCH}456%20Ocean%20Ave`);
    });
  });
});
