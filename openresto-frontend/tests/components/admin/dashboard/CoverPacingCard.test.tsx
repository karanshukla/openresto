import React from "react";
import { render, screen } from "@testing-library/react-native";
import { CoverPacingCard } from "@/components/admin/dashboard/CoverPacingCard";
import type { LocationPacingDto } from "@/api/admin";

jest.mock("@/context/BrandContext", () => ({
  useBrand: () => ({ primaryColor: "#0a7ea4", appName: "Open Resto" }),
}));

const capped = (slots: LocationPacingDto["slots"]): LocationPacingDto => ({
  restaurantId: 3,
  restaurantName: "Paddy's",
  maxCoversPerSlot: 8,
  slots,
});

describe("CoverPacingCard", () => {
  it("stays silent when no location has a cap", () => {
    render(<CoverPacingCard pacing={[]} />);

    expect(screen.queryByTestId("cover-pacing-card")).toBeNull();
  });

  it("marks only the slot that reached the cap as full", () => {
    render(
      <CoverPacingCard
        pacing={[
          capped([
            { time: "19:00", covers: 8 },
            { time: "19:30", covers: 7 },
          ]),
        ]}
      />
    );

    expect(screen.getByText("Cap 8 guests")).toBeTruthy();
    expect(screen.getByLabelText("19:00: 8 of 8 guests")).toBeTruthy();
    expect(screen.getAllByTestId("pacing-bar-full")).toHaveLength(1);
  });

  it("says so when a capped location has no arrivals yet", () => {
    render(<CoverPacingCard pacing={[capped([])]} />);

    expect(screen.getByText("No arrivals yet today.")).toBeTruthy();
  });
});
