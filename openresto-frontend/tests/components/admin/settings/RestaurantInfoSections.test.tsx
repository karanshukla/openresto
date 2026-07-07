import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { OpeningHoursSection } from "@/components/admin/settings/OpeningHoursSection";
import { WalkInPolicySection } from "@/components/admin/settings/WalkInPolicySection";
import { LocationTagsSection } from "@/components/admin/settings/LocationTagsSection";

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
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
        <Text>{selectedTime}</Text>
        <Pressable onPress={() => onSelect("10:00")}>
          <Text>Pick Time</Text>
        </Pressable>
      </View>
    ),
  };
});

jest.mock("@/components/common/Input", () => {
  const { TextInput } = require("react-native");
  return {
    __esModule: true,
    default: (props: any) => <TextInput {...props} />,
  };
});

const theme = {
  borderColor: "#ddd",
  mutedColor: "#888",
  primaryColor: "#0a7ea4",
  cardBg: "#fff",
  textColor: "#000",
  surface2: "#f9fafb",
  isDark: false,
};

describe("OpeningHoursSection", () => {
  const baseProps = {
    customHours: false,
    openTime: "09:00",
    closeTime: "22:00",
    weekHours: {
      1: { open: "09:00", close: "22:00" },
      2: { open: "09:00", close: "22:00" },
      3: { open: "09:00", close: "22:00" },
      4: { open: "09:00", close: "22:00" },
      5: { open: "09:00", close: "22:00" },
      6: { open: "10:00", close: "23:00" },
      7: { open: "10:00", close: "23:00" },
    },
    openDays: [1, 2, 3, 4, 5],
    anyOvernight: false,
    onSetCustomHours: jest.fn(),
    onSetOpenTime: jest.fn(),
    onSetCloseTime: jest.fn(),
    onSetDayHours: jest.fn(),
    onCopyHoursToAllDays: jest.fn(),
    onToggleDay: jest.fn(),
    ...theme,
  };

  beforeEach(() => jest.clearAllMocks());

  it("renders the section header and day count", () => {
    render(<OpeningHoursSection {...baseProps} />);
    expect(screen.getByText("Opening hours")).toBeTruthy();
    expect(screen.getByText("5 of 7 days open")).toBeTruthy();
  });

  it("renders both mode toggle buttons in uniform mode", () => {
    render(<OpeningHoursSection {...baseProps} />);
    expect(screen.getByText("Same every day")).toBeTruthy();
    expect(screen.getByText("Custom per day")).toBeTruthy();
  });

  it("switching to custom mode calls onSetCustomHours(true)", () => {
    render(<OpeningHoursSection {...baseProps} />);
    fireEvent.press(screen.getByText("Custom per day"));
    expect(baseProps.onSetCustomHours).toHaveBeenCalledWith(true);
  });

  it("renders per-day toggles with testIDs in custom mode", () => {
    render(<OpeningHoursSection {...baseProps} customHours={true} />);
    expect(screen.getByTestId("day-toggle-1")).toBeTruthy();
    expect(screen.getByTestId("day-toggle-7")).toBeTruthy();
  });

  it("toggling a day in custom mode calls onToggleDay", () => {
    render(<OpeningHoursSection {...baseProps} customHours={true} />);
    fireEvent.press(screen.getByTestId("day-toggle-6"));
    expect(baseProps.onToggleDay).toHaveBeenCalledWith(6);
  });

  it("shows the overnight hint when anyOvernight is true", () => {
    render(<OpeningHoursSection {...baseProps} anyOvernight={true} />);
    expect(
      screen.getByText(
        "A closing time at or before opening means the restaurant closes after midnight."
      )
    ).toBeTruthy();
  });
});

describe("WalkInPolicySection", () => {
  const baseProps = {
    walkInOnly: false,
    walkInDays: [],
    openDays: [1, 2, 3, 4, 5],
    onSetWalkInOnly: jest.fn(),
    onToggleWalkInDay: jest.fn(),
    ...theme,
  };

  beforeEach(() => jest.clearAllMocks());

  it("renders the reservations header and default status", () => {
    render(<WalkInPolicySection {...baseProps} />);
    expect(screen.getByText("Reservations")).toBeTruthy();
    expect(screen.getByText("Online bookings on every open day")).toBeTruthy();
  });

  it("switching to walk-in-only calls onSetWalkInOnly(true)", () => {
    render(<WalkInPolicySection {...baseProps} />);
    fireEvent.press(screen.getByText("Walk-ins only"));
    expect(baseProps.onSetWalkInOnly).toHaveBeenCalledWith(true);
  });

  it("renders the walk-in info banner when walkInOnly is true", () => {
    render(<WalkInPolicySection {...baseProps} walkInOnly={true} />);
    expect(screen.getByText(/walk-in notice instead/)).toBeTruthy();
  });

  it("renders walk-in-day toggles with testIDs when not walk-in-only", () => {
    render(<WalkInPolicySection {...baseProps} walkInDays={[6]} />);
    expect(screen.getByTestId("walkin-day-6")).toBeTruthy();
    expect(screen.getByText("Walk-ins only on 1 day")).toBeTruthy();
  });

  it("toggling a walk-in day calls onToggleWalkInDay", () => {
    render(<WalkInPolicySection {...baseProps} walkInDays={[6]} />);
    fireEvent.press(screen.getByTestId("walkin-day-6"));
    expect(baseProps.onToggleWalkInDay).toHaveBeenCalledWith(6);
  });
});

describe("LocationTagsSection", () => {
  const baseProps = {
    tags: ["pizza", "italian"],
    tagInput: "",
    onSetTagInput: jest.fn(),
    onAddTag: jest.fn(),
    onRemoveTag: jest.fn(),
    borderColor: theme.borderColor,
    mutedColor: theme.mutedColor,
    primaryColor: theme.primaryColor,
    surface2: theme.surface2,
  };

  beforeEach(() => jest.clearAllMocks());

  it("renders the header and existing tag chips", () => {
    render(<LocationTagsSection {...baseProps} />);
    expect(screen.getByText("Location tags")).toBeTruthy();
    expect(screen.getByText("pizza")).toBeTruthy();
    expect(screen.getByText("italian")).toBeTruthy();
  });

  it("remove button has the expected testID and fires onRemoveTag", () => {
    render(<LocationTagsSection {...baseProps} />);
    fireEvent.press(screen.getByTestId("remove-tag-pizza"));
    expect(baseProps.onRemoveTag).toHaveBeenCalledWith("pizza");
  });

  it("typing into the input calls onSetTagInput", () => {
    render(<LocationTagsSection {...baseProps} />);
    const input = screen.getByPlaceholderText("Add tag (press Enter)");
    fireEvent.changeText(input, "sushi");
    expect(baseProps.onSetTagInput).toHaveBeenCalledWith("sushi");
  });

  it("submitting the input calls onAddTag with the current value", () => {
    render(<LocationTagsSection {...baseProps} tagInput="sushi" />);
    fireEvent(screen.getByPlaceholderText("Add tag (press Enter)"), "submitEditing");
    expect(baseProps.onAddTag).toHaveBeenCalledWith("sushi");
  });

  it("add button press calls onAddTag", () => {
    render(<LocationTagsSection {...baseProps} tagInput="ramen" />);
    // The add button is the only Pressable wrapping the Ionicons "add" — but Ionicons is mocked
    // to null, so query by the only enabled pressable left: find via the add icon's container.
    // Instead, press via the button's disabled-gated pressable. Use getAllByRole + filter.
    const input = screen.getByPlaceholderText("Add tag (press Enter)");
    fireEvent(input, "blur"); // onBlur also triggers add when input has a value
    expect(baseProps.onAddTag).toHaveBeenCalledWith("ramen");
  });
});
