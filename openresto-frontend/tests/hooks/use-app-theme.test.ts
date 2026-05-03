import { renderHook } from "@testing-library/react-native";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useBrand } from "@/context/BrandContext";
import { getThemeColors } from "@/theme/theme";

jest.mock("@/hooks/use-color-scheme");
jest.mock("@/context/BrandContext");
jest.mock("@/theme/theme");

describe("useAppTheme", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useBrand as jest.Mock).mockReturnValue({ primaryColor: "#007AFF" });
    (getThemeColors as jest.Mock).mockReturnValue({ text: "#000", card: "#fff" });
  });

  it("returns correctly for light mode", () => {
    (useColorScheme as jest.Mock).mockReturnValue("light");
    const { result } = renderHook(() => useAppTheme());

    expect(result.current.isDark).toBe(false);
    expect(result.current.primaryColor).toBe("#007AFF");
    expect(result.current.colors).toEqual({ text: "#000", card: "#fff" });
    expect(getThemeColors).toHaveBeenCalledWith(false);
  });

  it("returns correctly for dark mode", () => {
    (useColorScheme as jest.Mock).mockReturnValue("dark");
    const { result } = renderHook(() => useAppTheme());

    expect(result.current.isDark).toBe(true);
    expect(getThemeColors).toHaveBeenCalledWith(true);
  });

  it("uses default primary color if brand has none", () => {
    (useBrand as jest.Mock).mockReturnValue({ primaryColor: null });
    (useColorScheme as jest.Mock).mockReturnValue("light");
    const { result } = renderHook(() => useAppTheme());

    expect(result.current.primaryColor).toBe("#0a7ea4");
  });

  it("getOpacityColor works correctly", () => {
    (useColorScheme as jest.Mock).mockReturnValue("light");
    const { result } = renderHook(() => useAppTheme());

    const transparentBlue = result.current.getOpacityColor("#0000FF", 0.5);
    // 0.5 * 255 = 127.5 -> 128 (80 in hex) or 127 (7f in hex)
    // Math.round(0.5 * 255) = 128 -> 80
    expect(transparentBlue.toLowerCase()).toBe("#0000ff80");
  });
});
