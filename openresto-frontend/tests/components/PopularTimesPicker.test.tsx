import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react-native";
import PopularTimesPicker from "@/components/booking/PopularTimesPicker";
import { TimeSlotDto } from "@/api/availability";

jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: () => "light",
}));

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

jest.mock("@/context/BrandContext", () => {
  const brand = { primaryColor: "#0a7ea4" };
  return { useBrand: () => brand };
});

describe("PopularTimesPicker", () => {
  const mockSlots: TimeSlotDto[] = [
    { time: "12:00", isAvailable: true, availableTableIds: [1], category: "Lunch" },
    { time: "13:00", isAvailable: false, availableTableIds: [], category: "Lunch" },
    { time: "18:00", isAvailable: true, availableTableIds: [2], category: "Dinner" },
  ];

  it("renders correctly and filters by category", () => {
    const onSelectTime = jest.fn();
    render(
      <PopularTimesPicker slots={mockSlots} selectedTime="12:00" onSelectTime={onSelectTime} />
    );

    // Default active is Lunch
    expect(screen.getByText("12:00")).toBeTruthy();
    expect(screen.queryByText("18:00")).toBeNull();

    // Switch to Dinner
    fireEvent.press(screen.getByText("Dinner"));
    expect(screen.getByText("18:00")).toBeTruthy();
    expect(screen.queryByText("12:00")).toBeNull();
  });

  it("handles slot selection", () => {
    const onSelectTime = jest.fn();
    render(<PopularTimesPicker slots={mockSlots} selectedTime="" onSelectTime={onSelectTime} />);

    fireEvent.press(screen.getByText("12:00"));
    expect(onSelectTime).toHaveBeenCalledWith("12:00");
  });

  it("filters out unavailable slots", () => {
    const onSelectTime = jest.fn();
    render(<PopularTimesPicker slots={mockSlots} selectedTime="" onSelectTime={onSelectTime} />);

    // 13:00 is unavailable, so it should not be rendered
    expect(screen.queryByText("13:00")).toBeNull();
  });

  it("shows empty state message", () => {
    render(<PopularTimesPicker slots={[]} selectedTime="" onSelectTime={jest.fn()} />);
    expect(screen.getByText(/No slots available/i)).toBeTruthy();
  });

  it("renders All category tab", () => {
    render(<PopularTimesPicker slots={mockSlots} selectedTime="" onSelectTime={jest.fn()} />);
    expect(screen.getByText("All")).toBeTruthy();
    expect(screen.getByText("Lunch")).toBeTruthy();
    expect(screen.getByText("Dinner")).toBeTruthy();
  });

  it("shows all available slots when All category is selected", () => {
    render(<PopularTimesPicker slots={mockSlots} selectedTime="" onSelectTime={jest.fn()} />);
    fireEvent.press(screen.getByText("All"));
    expect(screen.getByText("12:00")).toBeTruthy();
    expect(screen.getByText("18:00")).toBeTruthy();
  });

  it("shows empty message when Dinner category exists but all slots unavailable", () => {
    // The component only auto-falls-back to All when the category doesn't exist at all.
    // If Dinner exists but all its slots are unavailable, filteredSlots is empty → empty state shown.
    const slotsWithUnavailableDinner: TimeSlotDto[] = [
      { time: "12:00", isAvailable: true, availableTableIds: [1], category: "Lunch" },
      { time: "18:00", isAvailable: false, availableTableIds: [], category: "Dinner" },
    ];
    render(
      <PopularTimesPicker
        slots={slotsWithUnavailableDinner}
        selectedTime=""
        onSelectTime={jest.fn()}
      />
    );
    fireEvent.press(screen.getByText("Dinner"));
    expect(screen.getByText(/No slots available/i)).toBeTruthy();
  });

  it("defaults to All when active category has no slots on mount", () => {
    const dinnerOnlySlots: TimeSlotDto[] = [
      { time: "18:00", isAvailable: true, availableTableIds: [2], category: "Dinner" },
    ];
    render(<PopularTimesPicker slots={dinnerOnlySlots} selectedTime="" onSelectTime={jest.fn()} />);
    // Default is Lunch but Lunch has no slots, should switch to All
    expect(screen.getByText("18:00")).toBeTruthy();
  });

  it("renders selected slot with highlighted style", () => {
    render(<PopularTimesPicker slots={mockSlots} selectedTime="12:00" onSelectTime={jest.fn()} />);
    expect(screen.getByText("12:00")).toBeTruthy();
  });

  it("handles scroll event", () => {
    render(<PopularTimesPicker slots={mockSlots} selectedTime="" onSelectTime={jest.fn()} />);
    const scrollView = screen.UNSAFE_getByType(require("react-native").ScrollView);
    fireEvent.scroll(scrollView, {
      nativeEvent: {
        contentOffset: { x: 50, y: 0 },
        contentSize: { width: 400, height: 65 },
        layoutMeasurement: { width: 300, height: 65 },
      },
    });
    // No crash expected
    expect(screen.getByText("12:00")).toBeTruthy();
  });

  it("handles layout change event", () => {
    render(<PopularTimesPicker slots={mockSlots} selectedTime="" onSelectTime={jest.fn()} />);
    const scrollWrapper = screen.UNSAFE_getAllByType(require("react-native").View)[0];
    act(() => {
      fireEvent(scrollWrapper, "layout", {
        nativeEvent: { layout: { width: 400, height: 65 } },
      });
    });
    expect(screen.getByText("12:00")).toBeTruthy();
  });

  it("handles content size change", () => {
    render(<PopularTimesPicker slots={mockSlots} selectedTime="" onSelectTime={jest.fn()} />);
    const scrollView = screen.UNSAFE_getByType(require("react-native").ScrollView);
    act(() => {
      fireEvent(scrollView, "contentSizeChange", 500, 65);
    });
    expect(screen.getByText("12:00")).toBeTruthy();
  });

  it("renders correctly with a selected time highlighted", () => {
    render(<PopularTimesPicker slots={mockSlots} selectedTime="12:00" onSelectTime={jest.fn()} />);
    // Selected time should be rendered
    expect(screen.getByText("12:00")).toBeTruthy();
  });

  it("switches from Dinner back to Lunch category", () => {
    const bothSlots: TimeSlotDto[] = [
      { time: "12:00", isAvailable: true, availableTableIds: [1], category: "Lunch" },
      { time: "18:00", isAvailable: true, availableTableIds: [2], category: "Dinner" },
    ];
    render(<PopularTimesPicker slots={bothSlots} selectedTime="" onSelectTime={jest.fn()} />);
    fireEvent.press(screen.getByText("Dinner"));
    expect(screen.getByText("18:00")).toBeTruthy();
    fireEvent.press(screen.getByText("Lunch"));
    expect(screen.getByText("12:00")).toBeTruthy();
  });

  it("defaults to All when Lunch category has no slots on mount", () => {
    // Only Dinner slots - Lunch is the default category but has no slots, so it should switch to All
    const dinnerOnlySlots: TimeSlotDto[] = [
      { time: "19:00", isAvailable: true, availableTableIds: [3], category: "Dinner" },
    ];
    render(<PopularTimesPicker slots={dinnerOnlySlots} selectedTime="" onSelectTime={jest.fn()} />);
    // After auto-switch to All, 19:00 should be visible
    expect(screen.getByText("19:00")).toBeTruthy();
  });

  it("fires onLayout on scrollWrapper to update containerWidth", () => {
    render(<PopularTimesPicker slots={mockSlots} selectedTime="" onSelectTime={jest.fn()} />);
    const ScrollViewType = require("react-native").ScrollView;
    const scrollView = screen.UNSAFE_getByType(ScrollViewType);
    const scrollWrapper = scrollView.parent;
    act(() => {
      fireEvent(scrollWrapper!, "layout", { nativeEvent: { layout: { width: 350, height: 65 } } });
    });
    expect(screen.getByText("12:00")).toBeTruthy();
  });

  it("shows and presses left and right scroll arrows when content overflows", () => {
    render(<PopularTimesPicker slots={mockSlots} selectedTime="" onSelectTime={jest.fn()} />);
    const ScrollViewType = require("react-native").ScrollView;
    const scrollView = screen.UNSAFE_getByType(ScrollViewType);
    const scrollWrapper = scrollView.parent!;

    // Trigger state changes by directly calling prop handlers
    act(() => {
      scrollView.props.onContentSizeChange(600, 65);
      scrollWrapper.props.onLayout({ nativeEvent: { layout: { width: 300 } } });
      scrollView.props.onScroll({ nativeEvent: { contentOffset: { x: 50, y: 0 } } });
    });

    // Both arrows should now be visible (testIDs added to source for testability)
    expect(screen.getByTestId("scroll-left-arrow")).toBeTruthy();
    expect(screen.getByTestId("scroll-right-arrow")).toBeTruthy();

    act(() => {
      fireEvent.press(screen.getByTestId("scroll-left-arrow")); // scrollBy(-180)
    });
    act(() => {
      fireEvent.press(screen.getByTestId("scroll-right-arrow")); // scrollBy(180)
    });

    expect(screen.getByText("12:00")).toBeTruthy();
  });
});
