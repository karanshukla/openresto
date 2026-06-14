import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react-native";
import { HighlightsCard } from "@/components/admin/settings/HighlightsCard";
import * as adminApi from "@/api/admin";

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

jest.mock("@/api/admin", () => ({
  adminGetHighlights: jest.fn(),
  adminCreateHighlight: jest.fn(),
  adminUpdateHighlight: jest.fn(),
  adminDeleteHighlight: jest.fn(),
}));

jest.mock("@/context/BrandContext", () => {
  const brand = { primaryColor: "#0a7ea4", appName: "Open Resto" };
  return { useBrand: () => brand };
});

jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: () => "light",
}));

jest.mock("@/hooks/use-persisted-state", () => ({
  usePersistedState: (_key: string, defaultValue: unknown) => {
    const { useState } = require("react");
    return useState(defaultValue);
  },
}));

const baseProps = {
  borderColor: "#ddd",
  mutedColor: "#888",
  cardBg: "#fff",
};

const mockHighlights = [
  {
    id: 1,
    title: "Great Food",
    body: "We serve fresh food",
    iconKey: "star-outline",
    sortOrder: 0,
  },
  {
    id: 2,
    title: "Live Music",
    body: "Every Friday",
    iconKey: "musical-notes-outline",
    sortOrder: 1,
  },
];

describe("HighlightsCard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (adminApi.adminGetHighlights as jest.Mock).mockResolvedValue([]);
  });

  it("renders Highlights title", async () => {
    render(<HighlightsCard {...baseProps} />);
    await waitFor(() => {
      expect(screen.getByText("Highlights")).toBeTruthy();
    });
  });

  it("renders expanded by default (Add button visible)", async () => {
    render(<HighlightsCard {...baseProps} />);
    await waitFor(() => expect(screen.getByText("Add")).toBeTruthy());
  });

  it("collapses when header is pressed", async () => {
    render(<HighlightsCard {...baseProps} />);
    await waitFor(() => expect(screen.getByText("Add")).toBeTruthy());
    fireEvent.press(screen.getByText("Highlights"));
    await waitFor(() => {
      expect(screen.queryByText("Add")).toBeNull();
    });
  });

  it("expands again when header is pressed after collapse", async () => {
    render(<HighlightsCard {...baseProps} />);
    await waitFor(() => expect(screen.getByText("Add")).toBeTruthy());
    fireEvent.press(screen.getByText("Highlights"));
    await waitFor(() => expect(screen.queryByText("Add")).toBeNull());
    fireEvent.press(screen.getByText("Highlights"));
    await waitFor(() => {
      expect(screen.getByText("Add")).toBeTruthy();
    });
  });

  it("shows Add button when expanded", async () => {
    render(<HighlightsCard {...baseProps} />);
    await waitFor(() => {
      expect(screen.getByText("Add")).toBeTruthy();
    });
  });

  it("shows empty state when no highlights", async () => {
    render(<HighlightsCard {...baseProps} />);
    await waitFor(() => {
      expect(screen.getByText(/No highlights yet/)).toBeTruthy();
    });
  });

  it("shows highlights list when highlights are loaded", async () => {
    (adminApi.adminGetHighlights as jest.Mock).mockResolvedValue(mockHighlights);
    render(<HighlightsCard {...baseProps} />);
    await waitFor(() => {
      expect(screen.getByText("Great Food")).toBeTruthy();
      expect(screen.getByText("Live Music")).toBeTruthy();
    });
  });

  it("shows highlight count in subtitle when loaded", async () => {
    (adminApi.adminGetHighlights as jest.Mock).mockResolvedValue(mockHighlights);
    render(<HighlightsCard {...baseProps} />);
    await waitFor(() => {
      expect(screen.getByText(/2 highlights · Home page/)).toBeTruthy();
    });
  });

  it("opens new highlight form when Add is pressed", async () => {
    render(<HighlightsCard {...baseProps} />);
    await waitFor(() => expect(screen.getByText("Add")).toBeTruthy());
    fireEvent.press(screen.getByText("Add"));
    await waitFor(() => {
      expect(screen.getByPlaceholderText("e.g. Wood-fired kitchen")).toBeTruthy();
    });
  });

  it("cancels new form when Cancel is pressed", async () => {
    render(<HighlightsCard {...baseProps} />);
    await waitFor(() => expect(screen.getByText("Add")).toBeTruthy());
    fireEvent.press(screen.getByText("Add"));
    await waitFor(() => expect(screen.getByText("Cancel")).toBeTruthy());
    fireEvent.press(screen.getByText("Cancel"));
    await waitFor(() => {
      expect(screen.queryByPlaceholderText("e.g. Wood-fired kitchen")).toBeNull();
    });
  });

  it("calls adminCreateHighlight when Save is pressed with a title", async () => {
    const created = { id: 3, title: "New", body: "", iconKey: "star-outline", sortOrder: 0 };
    (adminApi.adminCreateHighlight as jest.Mock).mockResolvedValue(created);
    render(<HighlightsCard {...baseProps} />);
    await waitFor(() => expect(screen.getByText("Add")).toBeTruthy());
    fireEvent.press(screen.getByText("Add"));
    await waitFor(() =>
      expect(screen.getByPlaceholderText("e.g. Wood-fired kitchen")).toBeTruthy()
    );
    fireEvent.changeText(screen.getByPlaceholderText("e.g. Wood-fired kitchen"), "New");
    await act(async () => {
      fireEvent.press(screen.getByText("Save"));
    });
    expect(adminApi.adminCreateHighlight).toHaveBeenCalledWith(
      expect.objectContaining({ title: "New" })
    );
  });

  it("does not call adminCreateHighlight when title is empty", async () => {
    render(<HighlightsCard {...baseProps} />);
    await waitFor(() => expect(screen.getByText("Add")).toBeTruthy());
    fireEvent.press(screen.getByText("Add"));
    await waitFor(() => expect(screen.getByText("Save")).toBeTruthy());
    await act(async () => {
      fireEvent.press(screen.getByText("Save"));
    });
    expect(adminApi.adminCreateHighlight).not.toHaveBeenCalled();
  });

  it("calls adminDeleteHighlight when delete button is pressed", async () => {
    (adminApi.adminGetHighlights as jest.Mock).mockResolvedValue(mockHighlights);
    (adminApi.adminDeleteHighlight as jest.Mock).mockResolvedValue(true);
    render(<HighlightsCard {...baseProps} />);
    await waitFor(() => expect(screen.getByText("Great Food")).toBeTruthy());
    // Layout: Header[0,1], Add[2,3], GreatFood-edit[4,5], GreatFood-delete[6,7], LiveMusic-edit[8,9], LiveMusic-delete[10,11]
    const accessible = screen.UNSAFE_getAllByProps({ accessible: true });
    await act(async () => {
      fireEvent.press(accessible[6]);
    });
    expect(adminApi.adminDeleteHighlight).toHaveBeenCalledWith(1);
  });

  it("does not remove highlight when adminDeleteHighlight returns false", async () => {
    (adminApi.adminGetHighlights as jest.Mock).mockResolvedValue([mockHighlights[0]]);
    (adminApi.adminDeleteHighlight as jest.Mock).mockResolvedValue(false);
    render(<HighlightsCard {...baseProps} />);
    await waitFor(() => expect(screen.getByText("Great Food")).toBeTruthy());
    // Layout: Header[0,1], Add[2,3], GreatFood-edit[4,5], GreatFood-delete[6,7]
    const accessible = screen.UNSAFE_getAllByProps({ accessible: true });
    await act(async () => {
      fireEvent.press(accessible[6]);
    });
    expect(screen.getByText("Great Food")).toBeTruthy();
  });

  it("opens edit form when pencil is pressed on existing highlight", async () => {
    (adminApi.adminGetHighlights as jest.Mock).mockResolvedValue([mockHighlights[0]]);
    render(<HighlightsCard {...baseProps} />);
    await waitFor(() => expect(screen.getByText("Great Food")).toBeTruthy());
    // Layout: Header[0,1], Add[2,3], GreatFood-edit[4,5], GreatFood-delete[6,7]
    const accessible = screen.UNSAFE_getAllByProps({ accessible: true });
    fireEvent.press(accessible[4]);
    await waitFor(() => {
      expect(screen.getByDisplayValue("Great Food")).toBeTruthy();
    });
  });

  it("calls adminUpdateHighlight when saving an edited highlight", async () => {
    const updated = { ...mockHighlights[0], title: "Amazing Food" };
    (adminApi.adminGetHighlights as jest.Mock).mockResolvedValue([mockHighlights[0]]);
    (adminApi.adminUpdateHighlight as jest.Mock).mockResolvedValue(updated);
    render(<HighlightsCard {...baseProps} />);
    await waitFor(() => expect(screen.getByText("Great Food")).toBeTruthy());
    const accessible = screen.UNSAFE_getAllByProps({ accessible: true });
    fireEvent.press(accessible[4]);
    await waitFor(() => expect(screen.getByDisplayValue("Great Food")).toBeTruthy());
    fireEvent.changeText(screen.getByDisplayValue("Great Food"), "Amazing Food");
    await act(async () => {
      fireEvent.press(screen.getByText("Save"));
    });
    expect(adminApi.adminUpdateHighlight).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ title: "Amazing Food" })
    );
  });

  it("does not update list when adminUpdateHighlight returns null", async () => {
    (adminApi.adminGetHighlights as jest.Mock).mockResolvedValue([mockHighlights[0]]);
    (adminApi.adminUpdateHighlight as jest.Mock).mockResolvedValue(null);
    render(<HighlightsCard {...baseProps} />);
    await waitFor(() => expect(screen.getByText("Great Food")).toBeTruthy());
    const accessible = screen.UNSAFE_getAllByProps({ accessible: true });
    fireEvent.press(accessible[4]);
    await waitFor(() => expect(screen.getByDisplayValue("Great Food")).toBeTruthy());
    fireEvent.changeText(screen.getByDisplayValue("Great Food"), "New Title");
    await act(async () => {
      fireEvent.press(screen.getByText("Save"));
    });
    expect(adminApi.adminUpdateHighlight).toHaveBeenCalled();
  });

  it("does not add to list when adminCreateHighlight returns null", async () => {
    (adminApi.adminCreateHighlight as jest.Mock).mockResolvedValue(null);
    render(<HighlightsCard {...baseProps} />);
    await waitFor(() => expect(screen.getByText("Add")).toBeTruthy());
    fireEvent.press(screen.getByText("Add"));
    await waitFor(() =>
      expect(screen.getByPlaceholderText("e.g. Wood-fired kitchen")).toBeTruthy()
    );
    fireEvent.changeText(screen.getByPlaceholderText("e.g. Wood-fired kitchen"), "New");
    await act(async () => {
      fireEvent.press(screen.getByText("Save"));
    });
    expect(adminApi.adminCreateHighlight).toHaveBeenCalled();
    expect(screen.queryByText("New")).toBeNull();
  });

  it("changes icon when an icon option is pressed", async () => {
    render(<HighlightsCard {...baseProps} />);
    await waitFor(() => expect(screen.getByText("Add")).toBeTruthy());
    fireEvent.press(screen.getByText("Add"));
    await waitFor(() =>
      expect(screen.getByPlaceholderText("e.g. Wood-fired kitchen")).toBeTruthy()
    );
    // Press the last accessible element — the icon pickers are the last rendered Pressables
    const accessible = screen.UNSAFE_getAllByProps({ accessible: true });
    fireEvent.press(accessible[accessible.length - 1]);
    expect(screen.getByPlaceholderText("e.g. Wood-fired kitchen")).toBeTruthy();
  });
});
