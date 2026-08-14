/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, act } from "@testing-library/react-native";
import { Text } from "react-native";
import { useAutosave, type AutosaveSaver } from "@/hooks/use-autosave";

/**
 * The cards cover the ordinary path (debounce, dirty check, retry, unmount flush). What lives
 * here is the awkward middle: two saves in flight at once, and a server value that arrives
 * after the form has already written one.
 */
function Harness({
  values,
  saved,
  save,
}: {
  values: { name: string };
  saved: { name: string };
  save: AutosaveSaver<{ name: string }>;
}) {
  const { status, error } = useAutosave({ values, saved, save });
  return (
    <Text testID="state">
      {status}:{error ?? "-"}
    </Text>
  );
}

const state = () => screen.getByTestId("state").props.children.join("");

describe("useAutosave", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("lets the newest save decide the outcome when two overlap", async () => {
    const resolvers: ((message: string | null) => void)[] = [];
    const save = jest.fn(
      () =>
        new Promise<string | null>((resolve) => {
          resolvers.push(resolve);
        })
    );
    const saved = { name: "a" };
    const { rerender } = render(<Harness values={{ name: "b" }} saved={saved} save={save} />);

    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    rerender(<Harness values={{ name: "c" }} saved={saved} save={save} />);
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    expect(save).toHaveBeenCalledTimes(2);

    // The first attempt fails *after* the second one started: its message must not surface.
    await act(async () => {
      resolvers[0]("Stale failure.");
    });
    expect(state()).toBe("saving:-");

    await act(async () => {
      resolvers[1](null);
    });
    expect(state()).toBe("saved:-");
  });

  it("saves again when the server value changes back under an already-written form", async () => {
    const save = jest.fn<Promise<string | null>, [{ name: string }]>().mockResolvedValue(null);
    const { rerender } = render(
      <Harness values={{ name: "b" }} saved={{ name: "a" }} save={save} />
    );
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    expect(save).toHaveBeenCalledTimes(1);

    // Something else changed the record: the form's value is dirty against it again.
    rerender(<Harness values={{ name: "b" }} saved={{ name: "z" }} save={save} />);
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    expect(save).toHaveBeenCalledTimes(2);
  });

  it("drops the indicator back to idle when a new edit supersedes a saved one", async () => {
    const save = jest.fn<Promise<string | null>, [{ name: string }]>().mockResolvedValue(null);
    const saved = { name: "a" };
    const { rerender } = render(<Harness values={{ name: "b" }} saved={saved} save={save} />);
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    expect(state()).toBe("saved:-");

    rerender(<Harness values={{ name: "bc" }} saved={saved} save={save} />);
    expect(state()).toBe("idle:-");
  });
});
