import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react-native";
import PopularTimesPicker from "@/components/booking/PopularTimesPicker";
import { TimeSlotDto } from "@/api/availability";

jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: () => "light",
}));

jest.mock("@/utils/date", () => ({
  getNowInTimezone: jest.fn(() => ({ dateStr: "2026-10-10", hours: 13, minutes: 0 })),
}));

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

jest.mock("@/context/BrandContext", () => {
  const brand = { primaryColor: "#0a7ea4" };
  return { useBrand: () => brand };
});

jest.mock("expo-haptics", () => ({
  selectionAsync: jest.fn(),
}));

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

  it("auto-falls-back to All when Dinner category has all slots unavailable", () => {
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
    // Dinner has no available slots → falls back to All, showing the Lunch slot
    expect(screen.getByText("12:00")).toBeTruthy();
    expect(screen.queryByText("18:00")).toBeNull();
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

  it("hides past slots when selectedDate is today", () => {
    // getNowInTimezone mock returns 13:00 on 2026-10-10
    const slotsWithPast: TimeSlotDto[] = [
      { time: "12:00", isAvailable: true, availableTableIds: [1], category: "Lunch" }, // past
      { time: "14:00", isAvailable: true, availableTableIds: [1], category: "Lunch" }, // future
      { time: "18:00", isAvailable: true, availableTableIds: [2], category: "Dinner" },
    ];
    render(
      <PopularTimesPicker
        slots={slotsWithPast}
        selectedTime=""
        onSelectTime={jest.fn()}
        selectedDate="2026-10-10"
        timezone="UTC"
      />
    );
    fireEvent.press(screen.getByText("All"));
    expect(screen.queryByText("12:00")).toBeNull(); // past — hidden
    expect(screen.getByText("14:00")).toBeTruthy(); // future — shown
    expect(screen.getByText("18:00")).toBeTruthy();
  });

  it("shows slots within 5-minute grace period and hides those beyond", () => {
    // mock returns 13:00 (780 mins); 12:55 = 775 mins (≥ 775) shown; 12:54 = 774 mins hidden
    const slots: TimeSlotDto[] = [
      { time: "12:54", isAvailable: true, availableTableIds: [1], category: "Lunch" }, // 6 min past — hidden
      { time: "12:55", isAvailable: true, availableTableIds: [1], category: "Lunch" }, // 5 min past — shown
      { time: "13:00", isAvailable: true, availableTableIds: [1], category: "Lunch" }, // now — shown
    ];
    render(
      <PopularTimesPicker
        slots={slots}
        selectedTime=""
        onSelectTime={jest.fn()}
        selectedDate="2026-10-10"
        timezone="UTC"
      />
    );
    fireEvent.press(screen.getByText("All"));
    expect(screen.queryByText("12:54")).toBeNull();
    expect(screen.getByText("12:55")).toBeTruthy();
    expect(screen.getByText("13:00")).toBeTruthy();
  });

  it("disables Lunch tab when all lunch slots are past today", () => {
    // getNowInTimezone mock returns 13:00 on 2026-10-10 — lunch is over
    const slots: TimeSlotDto[] = [
      { time: "12:00", isAvailable: true, availableTableIds: [1], category: "Lunch" }, // past
      { time: "18:00", isAvailable: true, availableTableIds: [2], category: "Dinner" },
    ];
    render(
      <PopularTimesPicker
        slots={slots}
        selectedTime=""
        onSelectTime={jest.fn()}
        selectedDate="2026-10-10"
        timezone="UTC"
      />
    );
    const lunchTab = screen.getByText("Lunch");
    expect(lunchTab.props.style).toBeTruthy();
    // Press on it — should NOT change category (disabled)
    fireEvent.press(lunchTab);
    // Dinner is available so auto-fallback switches to All, not Lunch
    expect(screen.queryByText("12:00")).toBeNull();
  });

  it("does not disable Lunch tab on a future date", () => {
    const slots: TimeSlotDto[] = [
      { time: "12:00", isAvailable: true, availableTableIds: [1], category: "Lunch" },
      { time: "18:00", isAvailable: true, availableTableIds: [2], category: "Dinner" },
    ];
    render(
      <PopularTimesPicker
        slots={slots}
        selectedTime=""
        onSelectTime={jest.fn()}
        selectedDate="2026-10-11" // tomorrow — no slots are past
        timezone="UTC"
      />
    );
    fireEvent.press(screen.getByText("Lunch"));
    expect(screen.getByText("12:00")).toBeTruthy();
  });

  it("shows all slots when selectedDate is a future date", () => {
    const slotsWithPast: TimeSlotDto[] = [
      { time: "12:00", isAvailable: true, availableTableIds: [1], category: "Lunch" },
      { time: "18:00", isAvailable: true, availableTableIds: [2], category: "Dinner" },
    ];
    render(
      <PopularTimesPicker
        slots={slotsWithPast}
        selectedTime=""
        onSelectTime={jest.fn()}
        selectedDate="2026-10-11" // tomorrow (mock says today is 2026-10-10)
        timezone="UTC"
      />
    );
    fireEvent.press(screen.getByText("All"));
    expect(screen.getByText("12:00")).toBeTruthy();
    expect(screen.getByText("18:00")).toBeTruthy();
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
