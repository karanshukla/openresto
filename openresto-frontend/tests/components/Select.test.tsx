/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react-native";
import { Modal, Platform } from "react-native";
import Select from "@/components/common/Select";
import { TYPEAHEAD_RESET_MS } from "@/utils/listboxKeys";
import { useBrand } from "@/context/BrandContext";
import { useColorScheme } from "@/hooks/use-color-scheme";

jest.mock("@/context/BrandContext", () => ({
  useBrand: jest.fn(() => ({ appName: "Test App", primaryColor: "#000" })),
}));

jest.mock("expo-haptics", () => ({
  selectionAsync: jest.fn(),
}));

jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: jest.fn(() => "light"),
}));

const options = [
  { label: "Option 1", value: "1" },
  { label: "Option 2", value: "2" },
];

const PEOPLE = [
  { label: "Anyone", value: "" },
  { label: "Ada Lovelace", value: "1" },
  { label: "Grace Hopper", value: "2" },
];

describe("Select", () => {
  const onSelect = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useColorScheme as jest.Mock).mockReturnValue("light");
  });

  it("renders with selected option", () => {
    render(<Select selectedValue="1" options={options} onSelect={onSelect} />);
    expect(screen.getByText("Option 1")).toBeTruthy();
  });

  it("opens options when pressed and selects new one", () => {
    render(<Select selectedValue="1" options={options} onSelect={onSelect} />);
    fireEvent.press(screen.getByText("Option 1"));
    expect(screen.getByText("Option 2")).toBeTruthy();
    fireEvent.press(screen.getByText("Option 2"));
    expect(onSelect).toHaveBeenCalledWith("2");
  });

  it("shows placeholder when no selectedValue", () => {
    render(<Select options={options} onSelect={onSelect} placeholder="Choose..." />);
    expect(screen.getByText("Choose...")).toBeTruthy();
  });

  it("shows default placeholder when no selectedValue and no placeholder prop", () => {
    render(<Select options={options} onSelect={onSelect} />);
    expect(screen.getByText("Select an option")).toBeTruthy();
  });

  it("defaults to light when useColorScheme returns nothing", () => {
    (useColorScheme as jest.Mock).mockReturnValue(undefined);
    render(<Select selectedValue="1" options={options} onSelect={onSelect} />);
    expect(screen.getByText("Option 1")).toBeTruthy();
  });

  it("renders in dark mode", () => {
    (useColorScheme as jest.Mock).mockReturnValue("dark");
    render(<Select selectedValue="1" options={options} onSelect={onSelect} />);
    fireEvent.press(screen.getByText("Option 1"));
    expect(screen.getByText("Option 2")).toBeTruthy();
  });

  it("shows checkmark on selected item inside the list", () => {
    render(<Select selectedValue="1" options={options} onSelect={onSelect} />);
    fireEvent.press(screen.getByText("Option 1"));
    expect(screen.getByText("✓", { includeHiddenElements: true })).toBeTruthy();
  });

  it("closes the list when the backdrop is pressed", () => {
    render(<Select selectedValue="1" options={options} onSelect={onSelect} />);
    fireEvent.press(screen.getByText("Option 1"));
    expect(screen.getByText("Option 2")).toBeTruthy();
    fireEvent.press(screen.getByTestId("select-backdrop"));
    expect(screen.queryByText("Option 2")).toBeNull();
  });

  it("closes the list when onRequestClose fires (e.g. Android back button)", () => {
    render(<Select selectedValue="1" options={options} onSelect={onSelect} />);
    fireEvent.press(screen.getByText("Option 1"));
    act(() => {
      screen.UNSAFE_getByType(Modal).props.onRequestClose();
    });
    expect(screen.queryByText("Option 2")).toBeNull();
  });

  it("falls back to the default primary color when the brand has none", () => {
    (useBrand as jest.Mock).mockReturnValueOnce({ appName: "Test App", primaryColor: "" });
    render(<Select selectedValue="1" options={options} onSelect={onSelect} />);
    expect(screen.getByText("Option 1")).toBeTruthy();
  });

  it("renders a leading glyph and the label beside it when given an icon", () => {
    render(
      <Select selectedValue="1" options={options} onSelect={onSelect} icon="person-outline" />
    );
    expect(screen.getByText("Option 1")).toBeTruthy();
  });

  it("highlights the trigger border when hovered", () => {
    render(<Select selectedValue="1" options={options} onSelect={onSelect} />);
    let node = screen.getByText("Option 1").parent;
    while (node && typeof node.props?.style !== "function") {
      node = node.parent;
    }
    const styleFn = node?.props.style as (state: { hovered: boolean }) => unknown;
    expect(typeof styleFn).toBe("function");
    expect(styleFn({ hovered: true })).toContainEqual({ borderColor: "#000" });
  });
});

/**
 * The roles a value picker is supposed to carry. It announced itself as a `menu` of
 * `menuitem`s — the pattern for commands — so a screen reader called a control whose whole job
 * is holding a value a menu, and never said which value it held (issue #348).
 */
describe("Select semantics", () => {
  const onSelect = jest.fn();

  it("is a combobox over a listbox of options, not a menu of commands", () => {
    render(<Select selectedValue="1" options={options} onSelect={onSelect} />);

    const trigger = screen.getByRole("combobox");
    expect(trigger.props.accessibilityState.expanded).toBe(false);
    expect(trigger.props["aria-haspopup"]).toBe("listbox");

    fireEvent.press(screen.getByText("Option 1"));

    expect(screen.getByTestId("select-list").props.role).toBe("listbox");
    expect(screen.getAllByRole("option")).toHaveLength(2);
    expect(screen.queryAllByRole("menuitem")).toHaveLength(0);
    expect(screen.getByRole("combobox").props.accessibilityState.expanded).toBe(true);
  });

  it("says which option is selected, and which is highlighted", () => {
    render(<Select selectedValue="2" options={options} onSelect={onSelect} />);
    fireEvent.press(screen.getByText("Option 2"));

    const [first, second] = screen.getAllByRole("option");
    expect(first.props.accessibilityState.selected).toBe(false);
    expect(second.props.accessibilityState.selected).toBe(true);
  });

  it("points the list at the highlighted option once one is highlighted", () => {
    render(<Select options={PEOPLE} onSelect={onSelect} accessibilityLabel="Filter by person" />);

    // Opened by pointer with nothing selected: nothing is highlighted, so nothing is pointed at.
    fireEvent.press(screen.getByText("Select an option"));
    const list = screen.getByTestId("select-list");
    expect(list.props["aria-activedescendant"]).toBeUndefined();

    fireEvent(list, "keyDown", { key: "ArrowDown" });

    const highlighted = screen.getByTestId("select-list").props["aria-activedescendant"];
    expect(highlighted).toBeDefined();
    expect(screen.getAllByRole("option")[0].props.id).toBe(highlighted);
  });

  it("names the trigger with its label and its current value", () => {
    render(
      <Select
        selectedValue="1"
        options={PEOPLE}
        onSelect={onSelect}
        accessibilityLabel="Filter by person"
      />
    );

    expect(screen.getByLabelText("Filter by person, Ada Lovelace")).toBeTruthy();
  });

  /** Fifty rows in the tab order is not a control anyone can get past. */
  it("keeps the options out of the tab order", () => {
    render(<Select selectedValue="1" options={options} onSelect={onSelect} />);
    fireEvent.press(screen.getByText("Option 1"));

    for (const option of screen.getAllByRole("option")) {
      expect(option.props.tabIndex).toBe(-1);
    }
  });
});

/**
 * The control was reachable by keyboard and then unusable with one: no way to open it, move
 * through it, pick from it or get back out (issue #348).
 */
describe("Select keyboard", () => {
  const onSelect = jest.fn();
  const openWithPointer = () => fireEvent.press(screen.getByText("Select an option"));
  const list = () => screen.getByTestId("select-list");
  const press = (key: string, over: Record<string, unknown> = {}) =>
    fireEvent(list(), "keyDown", { key, preventDefault: jest.fn(), ...over });

  beforeEach(() => jest.clearAllMocks());
  // Restores real timers even when the type-ahead test below fails partway, which otherwise
  // hangs every test after it in this file on the testing library's async cleanup.
  afterEach(() => jest.useRealTimers());

  it("opens on an arrow key from the trigger, highlighting the first option", () => {
    render(<Select options={PEOPLE} onSelect={onSelect} />);

    fireEvent(screen.getByRole("combobox"), "keyDown", {
      key: "ArrowDown",
      preventDefault: jest.fn(),
    });

    expect(screen.getAllByRole("option")).toHaveLength(3);
    expect(list().props["aria-activedescendant"]).toBe(screen.getAllByRole("option")[0].props.id);
  });

  it("opens at the current value, so arrowing starts from where the control is", () => {
    render(<Select selectedValue="2" options={PEOPLE} onSelect={onSelect} />);

    fireEvent(screen.getByRole("combobox"), "keyDown", {
      key: "ArrowDown",
      preventDefault: jest.fn(),
    });

    // ArrowDown from "Grace Hopper" (index 2, the last) clamps rather than wrapping.
    expect(list().props["aria-activedescendant"]).toBe(screen.getAllByRole("option")[2].props.id);
  });

  it("ignores a chorded key, so browser shortcuts still work", () => {
    render(<Select options={PEOPLE} onSelect={onSelect} />);

    fireEvent(screen.getByRole("combobox"), "keyDown", { key: "ArrowDown", metaKey: true });

    expect(screen.queryByTestId("select-list")).toBeNull();
  });

  it("leaves a key that does not open the list alone", () => {
    render(<Select options={PEOPLE} onSelect={onSelect} />);

    fireEvent(screen.getByRole("combobox"), "keyDown", { key: "a" });

    expect(screen.queryByTestId("select-list")).toBeNull();
  });

  it("takes the highlighted option on Enter", () => {
    render(<Select options={PEOPLE} onSelect={onSelect} />);
    openWithPointer();

    press("ArrowDown");
    press("ArrowDown");
    press("Enter");

    expect(onSelect).toHaveBeenCalledWith("1");
    expect(screen.queryByTestId("select-list")).toBeNull();
  });

  it("takes the highlighted option on Space", () => {
    render(<Select options={PEOPLE} onSelect={onSelect} />);
    openWithPointer();

    press("End");
    press(" ");

    expect(onSelect).toHaveBeenCalledWith("2");
  });

  it("closes on Escape without picking anything", () => {
    render(<Select options={PEOPLE} onSelect={onSelect} />);
    openWithPointer();

    press("ArrowDown");
    press("Escape");

    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.queryByTestId("select-list")).toBeNull();
  });

  it("closes on Tab, leaving focus to move on", () => {
    render(<Select options={PEOPLE} onSelect={onSelect} />);
    openWithPointer();

    press("Tab");

    expect(screen.queryByTestId("select-list")).toBeNull();
  });

  it("does nothing on Enter while nothing is highlighted", () => {
    render(<Select options={PEOPLE} onSelect={onSelect} />);
    openWithPointer();

    press("Enter");

    expect(onSelect).not.toHaveBeenCalled();
  });

  it("jumps to an option by typing its name", () => {
    render(<Select options={PEOPLE} onSelect={onSelect} />);
    openWithPointer();

    press("g");
    press("Enter");

    expect(onSelect).toHaveBeenCalledWith("2");
  });

  /**
   * The pair that shows the buffer is a timer and not a keystroke count. Both press the same
   * two letters at "Grace Hopper"; only the gap between them differs.
   */
  it("keeps narrowing while the burst is still open", () => {
    jest.useFakeTimers();
    render(<Select options={PEOPLE} onSelect={onSelect} />);
    openWithPointer();

    press("g");
    press("a");
    press("Enter");

    // "ga" matches nothing, so the highlight stays where "g" put it.
    expect(onSelect).toHaveBeenCalledWith("2");
  });

  it("starts a new search once the burst has expired", () => {
    jest.useFakeTimers();
    render(<Select options={PEOPLE} onSelect={onSelect} />);
    openWithPointer();

    press("g");
    act(() => {
      jest.advanceTimersByTime(TYPEAHEAD_RESET_MS + 1);
    });
    press("a");
    press("Enter");

    // A fresh "a" searches on from "Grace Hopper" and wraps round to "Anyone".
    expect(onSelect).toHaveBeenCalledWith("");
  });

  it("ignores a chorded key inside the list", () => {
    render(<Select options={PEOPLE} onSelect={onSelect} />);
    openWithPointer();

    press("Escape", { ctrlKey: true });

    expect(screen.queryByTestId("select-list")).toBeTruthy();
  });
});

/**
 * On web the options hang off the trigger like a dropdown; on native they stay a centred sheet,
 * which is the platform convention. The pair is the point — it is what stops the web fix
 * quietly changing how the pickers behave on a phone.
 */
/**
 * The highlight has to stay visible as it moves, or arrowing past the fourth row of a fifty-row
 * list moves something nobody can see.
 */
/**
 * The highlight has to stay visible as it moves, and has to read stronger than the tint on the
 * row already holding the value — the highlight can land on that row.
 */
describe("Select highlight", () => {
  const onSelect = jest.fn();
  const tintOf = (index: number) =>
    JSON.stringify(screen.getAllByRole("option")[index].props.style);

  it("tints the highlighted row above the selected one", () => {
    render(<Select selectedValue="1" options={PEOPLE} onSelect={onSelect} />);
    // Home highlights "Anyone" while "Ada Lovelace" stays the selected value.
    fireEvent(screen.getByRole("combobox"), "keyDown", { key: "Home", preventDefault: jest.fn() });

    expect(tintOf(0)).toContain("rgba(0,0,0,0.16)");
    expect(tintOf(1)).toContain("rgba(0,0,0,0.08)");
  });

  /**
   * A three-digit brand colour with two hex alpha digits appended is not a colour, and renders
   * as nothing — which is what an open list of options with no highlight at all looks like.
   */
  it("tints against a three-digit brand colour", () => {
    render(<Select selectedValue="1" options={PEOPLE} onSelect={onSelect} />);
    fireEvent(screen.getByRole("combobox"), "keyDown", { key: "Home", preventDefault: jest.fn() });

    expect(tintOf(0)).not.toContain("#00016");
  });

  it("dims an option under the finger", () => {
    render(<Select selectedValue="1" options={PEOPLE} onSelect={onSelect} />);
    fireEvent.press(screen.getByText("Ada Lovelace"));

    // The rendered row carries the style already resolved for "not pressed", so the press state
    // is reached through the callback the Pressable was handed.
    let node = screen.getAllByRole("option")[0].parent;
    while (node && typeof node.props?.style !== "function") {
      node = node.parent;
    }
    const styleFn = node?.props.style as (state: { pressed: boolean }) => unknown[];
    expect(styleFn({ pressed: true })).toContainEqual({ opacity: 0.6 });
  });

  /**
   * The option list is swapped out under an open highlight when a screen's filter data lands —
   * `/admin/activity` loads its people after the first render, so the highlight can end up
   * pointing at a row that no longer exists.
   */
  it("survives the options changing under an open highlight", () => {
    const { rerender } = render(<Select options={PEOPLE} onSelect={onSelect} />);
    fireEvent(screen.getByRole("combobox"), "keyDown", { key: "End", preventDefault: jest.fn() });

    expect(() => rerender(<Select options={[PEOPLE[0]]} onSelect={onSelect} />)).not.toThrow();
  });
});

describe("Select placement", () => {
  const onSelect = jest.fn();
  const originalOS = Platform.OS;
  const setOS = (value: string) =>
    Object.defineProperty(Platform, "OS", { value, configurable: true });

  afterEach(() => setOS(originalOS));

  const isCentredSheet = () =>
    Object.prototype.hasOwnProperty.call(
      screen.getByTestId("select-backdrop").props.style,
      "justifyContent"
    );

  it("keeps the centred sheet on native, which is the platform convention there", () => {
    setOS("ios");

    render(<Select selectedValue="1" options={options} onSelect={onSelect} />);
    fireEvent.press(screen.getByText("Option 1"));

    expect(isCentredSheet()).toBe(true);
  });

  /**
   * Web still falls back to the sheet whenever the trigger reports no box — which is every time
   * under react-test-renderer, where a ref is a component instance rather than a DOM node. That
   * is why the anchored branch is proven in the browser (`e2e/admin-activity.spec.ts`) and its
   * arithmetic in `tests/utils/anchoredPanel.test.ts`, not here.
   */
  it("falls back to the centred sheet on web when the trigger cannot be measured", () => {
    setOS("web");

    render(<Select selectedValue="1" options={options} onSelect={onSelect} />);
    fireEvent.press(screen.getByText("Option 1"));

    expect(isCentredSheet()).toBe(true);
  });
});
