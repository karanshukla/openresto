/**
 * @jest-environment ./jest-mocks/jsdomEnvironment.js
 */
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { EmailGuestForm } from "@/components/admin/bookings/EmailGuestForm";

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

jest.mock("@/context/BrandContext", () => {
  const brand = { primaryColor: "#0a7ea4", appName: "Open Resto" };
  return { useBrand: () => brand };
});

jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: () => "light",
}));

const mockColors = { input: "#fff", text: "#000", border: "#ddd" };

const baseProps = {
  borderColor: "#ddd",
  mutedColor: "#888",
  isDark: false,
  colors: mockColors,
  customerEmail: "guest@example.com",
  emailSubject: "",
  emailBody: "",
  emailSending: false,
  emailResult: null,
  setEmailSubject: jest.fn(),
  setEmailBody: jest.fn(),
  onSendEmail: jest.fn(),
};

describe("EmailGuestForm", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders the email guest section title", () => {
    render(<EmailGuestForm {...baseProps} />);
    expect(screen.getByText("Email guest")).toBeTruthy();
  });

  it("shows the recipient email", () => {
    render(<EmailGuestForm {...baseProps} />);
    expect(screen.getByText("To: guest@example.com")).toBeTruthy();
  });

  it("renders Send Email button", () => {
    render(<EmailGuestForm {...baseProps} />);
    expect(screen.getByText("Send Email")).toBeTruthy();
  });

  it("shows Sending… while emailSending is true", () => {
    render(
      <EmailGuestForm {...baseProps} emailSubject="Hello" emailBody="Body text" emailSending />
    );
    expect(screen.getByText("Sending…")).toBeTruthy();
  });

  it("does not call onSendEmail when subject and body are empty (button disabled)", () => {
    render(<EmailGuestForm {...baseProps} emailSubject="" emailBody="" />);
    fireEvent.press(screen.getByText("Send Email"));
    expect(baseProps.onSendEmail).not.toHaveBeenCalled();
  });

  it("calls onSendEmail when subject and body are filled", () => {
    render(<EmailGuestForm {...baseProps} emailSubject="Hello" emailBody="Some message" />);
    fireEvent.press(screen.getByText("Send Email"));
    expect(baseProps.onSendEmail).toHaveBeenCalled();
  });

  it("shows success email result message", () => {
    render(
      <EmailGuestForm
        {...baseProps}
        emailResult={{ ok: true, message: "Email sent successfully." }}
      />
    );
    expect(screen.getByText("Email sent successfully.")).toBeTruthy();
  });

  it("shows error email result message", () => {
    render(
      <EmailGuestForm
        {...baseProps}
        emailResult={{ ok: false, message: "Failed to send email." }}
      />
    );
    expect(screen.getByText("Failed to send email.")).toBeTruthy();
  });

  it("renders dark mode without error", () => {
    render(<EmailGuestForm {...baseProps} isDark />);
    expect(screen.getByText("Email guest")).toBeTruthy();
  });
});
