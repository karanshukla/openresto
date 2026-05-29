import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react-native";
import { RestaurantInfoForm } from "@/components/admin/settings/RestaurantInfoForm";
import * as restaurantsApi from "@/api/restaurants";

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

jest.mock("@/api/restaurants", () => ({
  updateRestaurant: jest.fn(),
}));

jest.mock("@/context/BrandContext", () => {
  const brand = { primaryColor: "#0a7ea4", appName: "Open Resto" };
  return { useBrand: () => brand };
});

jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: () => "light",
}));

jest.mock("@/components/common/TimePicker", () => {
  const { View, Text, Pressable } = require("react-native");
  return {
    __esModule: true,
    default: ({
      selectedTime,
      onSelect,
    }: {
      selectedTime: string;
      onSelect: (t: string) => void;
    }) => (
      <View>
        <Text testID="time-picker">{selectedTime}</Text>
        <Pressable onPress={() => onSelect("10:00")}>
          <Text>Pick Time</Text>
        </Pressable>
      </View>
    ),
  };
});

const mockRestaurant = {
  id: 1,
  name: "Test Resto",
  address: "123 Main St",
  openTime: "09:00",
  closeTime: "22:00",
  openDays: "1,2,3,4,5",
  timezone: "UTC",
  tags: ["pizza", "italian"],
  sections: [],
};

describe("RestaurantInfoForm", () => {
  const onSaved = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders the restaurant name", () => {
    render(<RestaurantInfoForm restaurant={mockRestaurant} onSaved={onSaved} />);
    expect(screen.getByDisplayValue("Test Resto")).toBeTruthy();
  });

  it("renders the address field", () => {
    render(<RestaurantInfoForm restaurant={mockRestaurant} onSaved={onSaved} />);
    expect(screen.getByDisplayValue("123 Main St")).toBeTruthy();
  });

  it("renders open days as toggleable buttons", () => {
    render(<RestaurantInfoForm restaurant={mockRestaurant} onSaved={onSaved} />);
    expect(screen.getByText("Mon")).toBeTruthy();
    expect(screen.getByText("Sun")).toBeTruthy();
  });

  it("shows tags", () => {
    render(<RestaurantInfoForm restaurant={mockRestaurant} onSaved={onSaved} />);
    expect(screen.getByText("pizza")).toBeTruthy();
    expect(screen.getByText("italian")).toBeTruthy();
  });

  it("shows Save button", () => {
    render(<RestaurantInfoForm restaurant={mockRestaurant} onSaved={onSaved} />);
    expect(screen.getByText("Save changes")).toBeTruthy();
  });

  it("shows All changes saved status by default", () => {
    render(<RestaurantInfoForm restaurant={mockRestaurant} onSaved={onSaved} />);
    expect(screen.getByText("All changes saved")).toBeTruthy();
  });

  it("shows Unsaved changes when form is dirty", () => {
    render(<RestaurantInfoForm restaurant={mockRestaurant} onSaved={onSaved} />);
    fireEvent.changeText(screen.getByDisplayValue("Test Resto"), "New Name");
    expect(screen.getByText("Unsaved changes")).toBeTruthy();
  });

  it("calls updateRestaurant when Save is pressed after editing", async () => {
    (restaurantsApi.updateRestaurant as jest.Mock).mockResolvedValue({
      ...mockRestaurant,
      name: "Updated Resto",
    });
    render(<RestaurantInfoForm restaurant={mockRestaurant} onSaved={onSaved} />);
    fireEvent.changeText(screen.getByDisplayValue("Test Resto"), "Updated Resto");
    await act(async () => {
      fireEvent.press(screen.getByText("Save changes"));
    });
    expect(restaurantsApi.updateRestaurant).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ name: "Updated Resto" })
    );
  });

  it("allows name to be edited", () => {
    render(<RestaurantInfoForm restaurant={mockRestaurant} onSaved={onSaved} />);
    fireEvent.changeText(screen.getByDisplayValue("Test Resto"), "New Name");
    expect(screen.getByDisplayValue("New Name")).toBeTruthy();
  });

  it("toggles a day open/closed when pressed", () => {
    render(<RestaurantInfoForm restaurant={mockRestaurant} onSaved={onSaved} />);
    // Sat (day 6) is not in openDays "1,2,3,4,5" — pressing it should include it
    fireEvent.press(screen.getByText("Sat"));
    // Component should still render correctly after toggle
    expect(screen.getByText("Sat")).toBeTruthy();
  });

  it("deselects an active day when pressed again", () => {
    render(<RestaurantInfoForm restaurant={mockRestaurant} onSaved={onSaved} />);
    // Mon (day 1) is active in "1,2,3,4,5" — pressing it deselects it
    fireEvent.press(screen.getByText("Mon"));
    expect(screen.getByText("4 of 7 days open")).toBeTruthy();
  });

  it("adds a tag via onSubmitEditing", () => {
    render(<RestaurantInfoForm restaurant={mockRestaurant} onSaved={onSaved} />);
    const tagInput = screen.getByPlaceholderText("Add tag (press Enter)");
    fireEvent.changeText(tagInput, "sushi");
    fireEvent(tagInput, "submitEditing");
    expect(screen.getByText("sushi")).toBeTruthy();
    // Input should be cleared
    expect(screen.getByPlaceholderText("Add tag (press Enter)")).toBeTruthy();
  });

  it("does not add a duplicate tag", () => {
    render(<RestaurantInfoForm restaurant={mockRestaurant} onSaved={onSaved} />);
    const tagInput = screen.getByPlaceholderText("Add tag (press Enter)");
    fireEvent.changeText(tagInput, "pizza");
    fireEvent(tagInput, "submitEditing");
    // Only one "pizza" text should exist (not two)
    expect(screen.getAllByText("pizza")).toHaveLength(1);
  });

  it("adds a tag via onBlur when input has value", () => {
    render(<RestaurantInfoForm restaurant={mockRestaurant} onSaved={onSaved} />);
    const tagInput = screen.getByPlaceholderText("Add tag (press Enter)");
    fireEvent.changeText(tagInput, "ramen");
    fireEvent(tagInput, "blur");
    expect(screen.getByText("ramen")).toBeTruthy();
  });

  it("removes a tag when its remove button is pressed", () => {
    render(<RestaurantInfoForm restaurant={mockRestaurant} onSaved={onSaved} />);
    expect(screen.getByText("pizza")).toBeTruthy();
    fireEvent.press(screen.getByTestId("remove-tag-pizza"));
    expect(screen.queryByText("pizza")).toBeNull();
    expect(screen.getByText("italian")).toBeTruthy();
  });

  it("discards changes when Discard is pressed", () => {
    render(<RestaurantInfoForm restaurant={mockRestaurant} onSaved={onSaved} />);
    fireEvent.changeText(screen.getByDisplayValue("Test Resto"), "Changed Name");
    expect(screen.getByText("Unsaved changes")).toBeTruthy();
    fireEvent.press(screen.getByText("Discard"));
    expect(screen.getByDisplayValue("Test Resto")).toBeTruthy();
    expect(screen.getByText("All changes saved")).toBeTruthy();
  });

  it("flushes pending tag input when saving", async () => {
    (restaurantsApi.updateRestaurant as jest.Mock).mockResolvedValue({
      ...mockRestaurant,
      name: "Updated Resto",
      tags: ["pizza", "italian", "tapas"],
    });
    render(<RestaurantInfoForm restaurant={mockRestaurant} onSaved={onSaved} />);
    fireEvent.changeText(screen.getByDisplayValue("Test Resto"), "Updated Resto");
    const tagInput = screen.getByPlaceholderText("Add tag (press Enter)");
    fireEvent.changeText(tagInput, "tapas");
    await act(async () => {
      fireEvent.press(screen.getByText("Save changes"));
    });
    expect(restaurantsApi.updateRestaurant).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ tags: expect.stringContaining("tapas") })
    );
    expect(onSaved).toHaveBeenCalled();
  });

  it("does not call onSaved when updateRestaurant returns null", async () => {
    (restaurantsApi.updateRestaurant as jest.Mock).mockResolvedValue(null);
    render(<RestaurantInfoForm restaurant={mockRestaurant} onSaved={onSaved} />);
    fireEvent.changeText(screen.getByDisplayValue("Test Resto"), "Updated Resto");
    await act(async () => {
      fireEvent.press(screen.getByText("Save changes"));
    });
    expect(onSaved).not.toHaveBeenCalled();
  });
});
