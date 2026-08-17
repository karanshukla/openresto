/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import { Linking } from "react-native";
import OverflowMenu from "@/components/layout/OverflowMenu";
import { fetchSocialLinks } from "@/api/restaurants";

const mockToggle = jest.fn();
let mockBrand: Record<string, unknown> = { appName: "Test App" };

jest.mock("@/hooks/use-app-theme", () => ({
  useAppTheme: () => ({
    colors: { border: "#ccc", muted: "#666", card: "#fff", input: "#eee", text: "#111" },
    isDark: false,
  }),
}));

jest.mock("@/context/ThemeContext", () => ({
  useTheme: () => ({ toggle: mockToggle }),
}));

jest.mock("@/context/BrandContext", () => ({
  useBrand: () => mockBrand,
}));

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

jest.mock("@/api/restaurants", () => ({
  fetchSocialLinks: jest.fn(),
}));

describe("OverflowMenu", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBrand = { appName: "Test App" };
    (fetchSocialLinks as jest.Mock).mockResolvedValue([]);
    jest.spyOn(Linking, "openURL").mockResolvedValue(undefined as never);
  });

  it("opens the panel with Help, dark-mode toggle, and shortcuts rows", () => {
    render(<OverflowMenu onOpenShortcuts={jest.fn()} />);
    fireEvent.press(screen.getByLabelText("Open menu"));
    expect(screen.getByText("Help")).toBeTruthy();
    expect(screen.getByText("Switch to dark mode")).toBeTruthy();
    expect(screen.getByText("Keyboard shortcuts")).toBeTruthy();
  });

  it("calls toggle when the dark-mode row is pressed", () => {
    render(<OverflowMenu onOpenShortcuts={jest.fn()} />);
    fireEvent.press(screen.getByLabelText("Open menu"));
    fireEvent.press(screen.getByLabelText("Switch to dark mode"));
    expect(mockToggle).toHaveBeenCalled();
  });

  it("calls onOpenShortcuts when the shortcuts row is pressed", () => {
    const onOpenShortcuts = jest.fn();
    render(<OverflowMenu onOpenShortcuts={onOpenShortcuts} />);
    fireEvent.press(screen.getByLabelText("Open menu"));
    fireEvent.press(screen.getByLabelText("View keyboard shortcuts"));
    expect(onOpenShortcuts).toHaveBeenCalled();
  });

  it("opens a static Help popup, not a guided tour, when Help is pressed", () => {
    render(<OverflowMenu onOpenShortcuts={jest.fn()} />);
    fireEvent.press(screen.getByLabelText("Open menu"));
    fireEvent.press(screen.getByLabelText("Help"));
    expect(screen.getByText(/Open the Locations page/i)).toBeTruthy();
  });

  it("closes the Help popup when its close button is pressed", () => {
    render(<OverflowMenu onOpenShortcuts={jest.fn()} />);
    fireEvent.press(screen.getByLabelText("Open menu"));
    fireEvent.press(screen.getByLabelText("Help"));
    fireEvent.press(screen.getByTestId("help-close"));
    expect(screen.queryByTestId("help-close")).toBeNull();
  });

  it("closes the Help popup when the backdrop is pressed", () => {
    render(<OverflowMenu onOpenShortcuts={jest.fn()} />);
    fireEvent.press(screen.getByLabelText("Open menu"));
    fireEvent.press(screen.getByLabelText("Help"));
    // aria-modal hides the backdrop from assistive tech by design — it is a pointer-only
    // dismissal, so the query has to opt into hidden elements to reach it.
    fireEvent.press(screen.getByLabelText("Close help", { includeHiddenElements: true }));
    expect(screen.queryByTestId("help-close")).toBeNull();
  });

  it("does not show a website link in Help when none is configured", () => {
    render(<OverflowMenu onOpenShortcuts={jest.fn()} />);
    fireEvent.press(screen.getByLabelText("Open menu"));
    fireEvent.press(screen.getByLabelText("Help"));
    expect(screen.queryByLabelText("Visit our website")).toBeNull();
  });

  it("shows and opens a website link in Help when configured", () => {
    mockBrand = { appName: "Test App", websiteUrl: "https://example.com" };
    render(<OverflowMenu onOpenShortcuts={jest.fn()} />);
    fireEvent.press(screen.getByLabelText("Open menu"));
    fireEvent.press(screen.getByLabelText("Help"));
    fireEvent.press(screen.getByLabelText("Visit our website"));
    expect(Linking.openURL).toHaveBeenCalledWith("https://example.com");
  });

  it("renders no social links when none are configured", async () => {
    render(<OverflowMenu onOpenShortcuts={jest.fn()} />);
    await waitFor(() => expect(fetchSocialLinks).toHaveBeenCalled());
    fireEvent.press(screen.getByLabelText("Open menu"));
    expect(screen.queryByLabelText("Instagram")).toBeNull();
  });

  it("renders configured social links and opens their URL on press", async () => {
    (fetchSocialLinks as jest.Mock).mockResolvedValue([
      {
        id: 1,
        label: "Instagram",
        url: "https://instagram.com/resto",
        iconKey: "logo-instagram",
        sortOrder: 0,
      },
    ]);
    render(<OverflowMenu onOpenShortcuts={jest.fn()} />);
    fireEvent.press(screen.getByLabelText("Open menu"));

    const instagramBtn = await screen.findByLabelText("Instagram");
    fireEvent.press(instagramBtn);
    expect(Linking.openURL).toHaveBeenCalledWith("https://instagram.com/resto");
  });

  it("fades a social button on hover", async () => {
    (fetchSocialLinks as jest.Mock).mockResolvedValue([
      {
        id: 1,
        label: "Instagram",
        url: "https://instagram.com/resto",
        iconKey: "logo-instagram",
        sortOrder: 0,
      },
    ]);
    render(<OverflowMenu onOpenShortcuts={jest.fn()} />);
    fireEvent.press(screen.getByLabelText("Open menu"));

    let node: ReturnType<typeof screen.getByLabelText> | null =
      await screen.findByLabelText("Instagram");
    while (node && typeof node.props?.style !== "function") {
      node = node.parent;
    }
    const styleFn = node?.props.style as (state: { hovered: boolean }) => unknown[];

    expect(styleFn({ hovered: true })).toContainEqual({ opacity: 0.65 });
  });

  it("fades the trigger and its social buttons on hover", () => {
    render(<OverflowMenu onOpenShortcuts={jest.fn()} />);

    let node = screen.getByLabelText("Open menu").parent;
    while (node && typeof node.props?.style !== "function") {
      node = node.parent;
    }
    const styleFn = node?.props.style as (state: { hovered: boolean }) => unknown[];

    expect(styleFn({ hovered: true })).toContainEqual({ opacity: 0.7 });
  });

  /**
   * The menu was reachable by keyboard and then unusable with one (issue #348). It navigates
   * like the `Select` it now shares a primitive with, except that a command list wraps at the
   * ends where a value picker clamps.
   */
  describe("keyboard", () => {
    const menu = () => screen.getByTestId("overflow-menu");
    const press = (key: string, over: Record<string, unknown> = {}) =>
      fireEvent(menu(), "keyDown", { key, preventDefault: jest.fn(), ...over });

    const openWithKey = (key: string) =>
      fireEvent(screen.getByLabelText("Open menu"), "keyDown", {
        key,
        preventDefault: jest.fn(),
      });

    const highlighted = () =>
      screen
        .getAllByRole("menuitem")
        .findIndex((row) => row.props.id === menu().props["aria-activedescendant"]);

    it("opens on an arrow key, at the end the arrow came from", () => {
      render(<OverflowMenu onOpenShortcuts={jest.fn()} />);

      openWithKey("ArrowDown");

      expect(highlighted()).toBe(0);
    });

    it("opens upward onto the last row", () => {
      render(<OverflowMenu onOpenShortcuts={jest.fn()} />);

      openWithKey("ArrowUp");

      expect(highlighted()).toBe(2);
    });

    it("stays shut for a key that is not a way in", () => {
      render(<OverflowMenu onOpenShortcuts={jest.fn()} />);

      openWithKey("a");

      expect(screen.queryByTestId("overflow-menu")).toBeNull();
    });

    it("stays shut for a browser shortcut", () => {
      render(<OverflowMenu onOpenShortcuts={jest.fn()} />);

      fireEvent(screen.getByLabelText("Open menu"), "keyDown", {
        key: "ArrowDown",
        metaKey: true,
      });

      expect(screen.queryByTestId("overflow-menu")).toBeNull();
    });

    it("comes back round at the end, as a command list should", () => {
      render(<OverflowMenu onOpenShortcuts={jest.fn()} />);
      openWithKey("ArrowDown");

      press("ArrowUp");

      expect(highlighted()).toBe(2);
    });

    it("runs the highlighted command on Enter", () => {
      const onOpenShortcuts = jest.fn();
      render(<OverflowMenu onOpenShortcuts={onOpenShortcuts} />);
      openWithKey("ArrowUp");

      press("Enter");

      expect(onOpenShortcuts).toHaveBeenCalledTimes(1);
      expect(screen.queryByTestId("overflow-menu")).toBeNull();
    });

    it("closes on Escape without running anything", () => {
      const onOpenShortcuts = jest.fn();
      render(<OverflowMenu onOpenShortcuts={onOpenShortcuts} />);
      openWithKey("ArrowDown");

      press("Escape");

      expect(onOpenShortcuts).not.toHaveBeenCalled();
      expect(screen.queryByTestId("overflow-menu")).toBeNull();
    });

    it("does nothing on Enter while nothing is highlighted", () => {
      const onOpenShortcuts = jest.fn();
      render(<OverflowMenu onOpenShortcuts={onOpenShortcuts} />);
      fireEvent.press(screen.getByLabelText("Open menu"));

      press("Enter");

      expect(onOpenShortcuts).not.toHaveBeenCalled();
    });

    it("leaves a key it has no use for to the browser", () => {
      const onOpenShortcuts = jest.fn();
      render(<OverflowMenu onOpenShortcuts={onOpenShortcuts} />);
      openWithKey("ArrowDown");

      press("F5", { preventDefault: undefined });

      expect(screen.queryByTestId("overflow-menu")).toBeTruthy();
      expect(onOpenShortcuts).not.toHaveBeenCalled();
    });

    it("ignores a chorded key inside the menu", () => {
      render(<OverflowMenu onOpenShortcuts={jest.fn()} />);
      openWithKey("ArrowDown");

      press("Escape", { ctrlKey: true });

      expect(screen.queryByTestId("overflow-menu")).toBeTruthy();
    });
  });
});
