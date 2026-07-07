/**
 * @jest-environment jsdom
 */
import { renderHook } from "@testing-library/react-native";
import { useBrandDocumentEffect } from "@/hooks/useBrandDocumentEffect";
import { injectBrandFavicon } from "@/utils/injectBrandFavicon";
import { Brand } from "@/types";

jest.mock("@/utils/injectBrandFavicon", () => ({
  injectBrandFavicon: jest.fn(),
}));

const baseBrand: Brand = {
  appName: "My Resto",
  primaryColor: "#ff5500",
};

beforeEach(() => {
  jest.clearAllMocks();
  document.title = "";
});

describe("useBrandDocumentEffect", () => {
  it("sets document.title to brand.appName when title is empty", () => {
    renderHook(() => useBrandDocumentEffect(baseBrand));
    expect(document.title).toBe("My Resto");
  });

  it("sets document.title when title still equals the default app name", () => {
    document.title = "Open Resto"; // DEFAULT_BRAND.appName
    renderHook(() => useBrandDocumentEffect(baseBrand));
    expect(document.title).toBe("My Resto");
  });

  it("does NOT override a custom document title", () => {
    document.title = "Booking Detail | My Resto";
    renderHook(() => useBrandDocumentEffect(baseBrand));
    expect(document.title).toBe("Booking Detail | My Resto");
  });

  it("calls injectBrandFavicon with the brand", () => {
    renderHook(() => useBrandDocumentEffect(baseBrand));
    expect(injectBrandFavicon).toHaveBeenCalledTimes(1);
    expect(injectBrandFavicon).toHaveBeenCalledWith(baseBrand);
  });

  it("re-runs when appName, primaryColor, or faviconIcon changes", () => {
    const { rerender } = renderHook(
      ({
        appName,
        primaryColor,
        faviconIcon,
      }: {
        appName: string;
        primaryColor: string;
        faviconIcon?: string;
      }) => useBrandDocumentEffect({ appName, primaryColor, faviconIcon }),
      { initialProps: { appName: "A", primaryColor: "#000", faviconIcon: undefined } }
    );

    expect(injectBrandFavicon).toHaveBeenCalledTimes(1);

    // appName change -> re-run
    rerender({ appName: "B", primaryColor: "#000", faviconIcon: undefined });
    expect(injectBrandFavicon).toHaveBeenCalledTimes(2);

    // primaryColor change -> re-run
    rerender({ appName: "B", primaryColor: "#fff", faviconIcon: undefined });
    expect(injectBrandFavicon).toHaveBeenCalledTimes(3);

    // faviconIcon change -> re-run
    rerender({ appName: "B", primaryColor: "#fff", faviconIcon: "utensils" });
    expect(injectBrandFavicon).toHaveBeenCalledTimes(4);

    // The title was claimed on the initial mount (appName="A"); subsequent
    // appName changes must NOT clobber it — same guard as a real route title.
    expect(document.title).toBe("A");
  });

  it("does NOT re-run when only non-DOM brand fields change", () => {
    const { rerender } = renderHook(
      ({ websiteUrl, copyrightText }: { websiteUrl?: string; copyrightText?: string }) =>
        useBrandDocumentEffect({
          appName: "A",
          primaryColor: "#000",
          websiteUrl,
          copyrightText,
        }),
      { initialProps: { websiteUrl: undefined, copyrightText: undefined } }
    );

    expect(injectBrandFavicon).toHaveBeenCalledTimes(1);

    // websiteUrl + copyrightText are deliberately NOT in the deps array
    rerender({ websiteUrl: "https://x.example.com", copyrightText: "© 2026" });
    expect(injectBrandFavicon).toHaveBeenCalledTimes(1);
  });
});
