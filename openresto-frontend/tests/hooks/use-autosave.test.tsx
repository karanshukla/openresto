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

/** Owns the value it edits, so an undo has real form state to put back. */
function UndoHarness({
  save,
  initial = "before",
}: {
  save: AutosaveSaver<{ name: string }>;
  initial?: string;
}) {
  const [name, setName] = React.useState(initial);
  const { status, undo } = useAutosave({
    values: { name },
    saved: { name: initial },
    save,
    onRestore: (previous) => setName(previous.name),
  });
  return (
    <>
      <Text testID="state">
        {status}:{undo ? "undoable" : "-"}
      </Text>
      <Text testID="name">{name}</Text>
      <Text testID="edit" onPress={() => setName("after")}>
        edit
      </Text>
      <Text testID="undo" onPress={() => undo?.()}>
        undo
      </Text>
    </>
  );
}

const nameShown = () => screen.getByTestId("name").props.children;

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

  it("offers an undo once a save lands, and puts the old value back on both sides", async () => {
    const save = jest.fn<Promise<string | null>, [{ name: string }]>(async () => null);
    render(<UndoHarness save={save} />);

    await act(async () => {
      screen.getByTestId("edit").props.onPress();
    });
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    expect(save).toHaveBeenCalledWith({ name: "after" });
    expect(state()).toBe("saved:undoable");

    await act(async () => {
      screen.getByTestId("undo").props.onPress();
    });
    // The form is back where it started, and the server was told so rather than left holding
    // the value the admin just took back.
    expect(nameShown()).toBe("before");
    expect(save).toHaveBeenLastCalledWith({ name: "before" });
    expect(save).toHaveBeenCalledTimes(2);
  });

  it("does not re-save the restored value a second time through the debounce", async () => {
    const save = jest.fn<Promise<string | null>, [{ name: string }]>(async () => null);
    render(<UndoHarness save={save} />);

    await act(async () => {
      screen.getByTestId("edit").props.onPress();
    });
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    await act(async () => {
      screen.getByTestId("undo").props.onPress();
    });
    await act(async () => {
      jest.advanceTimersByTime(2000);
    });
    expect(save).toHaveBeenCalledTimes(2);
  });

  it("withdraws the offer once the window passes", async () => {
    const save = jest.fn<Promise<string | null>, [{ name: string }]>(async () => null);
    render(<UndoHarness save={save} />);

    await act(async () => {
      screen.getByTestId("edit").props.onPress();
    });
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    expect(state()).toBe("saved:undoable");

    await act(async () => {
      jest.advanceTimersByTime(10_000);
    });
    expect(state()).toBe("saved:-");
  });

  it("offers nothing to undo when the save failed", async () => {
    const save = jest.fn<Promise<string | null>, [{ name: string }]>(async () => "Nope.");
    render(<UndoHarness save={save} />);

    await act(async () => {
      screen.getByTestId("edit").props.onPress();
    });
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    expect(state()).toBe("error:-");
  });

  it("has no undo at all when the caller cannot restore its own state", async () => {
    const save = jest.fn<Promise<string | null>, [{ name: string }]>(async () => null);
    const { rerender } = render(
      <Harness values={{ name: "a" }} saved={{ name: "a" }} save={save} />
    );
    rerender(<Harness values={{ name: "b" }} saved={{ name: "a" }} save={save} />);
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    // Harness passes no onRestore, so the save lands but nothing is on offer to put back.
    expect(state()).toBe("saved:-");
  });
});
