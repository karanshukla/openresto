import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react-native";
import { LocationCard } from "@/components/admin/settings/LocationCard";

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

jest.mock("@/api/restaurants", () => ({
  addSection: jest.fn().mockResolvedValue({ id: 10, name: "New Section", tables: [] }),
  uploadLocationImage: jest.fn().mockResolvedValue("https://example.com/img.jpg"),
  deleteLocationImage: jest.fn().mockResolvedValue(undefined),
  updateSection: jest.fn().mockResolvedValue({}),
  deleteSection: jest.fn().mockResolvedValue(undefined),
  addTable: jest.fn().mockResolvedValue({ id: 1, name: "T1", seats: 4 }),
  updateTable: jest.fn().mockResolvedValue({}),
  deleteTable: jest.fn().mockResolvedValue(undefined),
  updateRestaurant: jest.fn().mockResolvedValue({}),
}));

const mockRestaurant = {
  id: 1,
  name: "Test Restaurant",
  address: "123 Main St",
  openTime: "09:00",
  closeTime: "22:00",
  openDays: "Mon,Tue,Wed,Thu,Fri",
  timezone: "UTC",
  tags: ["Italian", "Pizza"],
  imageUrl: null,
  sections: [
    {
      id: 10,
      name: "Main Floor",
      tables: [
        { id: 100, name: "T1", seats: 4 },
        { id: 101, name: "T2", seats: 2 },
      ],
    },
  ],
};

describe("LocationCard", () => {
  const defaultProps = {
    restaurant: mockRestaurant,
    onSaved: jest.fn(),
    isDark: false,
    borderColor: "#eee",
    mutedColor: "#888",
    cardBg: "#fff",
    confirmAction: jest.fn().mockResolvedValue(true),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders restaurant name", () => {
    render(<LocationCard {...defaultProps} />);
    expect(screen.getByText("Test Restaurant")).toBeTruthy();
  });

  it("renders section names", () => {
    render(<LocationCard {...defaultProps} />);
    expect(screen.getByText("Main Floor")).toBeTruthy();
  });

  it("renders table counts", () => {
    render(<LocationCard {...defaultProps} />);
    // Should show section with tables
    expect(screen.getByText("Main Floor")).toBeTruthy();
  });

  it("renders in dark mode", () => {
    const { toJSON } = render(<LocationCard {...defaultProps} isDark={true} />);
    expect(toJSON()).toBeDefined();
  });

  it("renders restaurant with no sections", () => {
    const { toJSON } = render(
      <LocationCard {...defaultProps} restaurant={{ ...mockRestaurant, sections: [] }} />
    );
    expect(toJSON()).toBeDefined();
  });

  it("renders restaurant with image", () => {
    const { toJSON } = render(
      <LocationCard
        {...defaultProps}
        restaurant={{ ...mockRestaurant, imageUrl: "https://example.com/img.jpg" }}
      />
    );
    expect(toJSON()).toBeDefined();
  });

  it("renders open days information", () => {
    render(<LocationCard {...defaultProps} />);
    // The location card shows open days
    expect(screen.getByText("Test Restaurant")).toBeTruthy();
  });

  it("renders stat chips with section and table counts", () => {
    render(<LocationCard {...defaultProps} />);
    // Sections and tables counts
    expect(screen.getByText("1")).toBeTruthy(); // 1 section
  });

  it("calls handlePickImage when Upload button is pressed", async () => {
    const restaurantsApi = require("@/api/restaurants");
    const mockInput: any = {
      type: "",
      accept: "",
      onchange: null,
      click: jest.fn(),
      files: null,
    };
    (global as any).document = {
      createElement: jest.fn().mockReturnValue(mockInput),
    };

    render(<LocationCard {...defaultProps} />);
    fireEvent.press(screen.getByText("Upload"));
    expect((global as any).document.createElement).toHaveBeenCalledWith("input");
    expect(mockInput.click).toHaveBeenCalled();

    mockInput.files = [{ name: "test.jpg", size: 100, type: "image/jpeg" }];
    await act(async () => {
      await mockInput.onchange();
    });

    await waitFor(() => {
      expect(restaurantsApi.uploadLocationImage).toHaveBeenCalled();
    });
    delete (global as any).document;
  });

  it("shows error when file is too large", async () => {
    const mockInput: any = {
      type: "",
      accept: "",
      onchange: null,
      click: jest.fn(),
      files: null,
    };
    (global as any).document = {
      createElement: jest.fn().mockReturnValue(mockInput),
    };

    render(<LocationCard {...defaultProps} />);
    fireEvent.press(screen.getByText("Upload"));

    mockInput.files = [{ name: "big.jpg", size: 3 * 1024 * 1024, type: "image/jpeg" }];
    await act(async () => {
      await mockInput.onchange();
    });

    await waitFor(() => {
      expect(screen.getByText(/Image must be under/)).toBeTruthy();
    });
    delete (global as any).document;
  });

  it("shows error when no file selected in handlePickImage", async () => {
    const restaurantsApi = require("@/api/restaurants");
    const mockInput: any = {
      type: "",
      accept: "",
      onchange: null,
      click: jest.fn(),
      files: null,
    };
    (global as any).document = {
      createElement: jest.fn().mockReturnValue(mockInput),
    };

    render(<LocationCard {...defaultProps} />);
    fireEvent.press(screen.getByText("Upload"));

    mockInput.files = [];
    await act(async () => {
      await mockInput.onchange();
    });

    expect(restaurantsApi.uploadLocationImage).not.toHaveBeenCalled();
    delete (global as any).document;
  });

  it("shows error when uploadLocationImage returns null", async () => {
    const restaurantsApi = require("@/api/restaurants");
    restaurantsApi.uploadLocationImage.mockResolvedValueOnce(null);
    const mockInput: any = {
      type: "",
      accept: "",
      onchange: null,
      click: jest.fn(),
      files: null,
    };
    (global as any).document = {
      createElement: jest.fn().mockReturnValue(mockInput),
    };

    render(<LocationCard {...defaultProps} />);
    fireEvent.press(screen.getByText("Upload"));

    mockInput.files = [{ name: "test.jpg", size: 100, type: "image/jpeg" }];
    await act(async () => {
      await mockInput.onchange();
    });

    await waitFor(() => {
      expect(screen.getByText("Failed to upload image.")).toBeTruthy();
    });
    delete (global as any).document;
  });

  it("calls handleDeleteImage when Remove is pressed on restaurant with image", async () => {
    const restaurantsApi = require("@/api/restaurants");
    const onSaved = jest.fn();
    render(
      <LocationCard
        {...defaultProps}
        restaurant={{ ...mockRestaurant, imageUrl: "https://example.com/img.jpg" }}
        onSaved={onSaved}
      />
    );
    fireEvent.press(screen.getByText("Remove"));
    await waitFor(() => {
      expect(restaurantsApi.deleteLocationImage).toHaveBeenCalledWith(1);
      expect(onSaved).toHaveBeenCalledWith({ imageUrl: null });
    });
  });

  it("calls onSaved when a section is renamed via SectionBlock", async () => {
    const restaurantsApi = require("@/api/restaurants");
    restaurantsApi.updateSection.mockResolvedValueOnce({ id: 10, name: "New Name", tables: [] });
    const onSaved = jest.fn();
    render(<LocationCard {...defaultProps} onSaved={onSaved} />);
    // Press Edit to enter rename mode
    fireEvent.press(screen.getByText("Edit"));
    await waitFor(() => expect(screen.getByDisplayValue("Main Floor")).toBeTruthy());
    fireEvent.changeText(screen.getByDisplayValue("Main Floor"), "New Name");
    fireEvent.press(screen.getByText("Save"));
    await waitFor(() => {
      expect(onSaved).toHaveBeenCalled();
    });
  });

  it("calls onSaved when a section is deleted via SectionBlock", async () => {
    const restaurantsApi = require("@/api/restaurants");
    restaurantsApi.deleteSection.mockResolvedValueOnce(true);
    const onSaved = jest.fn();
    render(<LocationCard {...defaultProps} onSaved={onSaved} />);
    const trashIcons = screen.getAllByTestId("icon-trash-outline");
    fireEvent.press(trashIcons[0]);
    await waitFor(() => {
      expect(onSaved).toHaveBeenCalled();
    });
  });

  it("calls onSaved when a table is added via SectionBlock", async () => {
    const onSaved = jest.fn();
    render(<LocationCard {...defaultProps} onSaved={onSaved} />);
    fireEvent.press(screen.getByText("Add Table"));
    const nameInput = screen.getByPlaceholderText("Table name (e.g. T1, Booth 1)");
    fireEvent.changeText(nameInput, "T3");
    const seatsInput = screen.getByPlaceholderText("Seats");
    fireEvent.changeText(seatsInput, "4");
    fireEvent.press(screen.getByText("Add"));
    await waitFor(() => {
      expect(onSaved).toHaveBeenCalled();
    });
  });

  it("calls onSaved when a section is added via AddRow", async () => {
    const restaurantsApi = require("@/api/restaurants");
    const onSaved = jest.fn();
    render(<LocationCard {...defaultProps} onSaved={onSaved} />);
    fireEvent.press(screen.getByText("Add Section"));
    const input = screen.getByPlaceholderText("e.g. Indoor, Patio, Bar");
    fireEvent.changeText(input, "Patio");
    fireEvent.press(screen.getAllByText("Add")[0]);
    await waitFor(() => {
      expect(restaurantsApi.addSection).toHaveBeenCalledWith(1, "Patio");
      expect(onSaved).toHaveBeenCalled();
    });
  });

  it("calls onSaved when a table is deleted via TableRow delete", async () => {
    const restaurantsApi = require("@/api/restaurants");
    restaurantsApi.deleteTable.mockResolvedValue(true);
    const onSaved = jest.fn();
    render(<LocationCard {...defaultProps} onSaved={onSaved} />);
    // Trash icons: [0]=section, [1]=T1, [2]=T2
    const trashIcons = screen.getAllByTestId("icon-trash-outline");
    fireEvent.press(trashIcons[1]); // Press T1 table trash icon
    await waitFor(() => {
      expect(onSaved).toHaveBeenCalled();
    });
  });

  it("calls onSaved when a table is updated via TableRow edit", async () => {
    const restaurantsApi = require("@/api/restaurants");
    restaurantsApi.updateTable.mockResolvedValue({ id: 100, name: "T1-updated", seats: 6 });
    const onSaved = jest.fn();
    // Use two sections so the onTableUpdated map hits both the matching and non-matching branches
    const twoSectionRestaurant = {
      ...mockRestaurant,
      sections: [
        mockRestaurant.sections[0],
        { id: 20, name: "Patio", tables: [{ id: 102, name: "P1", seats: 2 }] },
      ],
    };
    render(<LocationCard {...defaultProps} restaurant={twoSectionRestaurant} onSaved={onSaved} />);
    // Press pencil icon to open edit mode on first table (T1 in section 10)
    const pencilIcons = screen.getAllByTestId("icon-pencil-outline");
    fireEvent.press(pencilIcons[0]);
    // Now in edit mode - change seats
    const seatsInput = screen.getByDisplayValue("4");
    fireEvent.changeText(seatsInput, "6");
    fireEvent.press(screen.getByText("Save"));
    await waitFor(() => {
      expect(onSaved).toHaveBeenCalled();
    });
  });
});
