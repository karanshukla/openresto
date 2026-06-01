/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react-native";
import { LocationCard } from "@/components/admin/settings/LocationCard";
import * as restaurantsApi from "@/api/restaurants";

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

jest.mock("@/api/restaurants", () => ({
  addSection: jest.fn(),
  uploadLocationImage: jest.fn(),
  deleteLocationImage: jest.fn(),
}));

jest.mock("@/context/BrandContext", () => {
  const brand = { primaryColor: "#0a7ea4", appName: "Open Resto" };
  return { useBrand: () => brand };
});

jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: () => "light",
}));

jest.mock("@/components/admin/settings/RestaurantInfoForm", () => ({
  RestaurantInfoForm: ({ restaurant }: { restaurant: { name: string } }) => {
    const { Text } = require("react-native");
    return <Text testID="restaurant-info-form">{restaurant.name}</Text>;
  },
}));

jest.mock("@/components/admin/settings/SectionBlock", () => ({
  SectionBlock: ({
    section,
    onSectionRenamed,
    onSectionDeleted,
    onTableAdded,
    onTableUpdated,
    onTableDeleted,
  }: {
    section: { id: number; name: string; tables: { id: number; name: string; seats: number }[] };
    onSectionRenamed: (name: string) => void;
    onSectionDeleted: () => void;
    onTableAdded: (t: { id: number; name: string; seats: number }) => void;
    onTableUpdated: (t: { id: number; name: string; seats: number }) => void;
    onTableDeleted: (id: number) => void;
  }) => {
    const { View, Text, Pressable } = require("react-native");
    return (
      <View testID={`section-${section.name}`}>
        <Text>{section.name}</Text>
        <Pressable
          testID={`rename-section-${section.id}`}
          onPress={() => onSectionRenamed("Renamed Section")}
        >
          <Text>Rename</Text>
        </Pressable>
        <Pressable testID={`delete-section-${section.id}`} onPress={onSectionDeleted}>
          <Text>Delete Section</Text>
        </Pressable>
        <Pressable
          testID={`add-table-${section.id}`}
          onPress={() => onTableAdded({ id: 999, name: "New Table", seats: 2 })}
        >
          <Text>Add Table</Text>
        </Pressable>
        <Pressable
          testID={`update-table-${section.id}`}
          onPress={() =>
            onTableUpdated({
              id: section.tables[0]?.id ?? 100,
              name: "Updated Table",
              seats: 6,
            })
          }
        >
          <Text>Update Table</Text>
        </Pressable>
        <Pressable
          testID={`delete-table-${section.id}`}
          onPress={() => onTableDeleted(section.tables[0]?.id ?? 100)}
        >
          <Text>Delete Table</Text>
        </Pressable>
      </View>
    );
  },
}));

jest.mock("@/components/admin/settings/AddRow", () => ({
  AddRow: ({
    label,
    onAdd,
  }: {
    label: string;
    placeholder: string;
    onAdd: (name: string) => Promise<void>;
  }) => {
    const { Text, Pressable } = require("react-native");
    return (
      <Pressable testID="add-row-btn" onPress={() => onAdd("New Section")}>
        <Text>{label}</Text>
      </Pressable>
    );
  },
}));

const baseRestaurant = {
  id: 1,
  name: "Test Restaurant",
  address: "123 Main St",
  openTime: "09:00",
  closeTime: "22:00",
  openDays: "Mon,Tue,Wed,Thu,Fri,Sat,Sun",
  timezone: "America/New_York",
  imageUrl: null as string | null,
  sections: [
    {
      id: 10,
      name: "Indoor",
      tables: [
        { id: 100, name: "Table 1", seats: 4 },
        { id: 101, name: "Table 2", seats: 2 },
      ],
    },
    {
      id: 11,
      name: "Patio",
      tables: [],
    },
  ],
};

const baseProps = {
  restaurant: baseRestaurant,
  onSaved: jest.fn(),
  isDark: false,
  borderColor: "#ddd",
  mutedColor: "#888",
  cardBg: "#fff",
  confirmAction: jest.fn().mockResolvedValue(true),
};

describe("LocationCard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    baseProps.confirmAction = jest.fn().mockResolvedValue(true);
  });

  it("renders restaurant name", () => {
    render(<LocationCard {...baseProps} />);
    expect(screen.getAllByText("Test Restaurant").length).toBeGreaterThan(0);
  });

  it("renders restaurant address", () => {
    render(<LocationCard {...baseProps} />);
    expect(screen.getByText("123 Main St")).toBeTruthy();
  });

  it("renders opening hours", () => {
    render(<LocationCard {...baseProps} />);
    expect(screen.getByText("09:00–22:00")).toBeTruthy();
  });

  it("renders timezone", () => {
    render(<LocationCard {...baseProps} />);
    expect(screen.getByText("America/New_York")).toBeTruthy();
  });

  it("shows section and table counts as stats", () => {
    render(<LocationCard {...baseProps} />);
    expect(screen.getByText("Sections")).toBeTruthy();
    expect(screen.getByText("Tables")).toBeTruthy();
    expect(screen.getByText("Seats")).toBeTruthy();
  });

  it("renders RestaurantInfoForm", () => {
    render(<LocationCard {...baseProps} />);
    expect(screen.getByTestId("restaurant-info-form")).toBeTruthy();
  });

  it("renders sections list", () => {
    render(<LocationCard {...baseProps} />);
    expect(screen.getByTestId("section-Indoor")).toBeTruthy();
    expect(screen.getByTestId("section-Patio")).toBeTruthy();
  });

  it("shows empty sections message when no sections", () => {
    render(<LocationCard {...baseProps} restaurant={{ ...baseRestaurant, sections: [] }} />);
    expect(screen.getByText("No sections yet.")).toBeTruthy();
  });

  it("shows Sections & tables section header", () => {
    render(<LocationCard {...baseProps} />);
    expect(screen.getByText("Sections & tables")).toBeTruthy();
  });

  it("shows Add Section button", () => {
    render(<LocationCard {...baseProps} />);
    expect(screen.getByText("Add Section")).toBeTruthy();
  });

  it("shows No image set placeholder when no imageUrl", () => {
    render(<LocationCard {...baseProps} />);
    expect(screen.getByText("No image set")).toBeTruthy();
  });

  it("shows Upload button when no imageUrl", () => {
    render(<LocationCard {...baseProps} />);
    expect(screen.getByText("Upload")).toBeTruthy();
  });

  it("shows Change and Remove buttons when imageUrl is set", () => {
    render(
      <LocationCard
        {...baseProps}
        restaurant={{ ...baseRestaurant, imageUrl: "http://example.com/img.jpg" }}
      />
    );
    expect(screen.getByText("Change")).toBeTruthy();
    expect(screen.getByText("Remove")).toBeTruthy();
  });

  it("calls deleteLocationImage when Remove is pressed", async () => {
    (restaurantsApi.deleteLocationImage as jest.Mock).mockResolvedValue(undefined);
    render(
      <LocationCard
        {...baseProps}
        restaurant={{ ...baseRestaurant, imageUrl: "http://example.com/img.jpg" }}
      />
    );
    await act(async () => {
      fireEvent.press(screen.getByText("Remove"));
    });
    expect(restaurantsApi.deleteLocationImage).toHaveBeenCalledWith(1);
  });

  it("calls onSaved with null imageUrl after removing image", async () => {
    (restaurantsApi.deleteLocationImage as jest.Mock).mockResolvedValue(undefined);
    render(
      <LocationCard
        {...baseProps}
        restaurant={{ ...baseRestaurant, imageUrl: "http://example.com/img.jpg" }}
      />
    );
    await act(async () => {
      fireEvent.press(screen.getByText("Remove"));
    });
    expect(baseProps.onSaved).toHaveBeenCalledWith({ imageUrl: null });
  });

  it("shows Image removed message after removing image", async () => {
    (restaurantsApi.deleteLocationImage as jest.Mock).mockResolvedValue(undefined);
    render(
      <LocationCard
        {...baseProps}
        restaurant={{ ...baseRestaurant, imageUrl: "http://example.com/img.jpg" }}
      />
    );
    await act(async () => {
      fireEvent.press(screen.getByText("Remove"));
    });
    await waitFor(() => {
      expect(screen.getByText("Image removed.")).toBeTruthy();
    });
  });

  it("shows Uploading… during image upload", async () => {
    let resolve: (url: string) => void;
    (restaurantsApi.uploadLocationImage as jest.Mock).mockReturnValue(
      new Promise((r) => {
        resolve = r;
      })
    );
    const mockInput = {
      type: "",
      accept: "",
      onchange: null as ((e: Event) => void) | null,
      click: jest.fn(),
      files: [new File(["content"], "photo.jpg", { type: "image/jpeg" })],
    };
    jest.spyOn(document, "createElement").mockReturnValueOnce(mockInput as unknown as HTMLElement);
    render(<LocationCard {...baseProps} />);
    act(() => {
      fireEvent.press(screen.getByText("Upload"));
    });
    act(() => {
      mockInput.onchange?.({} as Event);
    });
    await waitFor(() => {
      expect(screen.getByText("Uploading…")).toBeTruthy();
    });
    await act(async () => {
      resolve!("http://example.com/new.jpg");
    });
  });

  it("calls uploadLocationImage when file is selected", async () => {
    (restaurantsApi.uploadLocationImage as jest.Mock).mockResolvedValue(
      "http://example.com/new.jpg"
    );
    const mockFile = new File(["content"], "photo.jpg", { type: "image/jpeg" });
    const mockInput = {
      type: "",
      accept: "",
      onchange: null as ((e: Event) => void) | null,
      click: jest.fn(),
      files: [mockFile],
    };
    jest.spyOn(document, "createElement").mockReturnValueOnce(mockInput as unknown as HTMLElement);
    render(<LocationCard {...baseProps} />);
    act(() => {
      fireEvent.press(screen.getByText("Upload"));
    });
    await act(async () => {
      mockInput.onchange?.({} as Event);
    });
    await waitFor(() => {
      expect(restaurantsApi.uploadLocationImage).toHaveBeenCalledWith(1, mockFile);
    });
  });

  it("calls onSaved with new imageUrl after successful upload", async () => {
    (restaurantsApi.uploadLocationImage as jest.Mock).mockResolvedValue(
      "http://example.com/new.jpg"
    );
    const mockFile = new File(["content"], "photo.jpg", { type: "image/jpeg" });
    const mockInput = {
      type: "",
      accept: "",
      onchange: null as ((e: Event) => void) | null,
      click: jest.fn(),
      files: [mockFile],
    };
    jest.spyOn(document, "createElement").mockReturnValueOnce(mockInput as unknown as HTMLElement);
    render(<LocationCard {...baseProps} />);
    act(() => {
      fireEvent.press(screen.getByText("Upload"));
    });
    await act(async () => {
      mockInput.onchange?.({} as Event);
    });
    await waitFor(() => {
      expect(baseProps.onSaved).toHaveBeenCalledWith({
        imageUrl: "http://example.com/new.jpg",
      });
    });
  });

  it("shows Image uploaded message after successful upload", async () => {
    (restaurantsApi.uploadLocationImage as jest.Mock).mockResolvedValue(
      "http://example.com/new.jpg"
    );
    const mockFile = new File(["content"], "photo.jpg", { type: "image/jpeg" });
    const mockInput = {
      type: "",
      accept: "",
      onchange: null as ((e: Event) => void) | null,
      click: jest.fn(),
      files: [mockFile],
    };
    jest.spyOn(document, "createElement").mockReturnValueOnce(mockInput as unknown as HTMLElement);
    render(<LocationCard {...baseProps} />);
    act(() => {
      fireEvent.press(screen.getByText("Upload"));
    });
    await act(async () => {
      mockInput.onchange?.({} as Event);
    });
    await waitFor(() => {
      expect(screen.getByText("Image uploaded.")).toBeTruthy();
    });
  });

  it("shows error when upload fails", async () => {
    (restaurantsApi.uploadLocationImage as jest.Mock).mockResolvedValue(null);
    const mockFile = new File(["content"], "photo.jpg", { type: "image/jpeg" });
    const mockInput = {
      type: "",
      accept: "",
      onchange: null as ((e: Event) => void) | null,
      click: jest.fn(),
      files: [mockFile],
    };
    jest.spyOn(document, "createElement").mockReturnValueOnce(mockInput as unknown as HTMLElement);
    render(<LocationCard {...baseProps} />);
    act(() => {
      fireEvent.press(screen.getByText("Upload"));
    });
    await act(async () => {
      mockInput.onchange?.({} as Event);
    });
    await waitFor(() => {
      expect(screen.getByText("Failed to upload image.")).toBeTruthy();
    });
  });

  it("shows size error when file is too large", async () => {
    const largeFile = new File(["x".repeat(3 * 1024 * 1024)], "big.jpg", { type: "image/jpeg" });
    const mockInput = {
      type: "",
      accept: "",
      onchange: null as ((e: Event) => void) | null,
      click: jest.fn(),
      files: [largeFile],
    };
    jest.spyOn(document, "createElement").mockReturnValueOnce(mockInput as unknown as HTMLElement);
    render(<LocationCard {...baseProps} />);
    act(() => {
      fireEvent.press(screen.getByText("Upload"));
    });
    await act(async () => {
      mockInput.onchange?.({} as Event);
    });
    await waitFor(() => {
      expect(screen.getByText("Image must be under 2 MB.")).toBeTruthy();
    });
    expect(restaurantsApi.uploadLocationImage).not.toHaveBeenCalled();
  });

  it("does nothing when no file is selected", async () => {
    const mockInput = {
      type: "",
      accept: "",
      onchange: null as ((e: Event) => void) | null,
      click: jest.fn(),
      files: [],
    };
    jest.spyOn(document, "createElement").mockReturnValueOnce(mockInput as unknown as HTMLElement);
    render(<LocationCard {...baseProps} />);
    act(() => {
      fireEvent.press(screen.getByText("Upload"));
    });
    await act(async () => {
      mockInput.onchange?.({} as Event);
    });
    expect(restaurantsApi.uploadLocationImage).not.toHaveBeenCalled();
  });

  it("calls addSection when Add Section is pressed", async () => {
    (restaurantsApi.addSection as jest.Mock).mockResolvedValue({
      id: 99,
      name: "New Section",
    });
    render(<LocationCard {...baseProps} />);
    await act(async () => {
      fireEvent.press(screen.getByTestId("add-row-btn"));
    });
    expect(restaurantsApi.addSection).toHaveBeenCalledWith(1, "New Section");
  });

  it("calls onSaved with new section after adding", async () => {
    (restaurantsApi.addSection as jest.Mock).mockResolvedValue({
      id: 99,
      name: "New Section",
    });
    render(<LocationCard {...baseProps} />);
    await act(async () => {
      fireEvent.press(screen.getByTestId("add-row-btn"));
    });
    expect(baseProps.onSaved).toHaveBeenCalledWith(
      expect.objectContaining({
        sections: expect.arrayContaining([
          expect.objectContaining({ id: 99, name: "New Section" }),
        ]),
      })
    );
  });

  it("does not call onSaved when addSection returns null", async () => {
    (restaurantsApi.addSection as jest.Mock).mockResolvedValue(null);
    render(<LocationCard {...baseProps} />);
    await act(async () => {
      fireEvent.press(screen.getByTestId("add-row-btn"));
    });
    expect(baseProps.onSaved).not.toHaveBeenCalled();
  });

  it("renders Location Image section label", () => {
    render(<LocationCard {...baseProps} />);
    expect(screen.getByText("Location Image")).toBeTruthy();
  });

  it("renders restaurant without address", () => {
    render(
      <LocationCard
        {...baseProps}
        restaurant={{ ...baseRestaurant, address: undefined as unknown as string }}
      />
    );
    expect(screen.getAllByText("Test Restaurant").length).toBeGreaterThan(0);
  });

  it("renders restaurant without timezone", () => {
    render(
      <LocationCard
        {...baseProps}
        restaurant={{ ...baseRestaurant, timezone: undefined as unknown as string }}
      />
    );
    expect(screen.getAllByText("Test Restaurant").length).toBeGreaterThan(0);
  });

  it("renders in dark mode without error", () => {
    render(<LocationCard {...baseProps} isDark />);
    expect(screen.getAllByText("Test Restaurant").length).toBeGreaterThan(0);
  });

  it("uses default hours when openTime/closeTime not set", () => {
    render(
      <LocationCard
        {...baseProps}
        restaurant={{
          ...baseRestaurant,
          openTime: undefined as unknown as string,
          closeTime: undefined as unknown as string,
        }}
      />
    );
    expect(screen.getByText("09:00–22:00")).toBeTruthy();
  });

  it("calls onSaved with updated sections when section is renamed", () => {
    render(<LocationCard {...baseProps} />);
    fireEvent.press(screen.getByTestId("rename-section-10"));
    expect(baseProps.onSaved).toHaveBeenCalledWith(
      expect.objectContaining({
        sections: expect.arrayContaining([
          expect.objectContaining({ id: 10, name: "Renamed Section" }),
        ]),
      })
    );
  });

  it("calls onSaved with filtered sections when section is deleted", () => {
    render(<LocationCard {...baseProps} />);
    fireEvent.press(screen.getByTestId("delete-section-10"));
    expect(baseProps.onSaved).toHaveBeenCalledWith(
      expect.objectContaining({
        sections: expect.not.arrayContaining([expect.objectContaining({ id: 10 })]),
      })
    );
  });

  it("calls onSaved with added table when table is added to section", () => {
    render(<LocationCard {...baseProps} />);
    fireEvent.press(screen.getByTestId("add-table-10"));
    expect(baseProps.onSaved).toHaveBeenCalledWith(
      expect.objectContaining({
        sections: expect.arrayContaining([
          expect.objectContaining({
            id: 10,
            tables: expect.arrayContaining([
              expect.objectContaining({ id: 999, name: "New Table" }),
            ]),
          }),
        ]),
      })
    );
  });

  it("calls onSaved with updated table when table is updated", () => {
    render(<LocationCard {...baseProps} />);
    fireEvent.press(screen.getByTestId("update-table-10"));
    expect(baseProps.onSaved).toHaveBeenCalledWith(
      expect.objectContaining({
        sections: expect.arrayContaining([
          expect.objectContaining({
            id: 10,
            tables: expect.arrayContaining([
              expect.objectContaining({ id: 100, name: "Updated Table", seats: 6 }),
            ]),
          }),
        ]),
      })
    );
  });

  it("calls onSaved with filtered tables when table is deleted", () => {
    render(<LocationCard {...baseProps} />);
    fireEvent.press(screen.getByTestId("delete-table-10"));
    expect(baseProps.onSaved).toHaveBeenCalledWith(
      expect.objectContaining({
        sections: expect.arrayContaining([
          expect.objectContaining({
            id: 10,
            tables: expect.not.arrayContaining([expect.objectContaining({ id: 100 })]),
          }),
        ]),
      })
    );
  });
});
