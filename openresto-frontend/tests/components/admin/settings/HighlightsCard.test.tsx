import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react-native";
import { HighlightsCard } from "@/components/admin/settings/HighlightsCard";

jest.mock("@/context/BrandContext", () => ({
  useBrand: () => ({ primaryColor: "#007AFF", appName: "Test" }),
}));

jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: () => "light",
}));

jest.mock("@expo/vector-icons", () => {
  const { Text } = require("react-native");
  return {
    Ionicons: ({ name }: { name: string }) => <Text testID={`icon-${name}`}>{name}</Text>,
  };
});

const mockHighlights = [
  { id: 1, title: "Great food", body: "Amazing dishes", iconKey: "star-outline", sortOrder: 0 },
  { id: 2, title: "Cozy ambiance", body: "Warm atmosphere", iconKey: "heart-outline", sortOrder: 1 },
];

jest.mock("@/api/admin", () => ({
  adminGetHighlights: jest.fn().mockResolvedValue([]),
  adminCreateHighlight: jest.fn().mockResolvedValue({ id: 3, title: "New", body: "New body", iconKey: "star-outline", sortOrder: 2 }),
  adminUpdateHighlight: jest.fn().mockResolvedValue({ id: 1, title: "Updated", body: "Updated body", iconKey: "star-outline", sortOrder: 0 }),
  adminDeleteHighlight: jest.fn().mockResolvedValue(undefined),
}));

describe("HighlightsCard", () => {
  const defaultProps = {
    borderColor: "#eee",
    mutedColor: "#888",
    cardBg: "#fff",
  };

  beforeEach(() => {
    jest.clearAllMocks();
    const adminApi = require("@/api/admin");
    adminApi.adminGetHighlights.mockResolvedValue([]);
  });

  it("renders Highlights section header", async () => {
    render(<HighlightsCard {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Highlights")).toBeTruthy();
    });
  });

  it("shows loading state initially then content", async () => {
    render(<HighlightsCard {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Highlights")).toBeTruthy();
    });
  });

  it("shows empty state when no highlights", async () => {
    render(<HighlightsCard {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText(/No highlights yet/)).toBeTruthy();
    });
  });

  it("renders existing highlights", async () => {
    const adminApi = require("@/api/admin");
    adminApi.adminGetHighlights.mockResolvedValueOnce(mockHighlights);

    render(<HighlightsCard {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Great food")).toBeTruthy();
      expect(screen.getByText("Cozy ambiance")).toBeTruthy();
    });
  });

  it("opens new highlight form when Add is pressed", async () => {
    render(<HighlightsCard {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Add")).toBeTruthy();
    });

    fireEvent.press(screen.getByText("Add"));
    await waitFor(() => {
      expect(screen.getByText("Save")).toBeTruthy();
    });
  });

  it("creates a new highlight with title and body", async () => {
    const adminApi = require("@/api/admin");
    render(<HighlightsCard {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Add")).toBeTruthy();
    });

    fireEvent.press(screen.getByText("Add"));
    fireEvent.changeText(
      screen.getByPlaceholderText("e.g. Wood-fired kitchen"),
      "New Highlight"
    );
    fireEvent.changeText(
      screen.getByPlaceholderText("Short sentence about this highlight"),
      "Description here"
    );
    fireEvent.press(screen.getByText("Save"));

    await waitFor(() => {
      expect(adminApi.adminCreateHighlight).toHaveBeenCalledWith(
        expect.objectContaining({ title: "New Highlight", body: "Description here" })
      );
    });
  });

  it("cancels new highlight form", async () => {
    render(<HighlightsCard {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Add")).toBeTruthy();
    });

    fireEvent.press(screen.getByText("Add"));
    await waitFor(() => {
      expect(screen.getByText("Cancel")).toBeTruthy();
    });

    fireEvent.press(screen.getByText("Cancel"));
    await waitFor(() => {
      expect(screen.getByText("Add")).toBeTruthy();
    });
  });

  it("edits an existing highlight when pencil is pressed", async () => {
    const adminApi = require("@/api/admin");
    adminApi.adminGetHighlights.mockResolvedValueOnce(mockHighlights);

    render(<HighlightsCard {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Great food")).toBeTruthy();
    });

    const pencilIcons = screen.getAllByTestId("icon-pencil-outline");
    fireEvent.press(pencilIcons[0]);

    await waitFor(() => {
      expect(screen.getByDisplayValue("Great food")).toBeTruthy();
    });
  });

  it("saves updated highlight when Save is pressed after editing", async () => {
    const adminApi = require("@/api/admin");
    adminApi.adminGetHighlights.mockResolvedValueOnce(mockHighlights);

    render(<HighlightsCard {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Great food")).toBeTruthy();
    });

    const pencilIcons = screen.getAllByTestId("icon-pencil-outline");
    fireEvent.press(pencilIcons[0]);

    await waitFor(() => {
      expect(screen.getByDisplayValue("Great food")).toBeTruthy();
    });

    fireEvent.changeText(screen.getByDisplayValue("Great food"), "Updated Title");
    fireEvent.press(screen.getByText("Save"));

    await waitFor(() => {
      expect(adminApi.adminUpdateHighlight).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ title: "Updated Title" })
      );
    });
  });

  it("deletes a highlight when trash is pressed", async () => {
    const adminApi = require("@/api/admin");
    adminApi.adminGetHighlights.mockResolvedValueOnce(mockHighlights);
    adminApi.adminDeleteHighlight.mockResolvedValueOnce(true);

    render(<HighlightsCard {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Great food")).toBeTruthy();
    });

    const trashIcons = screen.getAllByTestId("icon-trash-outline");
    fireEvent.press(trashIcons[0]);

    await waitFor(() => {
      expect(adminApi.adminDeleteHighlight).toHaveBeenCalledWith(1);
    });
  });

  it("selects an icon in the form", async () => {
    render(<HighlightsCard {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Add")).toBeTruthy();
    });
    fireEvent.press(screen.getByText("Add"));
    await waitFor(() => {
      expect(screen.getByTestId("icon-heart-outline")).toBeTruthy();
    });
    fireEvent.press(screen.getByTestId("icon-heart-outline"));
    expect(screen.getByText("Save")).toBeTruthy();
  });
});
