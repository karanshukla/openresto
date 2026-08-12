/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import { Linking } from "react-native";
import LargePartyNoticeModal from "@/components/booking/LargePartyNoticeModal";

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: () => "light",
}));

let mockBrandData: { appName: string; primaryColor: string } & Record<string, unknown> = {
  appName: "Open Resto",
  primaryColor: "#0a7ea4",
};

jest.mock("@/context/BrandContext", () => ({
  useBrand: () => mockBrandData,
}));

const mockFetchSocialLinks = jest.fn();
jest.mock("@/api/restaurants", () => ({
  fetchSocialLinks: (...args: unknown[]) => mockFetchSocialLinks(...args),
}));

const SOCIAL_LINKS = [
  {
    id: 1,
    label: "Message us",
    url: "https://wa.me/442079460958",
    iconKey: "logo-whatsapp",
    sortOrder: 0,
  },
];

describe("LargePartyNoticeModal", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBrandData = { appName: "Open Resto", primaryColor: "#0a7ea4" };
    mockFetchSocialLinks.mockResolvedValue(SOCIAL_LINKS);
  });

  it("shows the per-restaurant contact in preference to global social links", async () => {
    render(
      <LargePartyNoticeModal
        visible
        maxCapacity={8}
        restaurant={{ phoneNumber: "+1 555 0100", emailAddress: "local@example.com" }}
        onClose={jest.fn()}
      />
    );

    expect(screen.getByText("+1 555 0100")).toBeTruthy();
    expect(screen.getByText("local@example.com")).toBeTruthy();
    expect(screen.queryByText("Message us")).toBeNull();
    // A typed contact means the social-links request is never made.
    expect(mockFetchSocialLinks).not.toHaveBeenCalled();
  });

  it("prefers the per-restaurant contact over the brand contact", () => {
    mockBrandData = {
      appName: "Open Resto",
      primaryColor: "#0a7ea4",
      phoneNumber: "+44 20 7946 0958",
      emailAddress: "global@example.com",
    };
    render(
      <LargePartyNoticeModal
        visible
        maxCapacity={8}
        restaurant={{ phoneNumber: "+1 555 0100" }}
        onClose={jest.fn()}
      />
    );

    expect(screen.getByText("+1 555 0100")).toBeTruthy();
    expect(screen.queryByText("+44 20 7946 0958")).toBeNull();
    // Email is unset on the location, so it still falls back to the brand value.
    expect(screen.getByText("global@example.com")).toBeTruthy();
  });

  it("falls back to the brand contact when the location has none", () => {
    mockBrandData = {
      appName: "Open Resto",
      primaryColor: "#0a7ea4",
      phoneNumber: "+44 20 7946 0958",
    };
    render(<LargePartyNoticeModal visible maxCapacity={8} restaurant={{}} onClose={jest.fn()} />);

    expect(screen.getByText("+44 20 7946 0958")).toBeTruthy();
    expect(mockFetchSocialLinks).not.toHaveBeenCalled();
  });

  it("falls back to social links when no typed contact exists anywhere", async () => {
    render(<LargePartyNoticeModal visible maxCapacity={8} onClose={jest.fn()} />);

    await waitFor(() => expect(screen.getByText("Message us")).toBeTruthy());
  });

  it("shows the no-contacts message when there is nothing to show at all", async () => {
    mockFetchSocialLinks.mockResolvedValue([]);
    render(<LargePartyNoticeModal visible maxCapacity={8} onClose={jest.fn()} />);

    await waitFor(() => expect(screen.getByText(/No contact details are listed yet/)).toBeTruthy());
  });

  it("opens tel: and mailto: targets when the contact buttons are pressed", () => {
    const openURL = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
    render(
      <LargePartyNoticeModal
        visible
        maxCapacity={8}
        restaurant={{ phoneNumber: "+44 20 7946 0958", emailAddress: "local@example.com" }}
        onClose={jest.fn()}
      />
    );

    fireEvent.press(screen.getByLabelText("Call +44 20 7946 0958"));
    expect(openURL).toHaveBeenCalledWith("tel:+442079460958");

    fireEvent.press(screen.getByLabelText("Email local@example.com"));
    expect(openURL).toHaveBeenCalledWith("mailto:local@example.com");

    openURL.mockRestore();
  });

  it("does not fetch social links while hidden", () => {
    render(<LargePartyNoticeModal visible={false} maxCapacity={8} onClose={jest.fn()} />);
    expect(mockFetchSocialLinks).not.toHaveBeenCalled();
  });

  it("closes when the Got it button is pressed", () => {
    const onClose = jest.fn();
    render(
      <LargePartyNoticeModal
        visible
        maxCapacity={8}
        restaurant={{ phoneNumber: "+1 555 0100" }}
        onClose={onClose}
      />
    );

    fireEvent.press(screen.getByText("Got it"));
    expect(onClose).toHaveBeenCalled();
  });
  it("opens a social link when its fallback button is pressed", async () => {
    const openURL = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
    render(<LargePartyNoticeModal visible maxCapacity={8} onClose={jest.fn()} />);

    const link = await screen.findByLabelText("Message us");
    fireEvent.press(link);
    expect(openURL).toHaveBeenCalledWith("https://wa.me/442079460958");

    openURL.mockRestore();
  });

  it("closes from the backdrop but not from a press inside the card", () => {
    const onClose = jest.fn();
    render(
      <LargePartyNoticeModal
        visible
        maxCapacity={8}
        restaurant={{ phoneNumber: "+1 555 0100" }}
        onClose={onClose}
      />
    );

    // The card sits over the backdrop, so a press on its content never reaches it.
    fireEvent.press(screen.getByText(/Our largest table seats 8/));
    expect(onClose).not.toHaveBeenCalled();

    // The card's accessibilityViewIsModal hides the sibling backdrop from queries.
    fireEvent.press(screen.getByLabelText("Close", { includeHiddenElements: true }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("presents as a labelled dialog", () => {
    render(
      <LargePartyNoticeModal
        visible
        maxCapacity={8}
        restaurant={{ phoneNumber: "+1 555 0100" }}
        onClose={jest.fn()}
      />
    );

    expect(screen.getByLabelText("Large party")).toBeTruthy();
    expect(screen.getByRole("header", { name: "Large party" })).toBeTruthy();
  });
});
