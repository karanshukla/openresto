import React, { useState } from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { Pressable, Text } from "react-native";
import {
  BookingDockProvider,
  useBookingDock,
  useHasBookingDock,
  usePublishBookingDock,
  type BookingDockState,
} from "@/components/booking/BookingDockContext";

const submit = jest.fn();

const dockState = (over: Partial<BookingDockState> = {}): BookingDockState => ({
  holdStatus: "held",
  secondsLeft: 240,
  hasSelection: true,
  holdMessage: null,
  disabled: false,
  submitting: false,
  onSubmit: submit,
  ...over,
});

function Publisher({ dock }: { dock: BookingDockState | null }) {
  usePublishBookingDock(dock);
  return null;
}

/** Reports what reached the host, which is the only observable side of the channel. */
function Consumer() {
  const dock = useBookingDock();
  const hasDock = useHasBookingDock();
  return (
    <Text testID="readout">{`${hasDock ? "hosted" : "none"}:${dock ? dock.secondsLeft : "empty"}`}</Text>
  );
}

const readout = () => screen.getByTestId("readout").props.children;

describe("BookingDockContext", () => {
  beforeEach(() => submit.mockClear());

  it("carries a published submit across to the host", () => {
    render(
      <BookingDockProvider>
        <Publisher dock={dockState()} />
        <Consumer />
      </BookingDockProvider>
    );

    expect(readout()).toBe("hosted:240");
  });

  it("reports a host even before anything is published", () => {
    render(
      <BookingDockProvider>
        <Consumer />
      </BookingDockProvider>
    );

    expect(readout()).toBe("hosted:empty");
  });

  /**
   * `useHasBookingDock` is what tells the form to give up its inline confirm, so outside a
   * provider it has to read false or the website would lose its button entirely.
   */
  it("reports no host outside a provider", () => {
    render(<Consumer />);

    expect(readout()).toBe("none:empty");
  });

  it("withdraws what it published when the form goes away", () => {
    function Harness() {
      const [mounted, setMounted] = useState(true);
      return (
        <BookingDockProvider>
          {mounted && <Publisher dock={dockState()} />}
          <Pressable testID="unmount" onPress={() => setMounted(false)}>
            <Text>unmount</Text>
          </Pressable>
          <Consumer />
        </BookingDockProvider>
      );
    }
    render(<Harness />);
    expect(readout()).toBe("hosted:240");

    fireEvent.press(screen.getByTestId("unmount"));

    // A footer still holding a submit for a form that has gone would press into nothing.
    expect(readout()).toBe("hosted:empty");
  });

  it("clears when the form publishes nothing", () => {
    function Harness() {
      const [ready, setReady] = useState(true);
      return (
        <BookingDockProvider>
          <Publisher dock={ready ? dockState() : null} />
          <Pressable testID="clear" onPress={() => setReady(false)}>
            <Text>clear</Text>
          </Pressable>
          <Consumer />
        </BookingDockProvider>
      );
    }
    render(<Harness />);

    fireEvent.press(screen.getByTestId("clear"));

    expect(readout()).toBe("hosted:empty");
  });

  it("republishes when the countdown moves", () => {
    function Harness() {
      const [left, setLeft] = useState(240);
      return (
        <BookingDockProvider>
          <Publisher dock={dockState({ secondsLeft: left })} />
          <Pressable testID="tick" onPress={() => setLeft(239)}>
            <Text>tick</Text>
          </Pressable>
          <Consumer />
        </BookingDockProvider>
      );
    }
    render(<Harness />);

    fireEvent.press(screen.getByTestId("tick"));

    expect(readout()).toBe("hosted:239");
  });
});
