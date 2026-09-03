import React, { forwardRef, useImperativeHandle, type RefObject } from "react";
import { render, screen } from "@testing-library/react-native";
import { Platform, ScrollView, Text, View } from "react-native";
import KeyboardAwareScroll, {
  useScrollFieldIntoView,
} from "@/components/common/KeyboardAwareScroll";
import { FIELD_SCROLL_PADDING } from "@/utils/keyboardAwareScroll";

/** Captures the component's keyboard listeners so the test can fire them in either order. */
const listeners: Record<string, ((e: unknown) => void) | undefined> = {};
jest.mock("react-native", () => {
  const rn = jest.requireActual("react-native");
  Object.defineProperty(rn, "Keyboard", {
    configurable: true,
    value: {
      addListener: (event: string, cb: (e: unknown) => void) => {
        listeners[event] = cb;
        return { remove: () => delete listeners[event] };
      },
    },
  });
  return rn;
});

const KEYBOARD_TOP = 1800;
const showKeyboard = () =>
  listeners.keyboardDidShow?.({ endCoordinates: { screenY: KEYBOARD_TOP } });
const hideKeyboard = () => listeners.keyboardDidHide?.({});

const setPlatform = (os: string) =>
  Object.defineProperty(Platform, "OS", { value: os, configurable: true });

const scrollTo = jest.fn();

/** Stands in for whichever scroller the caller supplied, exposing only what the shell uses. */
const FakeScroll = forwardRef<unknown, { children?: React.ReactNode }>(function FakeScroll(
  { children, ...props },
  ref
) {
  useImperativeHandle(ref, () => ({ scrollTo }));
  return (
    <View testID="scroller" {...props}>
      {children}
    </View>
  );
});

/** Hands the context function back to the test, which is the only way to observe it. */
let reveal: ((field: RefObject<View | null>) => void) | null = null;
function Probe() {
  reveal = useScrollFieldIntoView();
  return <Text>field</Text>;
}

/** A field reporting where it sits on the display, since nothing lays out in jsdom. */
const fieldAt = (bottom: number, height = 44) =>
  ({
    current: {
      measureInWindow: (cb: (x: number, y: number, w: number, h: number) => void) =>
        cb(0, bottom - height, 0, height),
    },
  }) as unknown as RefObject<View | null>;

const renderScroll = () =>
  render(
    <KeyboardAwareScroll as={FakeScroll as never}>
      <Probe />
    </KeyboardAwareScroll>
  );

const scrollToOffset = (y: number) =>
  screen.getByTestId("scroller").props.onScroll({ nativeEvent: { contentOffset: { y } } });

describe("KeyboardAwareScroll", () => {
  beforeEach(() => {
    scrollTo.mockClear();
    reveal = null;
  });

  describe("on web", () => {
    beforeEach(() => setPlatform("web"));

    /**
     * A browser scrolls the focused field into view itself, so the website keeps exactly the
     * scroller it had — no context, and no scroll tracking on the node.
     */
    it("offers no reveal, so an Input inside stays a bare input", () => {
      renderScroll();

      expect(screen.getByText("field")).toBeTruthy();
      expect(reveal).toBeNull();
    });

    it("adds no scroll tracking of its own", () => {
      renderScroll();

      expect(screen.getByTestId("scroller").props.onScroll).toBeUndefined();
    });
  });

  describe("off web", () => {
    beforeEach(() => setPlatform("ios"));
    afterEach(() => hideKeyboard());

    it("tracks the offset the resolver needs", () => {
      renderScroll();

      const scroller = screen.getByTestId("scroller");
      expect(typeof scroller.props.onScroll).toBe("function");
      expect(scroller.props.scrollEventThrottle).toBe(16);
    });

    /**
     * The two orders this has to survive. Tapping a field with the keyboard down focuses first
     * and raises the keyboard after; moving between fields with it already up fires no keyboard
     * event at all, so the focus is the only signal there will be.
     */
    it("lifts a covered field when the keyboard arrives after the focus", () => {
      renderScroll();

      reveal?.(fieldAt(1900));
      expect(scrollTo).not.toHaveBeenCalled();

      showKeyboard();

      expect(scrollTo).toHaveBeenCalledWith({
        y: 1900 + FIELD_SCROLL_PADDING - KEYBOARD_TOP,
        animated: true,
      });
    });

    it("lifts a covered field focused while the keyboard is already up", () => {
      renderScroll();
      showKeyboard();
      scrollTo.mockClear();

      reveal?.(fieldAt(1900));

      expect(scrollTo).toHaveBeenCalledWith({
        y: 1900 + FIELD_SCROLL_PADDING - KEYBOARD_TOP,
        animated: true,
      });
    });

    it("scrolls from wherever the scroller already is", () => {
      renderScroll();
      showKeyboard();
      scrollToOffset(500);
      scrollTo.mockClear();

      reveal?.(fieldAt(1900));

      expect(scrollTo).toHaveBeenCalledWith({
        y: 500 + 1900 + FIELD_SCROLL_PADDING - KEYBOARD_TOP,
        animated: true,
      });
    });

    it("leaves a field the keyboard never reached where it is", () => {
      renderScroll();
      showKeyboard();
      scrollTo.mockClear();

      reveal?.(fieldAt(1000));

      expect(scrollTo).not.toHaveBeenCalled();
    });

    // The keyboard going away ends the story; a later one must not move the old field.
    it("forgets the field once the keyboard closes", () => {
      renderScroll();
      reveal?.(fieldAt(1900));
      hideKeyboard();
      scrollTo.mockClear();

      showKeyboard();

      expect(scrollTo).not.toHaveBeenCalled();
    });

    it("does nothing when the field has gone before the keyboard arrives", () => {
      renderScroll();

      reveal?.({ current: null } as RefObject<View | null>);
      showKeyboard();

      expect(scrollTo).not.toHaveBeenCalled();
    });

    it("defaults to a plain ScrollView when given no scroller", () => {
      render(
        <KeyboardAwareScroll>
          <Probe />
        </KeyboardAwareScroll>
      );

      expect(screen.UNSAFE_getByType(ScrollView)).toBeTruthy();
    });
  });
});
