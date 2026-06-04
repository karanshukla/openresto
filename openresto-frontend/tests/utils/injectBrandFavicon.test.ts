/**
 * @jest-environment jsdom
 */
import { injectBrandFavicon } from "@/utils/injectBrandFavicon";

jest.mock("@/constants/faviconIcons", () => ({
  buildFaviconDataUri: jest.fn(),
}));

import { buildFaviconDataUri } from "@/constants/faviconIcons";

const mockBrand = {
  appName: "Test Resto",
  primaryColor: "#ff0000",
  faviconIcon: "utensils",
};

const mockPostMessage = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  document.head.innerHTML = "";
  Object.defineProperty(navigator, "serviceWorker", {
    value: { controller: { postMessage: mockPostMessage } },
    configurable: true,
    writable: true,
  });
  (buildFaviconDataUri as jest.Mock).mockReturnValue("data:image/svg+xml,<svg/>");
});

describe("injectBrandFavicon", () => {
  it("posts BRAND_UPDATE to service worker", () => {
    injectBrandFavicon(mockBrand);
    expect(mockPostMessage).toHaveBeenCalledWith({
      type: "BRAND_UPDATE",
      brand: { name: "Test Resto", themeColor: "#ff0000" },
    });
  });

  it("does nothing when document is undefined", () => {
    const originalDocument = global.document;
    // @ts-expect-error intentional
    delete global.document;
    injectBrandFavicon(mockBrand);
    expect(mockPostMessage).not.toHaveBeenCalled();
    global.document = originalDocument;
  });

  it("returns early when faviconIcon is absent", () => {
    injectBrandFavicon({ ...mockBrand, faviconIcon: undefined });
    expect(buildFaviconDataUri).not.toHaveBeenCalled();
  });

  it("returns early when buildFaviconDataUri returns falsy", () => {
    (buildFaviconDataUri as jest.Mock).mockReturnValue(null);
    injectBrandFavicon(mockBrand);
    expect(document.head.querySelectorAll('link[rel="icon"]')).toHaveLength(0);
  });

  it("removes existing favicon links and appends new one", () => {
    const existing = document.createElement("link");
    existing.rel = "icon";
    document.head.appendChild(existing);

    injectBrandFavicon(mockBrand);

    const icons = document.head.querySelectorAll('link[rel="icon"]');
    expect(icons).toHaveLength(1);
    expect((icons[0] as HTMLLinkElement).href).toContain("svg");
    expect((icons[0] as HTMLLinkElement).type).toBe("image/svg+xml");
  });

  it("creates theme-color meta tag when absent", () => {
    injectBrandFavicon(mockBrand);
    const meta = document.head.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    expect(meta).not.toBeNull();
    expect(meta!.content).toBe("#ff0000");
  });

  it("updates existing theme-color meta tag", () => {
    const existing = document.createElement("meta");
    existing.name = "theme-color";
    existing.content = "#000000";
    document.head.appendChild(existing);

    injectBrandFavicon(mockBrand);

    const metas = document.head.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]');
    expect(metas).toHaveLength(1);
    expect(metas[0].content).toBe("#ff0000");
  });

  it("handles missing serviceWorker controller gracefully", () => {
    Object.defineProperty(navigator, "serviceWorker", {
      value: { controller: null },
      configurable: true,
      writable: true,
    });
    expect(() => injectBrandFavicon(mockBrand)).not.toThrow();
  });
});
