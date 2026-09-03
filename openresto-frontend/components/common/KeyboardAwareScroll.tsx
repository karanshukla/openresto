import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ComponentType,
  type ReactNode,
  type RefObject,
} from "react";
import {
  Keyboard,
  Platform,
  ScrollView,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type StyleProp,
  type View,
  type ViewStyle,
} from "react-native";
import { scrollOffsetForField } from "@/utils/keyboardAwareScroll";

type ScrollFieldIntoView = (fieldRef: RefObject<View | null>) => void;

const KeyboardAwareScrollContext = createContext<ScrollFieldIntoView | null>(null);

/**
 * Asks the enclosing `KeyboardAwareScroll` to bring a field clear of the keyboard. Returns `null`
 * outside one, and on web, where the browser scrolls a focused field into view itself — the same
 * split `KeyboardAvoider` makes, and for the same reason.
 */
export function useScrollFieldIntoView(): ScrollFieldIntoView | null {
  return useContext(KeyboardAwareScrollContext);
}

/**
 * The subset of ScrollView this needs from whichever scroller it wraps. `BottomSheetScrollView`
 * is a different component with a compatible surface rather than a subclass, so the slot is
 * typed structurally — the same reason `BookingDrawer`'s `ScrollShell` is.
 */
type ScrollShell = ComponentType<{
  ref?: RefObject<ScrollView | null>;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  keyboardShouldPersistTaps?: boolean | "always" | "handled" | "never";
  onScroll?: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
  scrollEventThrottle?: number;
  children?: ReactNode;
}>;

/**
 * A scroller that keeps the focused field clear of the keyboard.
 *
 * Nothing in React Native does this: `KeyboardAvoidingView` pads the container, the booking
 * sheet's `keyboardBehavior="interactive"` resizes the sheet, and Android's `adjustResize`
 * resizes the window — all three move the *container*, and none of them move the field within
 * the scroller, so a form long enough to scroll put the field being typed in behind the
 * keyboard.
 *
 * Two things make it work everywhere the app has a form. The field is measured with
 * `measureInWindow` and compared against the keyboard's own reported top edge, so it needs no
 * reference to the scroller's content view — which the sheet's scroller does not expose, and
 * which the New Architecture would reject as a `findNodeHandle` number anyway. And the scroll is
 * attempted both after focus and again on `keyboardDidShow`, because the two arrive in either
 * order: tapping a field with the keyboard down raises it after the focus, while moving between
 * fields with it already up fires no keyboard event at all.
 *
 * @see [KeyboardAwareScroll.test.tsx](../../tests/components/common/KeyboardAwareScroll.test.tsx)
 * — pins the web pass-through, and that either order of focus and keyboard lands the scroll.
 * @see [keyboardAwareScroll.test.ts](../../tests/utils/keyboardAwareScroll.test.ts) — pins which
 * geometry scrolls and which is left alone.
 */
export function KeyboardAwareScroll({
  as: Scroll = ScrollView,
  scrollRef: externalRef,
  onScroll,
  children,
  ...rest
}: {
  /** The scroller to render. Defaults to a plain `ScrollView`. */
  as?: ScrollShell;
  /** Supply one where the caller also scrolls the view itself (a scroll-to-top control). */
  scrollRef?: RefObject<ScrollView | null>;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  keyboardShouldPersistTaps?: boolean | "always" | "handled" | "never";
  onScroll?: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
  children?: ReactNode;
}) {
  const ownRef = useRef<ScrollView | null>(null);
  const scrollRef = externalRef ?? ownRef;

  // None of this is rendered, and moving it into state would re-render the whole form on every
  // scroll frame and every focus.
  const scrollOffset = useRef(0);
  const keyboardTop = useRef(0);
  const focusedField = useRef<RefObject<View | null> | null>(null);

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollOffset.current = e.nativeEvent.contentOffset.y;
      onScroll?.(e);
    },
    [onScroll]
  );

  const reveal = useCallback(() => {
    const field = focusedField.current?.current;
    if (!field) return;

    field.measureInWindow((_x, y, _w, height) => {
      const target = scrollOffsetForField({
        fieldBottom: y + height,
        keyboardTop: keyboardTop.current,
        scrollOffset: scrollOffset.current,
      });
      if (target !== null) scrollRef.current?.scrollTo({ y: target, animated: true });
    });
  }, [scrollRef]);

  const onWeb = Platform.OS === "web";

  useEffect(() => {
    if (onWeb) return;
    const shown = Keyboard.addListener("keyboardDidShow", (e) => {
      keyboardTop.current = e.endCoordinates.screenY;
      reveal();
    });
    const hidden = Keyboard.addListener("keyboardDidHide", () => {
      keyboardTop.current = 0;
      focusedField.current = null;
    });
    return () => {
      shown.remove();
      hidden.remove();
    };
  }, [onWeb, reveal]);

  const scrollFieldIntoView = useCallback<ScrollFieldIntoView>(
    (fieldRef) => {
      focusedField.current = fieldRef;
      // Where the keyboard is already up this focus is the only signal there will be; where it
      // is not, `keyboardDidShow` follows and does the real work with a measurable keyboard.
      reveal();
    },
    [reveal]
  );

  const value = useMemo(() => (onWeb ? null : scrollFieldIntoView), [onWeb, scrollFieldIntoView]);

  // A browser scrolls the focused field into view on its own, so the website keeps exactly the
  // scroller it had: no context, no measurement, no extra props on the node.
  if (onWeb) {
    return (
      <Scroll ref={scrollRef} {...rest}>
        {children}
      </Scroll>
    );
  }

  return (
    <KeyboardAwareScrollContext.Provider value={value}>
      <Scroll ref={scrollRef} onScroll={handleScroll} scrollEventThrottle={16} {...rest}>
        {children}
      </Scroll>
    </KeyboardAwareScrollContext.Provider>
  );
}

export default KeyboardAwareScroll;
