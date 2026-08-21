import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { ScheduleConflictsBanner } from "@/components/admin/dashboard/ScheduleConflictsBanner";

const mockPush = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock("@/context/BrandContext", () => ({
  useBrand: () => ({ primaryColor: "#0a7ea4", appName: "Open Resto" }),
}));

describe("ScheduleConflictsBanner", () => {
  beforeEach(() => mockPush.mockClear());

  it("stays silent when nothing is stranded", () => {
    render(<ScheduleConflictsBanner count={0} />);

    expect(screen.queryByTestId("dashboard-schedule-conflicts")).toBeNull();
  });

  it("reports the total across every location", () => {
    render(<ScheduleConflictsBanner count={4} />);

    expect(screen.getByText(/4 upcoming bookings no longer fit/)).toBeTruthy();
  });

  it("keeps the count singular for one booking", () => {
    render(<ScheduleConflictsBanner count={1} />);

    expect(screen.getByText(/1 upcoming booking no longer fits?/)).toBeTruthy();
    expect(screen.queryByText(/bookings/)).toBeNull();
  });

  it("opens the locations screen, where the bookings can be acted on", () => {
    render(<ScheduleConflictsBanner count={2} />);

    fireEvent.press(screen.getByTestId("dashboard-schedule-conflicts"));

    expect(mockPush).toHaveBeenCalledWith("/admin/locations");
  });

  it("treats a negative count as nothing to report", () => {
    render(<ScheduleConflictsBanner count={-1} />);

    expect(screen.queryByTestId("dashboard-schedule-conflicts")).toBeNull();
  });
});
