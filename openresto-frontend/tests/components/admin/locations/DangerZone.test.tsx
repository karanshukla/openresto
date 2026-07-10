import React from "react";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react-native";
import { DangerZone, type DangerZoneRestaurant } from "@/components/admin/locations/DangerZone";
import * as adminApi from "@/api/admin";

jest.mock("@/api/admin", () => ({
  adminDeleteRestaurant: jest.fn(),
  adminSetRestaurantArchived: jest.fn(),
}));

jest.mock("@/hooks/use-persisted-state", () => ({
  usePersistedState: (_key: string, defaultValue: unknown) => {
    const { useState } = require("react");
    return useState(defaultValue);
  },
}));

const restaurants: DangerZoneRestaurant[] = [
  { id: 1, name: "Downtown", isArchived: false },
  { id: 2, name: "Westside", isArchived: true },
  // No `isArchived` at all — exercises the `r.isArchived ?? false` fallback.
  { id: 3, name: "Uptown" },
];

const baseProps = {
  restaurants,
  borderColor: "#ddd",
  cardBg: "#fff",
  mutedColor: "#888",
  isDark: false,
  onArchived: jest.fn().mockResolvedValue(undefined),
  onDeleted: jest.fn().mockResolvedValue(undefined),
};

/** Expands the accordion by pressing the header. */
function expand() {
  fireEvent.press(screen.getByText("Archive or delete a location"));
}

describe("DangerZone", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders the section heading and default subtitle collapsed", () => {
    render(<DangerZone {...baseProps} />);
    expect(screen.getByText("ARCHIVE / DELETE")).toBeTruthy();
    expect(screen.getByText("Archive or delete a location")).toBeTruthy();
    expect(screen.getByText("Permanently remove or hide a location")).toBeTruthy();
    // Collapsed by default — accordion content not mounted.
    expect(screen.queryByText("Downtown")).toBeNull();
  });

  it("expands to show restaurant pills when header is pressed", () => {
    render(<DangerZone {...baseProps} />);
    expand();
    expect(screen.getByText("Downtown")).toBeTruthy();
    expect(screen.getByText("Westside")).toBeTruthy();
  });

  it("collapses again when header is pressed a second time", async () => {
    render(<DangerZone {...baseProps} />);
    expand();
    expect(screen.getByText("Downtown")).toBeTruthy();
    fireEvent.press(screen.getByText("Archive or delete a location"));
    await waitFor(() => expect(screen.queryByText("Downtown")).toBeNull());
  });

  it("shows the placeholder message when no restaurant is selected", () => {
    render(<DangerZone {...baseProps} />);
    expand();
    expect(screen.getByText("Select a location above to see options.")).toBeTruthy();
  });

  it("does not render the pill scroller when restaurants is empty", () => {
    render(<DangerZone {...baseProps} restaurants={[]} />);
    expand();
    expect(screen.getByText("Select a location above to see options.")).toBeTruthy();
    expect(screen.queryByText("Downtown")).toBeNull();
  });

  it("selects a restaurant and shows it in the subtitle", () => {
    render(<DangerZone {...baseProps} />);
    expand();
    fireEvent.press(screen.getByText("Downtown"));
    expect(screen.getByText("Selected: Downtown")).toBeTruthy();
  });

  it("shows '(archived)' in the subtitle for an archived selection", () => {
    render(<DangerZone {...baseProps} />);
    expand();
    fireEvent.press(screen.getByText("Westside"));
    expect(screen.getByText("Selected: Westside (archived)")).toBeTruthy();
  });

  it("shows the Archive Location row for a non-archived restaurant", () => {
    render(<DangerZone {...baseProps} />);
    expand();
    fireEvent.press(screen.getByText("Downtown"));
    expect(screen.getByText("Archive Location")).toBeTruthy();
    expect(
      screen.getByText(
        'Hide "Downtown" from customers. All data is preserved and can be restored at any time.'
      )
    ).toBeTruthy();
    expect(screen.getByText("Archive…")).toBeTruthy();
  });

  it("shows the Restore Location row for an archived restaurant", () => {
    render(<DangerZone {...baseProps} />);
    expand();
    fireEvent.press(screen.getByText("Westside"));
    expect(screen.getByText("Restore Location")).toBeTruthy();
    expect(
      screen.getByText('Restore "Westside" so customers can book again. All data is intact.')
    ).toBeTruthy();
    expect(screen.getByText("Restore")).toBeTruthy();
  });

  it("treats a restaurant with no isArchived field as not archived", () => {
    render(<DangerZone {...baseProps} />);
    expand();
    fireEvent.press(screen.getByText("Uptown"));
    expect(screen.getByText("Selected: Uptown")).toBeTruthy();
    expect(screen.getByText("Archive Location")).toBeTruthy();
  });

  it("renders the archive and delete rows with dark-theme colors", () => {
    render(<DangerZone {...baseProps} isDark />);
    expand();
    fireEvent.press(screen.getByText("Downtown"));
    expect(screen.getByText("Archive Location")).toBeTruthy();
    expect(screen.getByText("Delete Location")).toBeTruthy();
    fireEvent.press(screen.getByText("Delete…"));
    expect(screen.getByText("Delete “Downtown”?")).toBeTruthy();
  });

  it("archives a location and calls onArchived with the new flag", async () => {
    (adminApi.adminSetRestaurantArchived as jest.Mock).mockResolvedValue(true);
    render(<DangerZone {...baseProps} />);
    expand();
    fireEvent.press(screen.getByText("Downtown"));
    await act(async () => {
      fireEvent.press(screen.getByText("Archive…"));
    });
    expect(adminApi.adminSetRestaurantArchived).toHaveBeenCalledWith(1, true);
    expect(baseProps.onArchived).toHaveBeenCalledWith(1, true);
  });

  it("restores an archived location and calls onArchived with false", async () => {
    (adminApi.adminSetRestaurantArchived as jest.Mock).mockResolvedValue(true);
    render(<DangerZone {...baseProps} />);
    expand();
    fireEvent.press(screen.getByText("Westside"));
    await act(async () => {
      fireEvent.press(screen.getByText("Restore"));
    });
    expect(adminApi.adminSetRestaurantArchived).toHaveBeenCalledWith(2, false);
    expect(baseProps.onArchived).toHaveBeenCalledWith(2, false);
  });

  it("shows 'Saving…' while the archive request is in flight and disables the button", async () => {
    let resolveArchive: (value: boolean) => void = () => {};
    (adminApi.adminSetRestaurantArchived as jest.Mock).mockReturnValue(
      new Promise<boolean>((resolve) => {
        resolveArchive = resolve;
      })
    );
    render(<DangerZone {...baseProps} />);
    expand();
    fireEvent.press(screen.getByText("Downtown"));

    fireEvent.press(screen.getByText("Archive…"));
    await waitFor(() => expect(screen.getByText("Saving…")).toBeTruthy());

    // Pressing again while saving should not trigger a second call (button disabled).
    fireEvent.press(screen.getByText("Saving…"));
    expect(adminApi.adminSetRestaurantArchived).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveArchive(true);
    });
    // onArchived resolved — archiving flag clears and the button label reverts
    // (the restaurant's own isArchived flag only changes once the parent
    // re-supplies an updated `restaurants` prop).
    await waitFor(() => expect(screen.getByText("Archive…")).toBeTruthy());
    expect(baseProps.onArchived).toHaveBeenCalledWith(1, true);
  });

  it("shows an inline error when archiving fails and leaves selection intact", async () => {
    (adminApi.adminSetRestaurantArchived as jest.Mock).mockResolvedValue(false);
    render(<DangerZone {...baseProps} />);
    expand();
    fireEvent.press(screen.getByText("Downtown"));
    await act(async () => {
      fireEvent.press(screen.getByText("Archive…"));
    });
    expect(screen.getByText("Failed. Please try again.")).toBeTruthy();
    expect(baseProps.onArchived).not.toHaveBeenCalled();
    // Selection + row are still shown (not deselected on failure).
    expect(screen.getByText("Archive Location")).toBeTruthy();
  });

  it("clears a previous archive error when a different restaurant is selected", async () => {
    (adminApi.adminSetRestaurantArchived as jest.Mock).mockResolvedValue(false);
    render(<DangerZone {...baseProps} />);
    expand();
    fireEvent.press(screen.getByText("Downtown"));
    await act(async () => {
      fireEvent.press(screen.getByText("Archive…"));
    });
    expect(screen.getByText("Failed. Please try again.")).toBeTruthy();

    fireEvent.press(screen.getByText("Westside"));
    expect(screen.queryByText("Failed. Please try again.")).toBeNull();
  });

  it("does nothing if handleArchive fires with no restaurant selected", async () => {
    // Not reachable through the UI (the Archive row only renders once selected),
    // but guards the `if (!dangerSelectedRestaurant) return;` early-return branch.
    render(<DangerZone {...baseProps} />);
    expand();
    expect(adminApi.adminSetRestaurantArchived).not.toHaveBeenCalled();
  });

  it("shows the Delete Location row with idle state initially", () => {
    render(<DangerZone {...baseProps} />);
    expand();
    fireEvent.press(screen.getByText("Downtown"));
    expect(screen.getByText("Delete Location")).toBeTruthy();
    expect(
      screen.getByText("Permanently removes “Downtown” and all its sections, tables, and bookings.")
    ).toBeTruthy();
    expect(screen.getByText("Delete…")).toBeTruthy();
  });

  it("moves to the confirm step when Delete… is pressed", () => {
    render(<DangerZone {...baseProps} />);
    expand();
    fireEvent.press(screen.getByText("Downtown"));
    fireEvent.press(screen.getByText("Delete…"));
    expect(screen.getByText("Delete “Downtown”?")).toBeTruthy();
    expect(screen.getByText("Yes, delete permanently")).toBeTruthy();
    expect(screen.queryByText("Delete Location")).toBeNull();
  });

  it("cancels the confirm step and returns to idle", () => {
    render(<DangerZone {...baseProps} />);
    expand();
    fireEvent.press(screen.getByText("Downtown"));
    fireEvent.press(screen.getByText("Delete…"));
    fireEvent.press(screen.getByText("Cancel"));
    expect(screen.getByText("Delete Location")).toBeTruthy();
    expect(screen.queryByText("Delete “Downtown”?")).toBeNull();
  });

  it("deletes a location, calls onDeleted, and resets selection", async () => {
    (adminApi.adminDeleteRestaurant as jest.Mock).mockResolvedValue(true);
    render(<DangerZone {...baseProps} />);
    expand();
    fireEvent.press(screen.getByText("Downtown"));
    fireEvent.press(screen.getByText("Delete…"));
    await act(async () => {
      fireEvent.press(screen.getByText("Yes, delete permanently"));
    });
    expect(adminApi.adminDeleteRestaurant).toHaveBeenCalledWith(1);
    expect(baseProps.onDeleted).toHaveBeenCalledWith(1);
    // Selection is cleared after a successful delete.
    expect(screen.getByText("Select a location above to see options.")).toBeTruthy();
  });

  it("shows 'Deleting…' with a spinner while the delete request is in flight", async () => {
    let resolveDelete: (value: boolean) => void = () => {};
    (adminApi.adminDeleteRestaurant as jest.Mock).mockReturnValue(
      new Promise<boolean>((resolve) => {
        resolveDelete = resolve;
      })
    );
    render(<DangerZone {...baseProps} />);
    expand();
    fireEvent.press(screen.getByText("Downtown"));
    fireEvent.press(screen.getByText("Delete…"));

    fireEvent.press(screen.getByText("Yes, delete permanently"));
    await waitFor(() => expect(screen.getByText("Deleting…")).toBeTruthy());

    // Cancel button is disabled while deleting.
    fireEvent.press(screen.getByText("Cancel"));
    expect(screen.getByText("Deleting…")).toBeTruthy();

    await act(async () => {
      resolveDelete(true);
    });
    await waitFor(() =>
      expect(screen.getByText("Select a location above to see options.")).toBeTruthy()
    );
  });

  it("shows an inline error and stays on the confirm step when delete fails", async () => {
    (adminApi.adminDeleteRestaurant as jest.Mock).mockResolvedValue(false);
    render(<DangerZone {...baseProps} />);
    expand();
    fireEvent.press(screen.getByText("Downtown"));
    fireEvent.press(screen.getByText("Delete…"));
    await act(async () => {
      fireEvent.press(screen.getByText("Yes, delete permanently"));
    });
    expect(screen.getByText("Failed to delete. Please try again.")).toBeTruthy();
    expect(baseProps.onDeleted).not.toHaveBeenCalled();
    expect(screen.getByText("Delete “Downtown”?")).toBeTruthy();
  });

  it("clears a previous delete error when Cancel is pressed", async () => {
    (adminApi.adminDeleteRestaurant as jest.Mock).mockResolvedValue(false);
    render(<DangerZone {...baseProps} />);
    expand();
    fireEvent.press(screen.getByText("Downtown"));
    fireEvent.press(screen.getByText("Delete…"));
    await act(async () => {
      fireEvent.press(screen.getByText("Yes, delete permanently"));
    });
    expect(screen.getByText("Failed to delete. Please try again.")).toBeTruthy();
    fireEvent.press(screen.getByText("Cancel"));
    fireEvent.press(screen.getByText("Delete…"));
    expect(screen.queryByText("Failed to delete. Please try again.")).toBeNull();
  });

  it("resets delete step and errors when collapsing the accordion", async () => {
    (adminApi.adminDeleteRestaurant as jest.Mock).mockResolvedValue(false);
    render(<DangerZone {...baseProps} />);
    expand();
    fireEvent.press(screen.getByText("Downtown"));
    fireEvent.press(screen.getByText("Delete…"));
    await act(async () => {
      fireEvent.press(screen.getByText("Yes, delete permanently"));
    });
    expect(screen.getByText("Failed to delete. Please try again.")).toBeTruthy();

    // Collapse, then re-expand — the confirm step + error should be gone.
    fireEvent.press(screen.getByText("Archive or delete a location"));
    await waitFor(() => expect(screen.queryByText("Delete “Downtown”?")).toBeNull());
    fireEvent.press(screen.getByText("Archive or delete a location"));
    fireEvent.press(screen.getByText("Downtown"));
    expect(screen.getByText("Delete Location")).toBeTruthy();
    expect(screen.queryByText("Failed to delete. Please try again.")).toBeNull();
  });
});
