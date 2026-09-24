import React from "react";
import { screen } from "@testing-library/react-native";
import { TurnTimesField } from "@/components/admin/settings/TurnTimesField";
import { renderWithProviders } from "@/tests/helpers/renderWithProviders";

jest.mock("@/utils/haptics", () => ({
  haptics: { selection: jest.fn(), press: jest.fn(), outcome: jest.fn() },
}));

describe("TurnTimesField", () => {
  it("names each row's sitting length by the party size it starts at", () => {
    renderWithProviders(
      <TurnTimesField
        rules={[
          { minSeats: 1, minutes: 60 },
          { minSeats: 5, minutes: 120 },
        ]}
        onChange={jest.fn()}
        defaultMinutes={90}
        durationOptions={[
          { label: "60 min", value: 60 },
          { label: "120 min", value: 120 },
        ]}
        mutedColor="#666"
      />
    );

    expect(screen.getByLabelText(/^Sitting length from 1, /)).toBeTruthy();
    expect(screen.getByLabelText(/^Sitting length from 5, /)).toBeTruthy();
  });
});
