import React, { useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import WaitlistPushOptIn from "@/components/waitlist/WaitlistPushOptIn";
import { canRegisterForReminders, registerForReminders } from "@/services/pushRegistration";
import type { ReminderRegistration } from "@/api/reminders";

jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
jest.mock("@/hooks/use-color-scheme", () => ({ useColorScheme: () => "light" }));
jest.mock("@/context/BrandContext", () => ({
  useBrand: () => ({ primaryColor: "#0a7ea4", appName: "Open Resto", webPushPublicKey: "BKEY" }),
}));
jest.mock("@/services/pushRegistration", () => ({
  canRegisterForReminders: jest.fn(),
  registerForReminders: jest.fn(),
}));

const mockCan = canRegisterForReminders as jest.Mock;
const mockRegister = registerForReminders as jest.Mock;
const device: ReminderRegistration = { channel: "expo", endpoint: "ExponentPushToken[abc]" };
const onChange = jest.fn();

/** The form owns the registration, as JoinWaitlistForm does. */
function OptIn() {
  const [registration, setRegistration] = useState<ReminderRegistration | null>(null);
  return (
    <WaitlistPushOptIn
      registration={registration}
      onChange={(next) => {
        onChange(next);
        setRegistration(next);
      }}
    />
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockCan.mockReturnValue(true);
});

describe("WaitlistPushOptIn", () => {
  it("renders nothing where this device cannot be pushed", () => {
    mockCan.mockReturnValue(false);
    render(<OptIn />);
    expect(screen.queryByTestId("waitlist-push")).toBeNull();
  });

  it("registers the device on press and hands the address to the form", async () => {
    mockRegister.mockResolvedValue({ status: "registered", registration: device });
    render(<OptIn />);
    expect(screen.getByText("Notify me")).toBeTruthy();
    expect(screen.getByRole("switch")).not.toBeChecked();

    fireEvent.press(screen.getByTestId("waitlist-push-btn"));

    expect(await screen.findByText("Notifications on")).toBeTruthy();
    expect(screen.getByRole("switch")).toBeChecked();
    expect(mockRegister).toHaveBeenCalledWith({ webPushPublicKey: "BKEY" });
    expect(onChange).toHaveBeenLastCalledWith(device);
  });

  it("turns off without asking the OS again", async () => {
    mockRegister.mockResolvedValue({ status: "registered", registration: device });
    render(<OptIn />);
    fireEvent.press(screen.getByTestId("waitlist-push-btn"));
    await screen.findByText("Notifications on");

    fireEvent.press(screen.getByTestId("waitlist-push-btn"));

    expect(await screen.findByText("Notify me")).toBeTruthy();
    expect(onChange).toHaveBeenLastCalledWith(null);
    expect(mockRegister).toHaveBeenCalledTimes(1);
  });

  it("explains a refused prompt instead of re-prompting", async () => {
    mockRegister.mockResolvedValue({ status: "denied" });
    render(<OptIn />);

    fireEvent.press(screen.getByTestId("waitlist-push-btn"));

    expect(await screen.findByText(/turned off for this app/)).toBeTruthy();
    await waitFor(() => expect(screen.getByTestId("waitlist-push-btn")).toBeDisabled());
    expect(onChange).not.toHaveBeenCalled();
  });
});
