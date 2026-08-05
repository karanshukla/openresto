import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react-native";
import { SectionBlock } from "@/components/admin/settings/SectionBlock";
import * as restaurantsApi from "@/api/restaurants";

jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));

jest.mock("@/api/restaurants", () => ({
  updateSection: jest.fn(),
  deleteSection: jest.fn(),
  addTable: jest.fn(),
  deleteTable: jest.fn(),
  fetchSectionDeleteImpact: jest.fn(),
  fetchTableDeleteImpact: jest.fn(),
  createTableGroup: jest.fn(),
  updateTableGroup: jest.fn(),
  deleteTableGroup: jest.fn(),
}));

jest.mock("@/context/BrandContext", () => ({
  useBrand: () => ({ primaryColor: "#0a7ea4", appName: "Open Resto" }),
}));

jest.mock("@/hooks/use-color-scheme", () => ({ useColorScheme: () => "light" }));

/**
 * Unlinking a member from a group of three or more shrinks the group rather than dissolving it.
 * That path has to re-clamp `combinedSeats`: the departing table's covers are gone, so a figure
 * the admin set earlier can now exceed what the remaining tables actually seat, and the server
 * rejects anything outside (largest member, sum of members]. Getting the clamp wrong here means
 * the group silently keeps advertising capacity it can't seat.
 */
const baseProps = {
  section: {
    id: 1,
    name: "Indoor",
    tables: [
      { id: 10, name: "T1", seats: 4 },
      { id: 11, name: "T2", seats: 2 },
      { id: 12, name: "T3", seats: 2 },
    ],
  },
  restaurantId: 42,
  isDark: false,
  borderColor: "#ddd",
  mutedColor: "#888",
  groups: [] as restaurantsApi.TableGroupDto[],
  onSectionRenamed: jest.fn(),
  onSectionDeleted: jest.fn(),
  onTableAdded: jest.fn(),
  onTableUpdated: jest.fn(),
  onTableDeleted: jest.fn(),
  onGroupsChanged: jest.fn(),
  isFirst: false,
  isLast: false,
  onMoveUp: jest.fn(),
  onMoveDown: jest.fn(),
};

const threeMemberGroup = (combinedSeats: number): restaurantsApi.TableGroupDto => ({
  id: 1,
  name: "Window run",
  combinedSeats,
  members: [
    { id: 10, name: "T1", seats: 4 },
    { id: 11, name: "T2", seats: 2 },
    { id: 12, name: "T3", seats: 2 },
  ],
});

describe("SectionBlock unlink from a group with more than two members", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("shrinks the group instead of dissolving it", async () => {
    const groups = [threeMemberGroup(8)];
    const updated = { ...groups[0], members: groups[0].members.slice(1), combinedSeats: 4 };
    (restaurantsApi.updateTableGroup as jest.Mock).mockResolvedValue(updated);
    const onGroupsChanged = jest.fn();
    render(<SectionBlock {...baseProps} groups={groups} onGroupsChanged={onGroupsChanged} />);

    await act(async () => {
      fireEvent.press(screen.getByTestId("table-unlink-btn-10"));
    });

    expect(restaurantsApi.deleteTableGroup).not.toHaveBeenCalled();
    expect(restaurantsApi.updateTableGroup).toHaveBeenCalledWith(42, 1, {
      name: "Window run",
      members: [11, 12],
      // T2 + T3 remain (2 + 2), so the accepted window is (2, 4]. The stored 8 clamps to 4.
      combinedSeats: 4,
    });
    expect(onGroupsChanged).toHaveBeenCalledWith([updated]);
  });

  it("keeps a combined-seats value that is still inside the new window", async () => {
    // Removing T2 leaves T1 (4) + T3 (2) → window (4, 6]. The stored 5 is still valid.
    const groups = [threeMemberGroup(5)];
    const updated = { ...groups[0], combinedSeats: 5 };
    (restaurantsApi.updateTableGroup as jest.Mock).mockResolvedValue(updated);
    render(<SectionBlock {...baseProps} groups={groups} />);

    await act(async () => {
      fireEvent.press(screen.getByTestId("table-unlink-btn-11"));
    });

    expect(restaurantsApi.updateTableGroup).toHaveBeenCalledWith(
      42,
      1,
      expect.objectContaining({ members: [10, 12], combinedSeats: 5 })
    );
  });

  it("raises a combined-seats value that has fallen below the new floor", async () => {
    // Removing T3 leaves T1 (4) + T2 (2) → window (4, 6]. A stored 3 is below the floor.
    const groups = [threeMemberGroup(3)];
    (restaurantsApi.updateTableGroup as jest.Mock).mockResolvedValue(threeMemberGroup(5));
    render(<SectionBlock {...baseProps} groups={groups} />);

    await act(async () => {
      fireEvent.press(screen.getByTestId("table-unlink-btn-12"));
    });

    expect(restaurantsApi.updateTableGroup).toHaveBeenCalledWith(
      42,
      1,
      expect.objectContaining({ members: [10, 11], combinedSeats: 5 })
    );
  });

  it("leaves the group list untouched when the update call fails", async () => {
    const groups = [threeMemberGroup(8)];
    (restaurantsApi.updateTableGroup as jest.Mock).mockResolvedValue(null);
    const onGroupsChanged = jest.fn();
    render(<SectionBlock {...baseProps} groups={groups} onGroupsChanged={onGroupsChanged} />);

    await act(async () => {
      fireEvent.press(screen.getByTestId("table-unlink-btn-10"));
    });

    expect(restaurantsApi.updateTableGroup).toHaveBeenCalled();
    expect(onGroupsChanged).not.toHaveBeenCalled();
  });

  it("closes the combined-seats editor without saving when Cancel is pressed", async () => {
    const groups = [threeMemberGroup(8)];
    render(<SectionBlock {...baseProps} groups={groups} />);

    await act(async () => {
      fireEvent.press(screen.getByTestId("group-edit-btn-1"));
    });
    expect(screen.getByTestId("group-save-combined-btn")).toBeTruthy();

    await act(async () => {
      fireEvent.press(screen.getByText("Cancel"));
    });

    expect(screen.queryByTestId("group-save-combined-btn")).toBeNull();
    expect(restaurantsApi.updateTableGroup).not.toHaveBeenCalled();
  });

  it("reports the deleted table id up to the parent", async () => {
    const onTableDeleted = jest.fn();
    (restaurantsApi.fetchSectionDeleteImpact as jest.Mock).mockResolvedValue(null);
    (restaurantsApi.fetchTableDeleteImpact as jest.Mock).mockResolvedValue(null);
    (restaurantsApi.deleteTable as jest.Mock).mockResolvedValue(true);
    render(<SectionBlock {...baseProps} onTableDeleted={onTableDeleted} />);

    // TableRow owns the confirm flow; the block only forwards the id, which is what's asserted here.
    await act(async () => {
      fireEvent.press(screen.getByTestId("table-delete-btn-11"));
    });
    await act(async () => {
      fireEvent.press(screen.getByTestId("table-delete-confirm-btn"));
    });

    expect(onTableDeleted).toHaveBeenCalledWith(11);
  });

  it("leaves the group list untouched when a dissolve call fails", async () => {
    const groups: restaurantsApi.TableGroupDto[] = [
      {
        id: 1,
        name: null,
        combinedSeats: 6,
        members: [
          { id: 10, name: "T1", seats: 4 },
          { id: 11, name: "T2", seats: 2 },
        ],
      },
    ];
    (restaurantsApi.deleteTableGroup as jest.Mock).mockResolvedValue(false);
    const onGroupsChanged = jest.fn();
    render(<SectionBlock {...baseProps} groups={groups} onGroupsChanged={onGroupsChanged} />);

    await act(async () => {
      fireEvent.press(screen.getByTestId("table-unlink-btn-10"));
    });

    expect(restaurantsApi.deleteTableGroup).toHaveBeenCalledWith(42, 1);
    expect(onGroupsChanged).not.toHaveBeenCalled();
  });
});
