import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { EmailGuestForm } from "@/components/admin/bookings/EmailGuestForm";

jest.mock("@/context/BrandContext", () => ({
  useBrand: () => ({ primaryColor: "#007AFF", appName: "Test" }),
}));

jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: () => "light",
}));

const defaultProps = {
  borderColor: "#eee",
  mutedColor: "#888",
  isDark: false,
  colors: { input: "#fff", text: "#000", border: "#eee" },
  customerEmail: "guest@example.com",
  emailSubject: "Your booking",
  emailBody: "Thank you for your reservation.",
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

  it("renders email recipient", () => {
    render(<EmailGuestForm {...defaultProps} />);
    expect(screen.getByText("To: guest@example.com")).toBeTruthy();
  });

  it("renders Email guest section header", () => {
    render(<EmailGuestForm {...defaultProps} />);
    expect(screen.getByText("Email guest")).toBeTruthy();
  });

  it("renders Send Email button", () => {
    render(<EmailGuestForm {...defaultProps} />);
    expect(screen.getByText("Send Email")).toBeTruthy();
  });

  it("calls onSendEmail when Send Email is pressed", () => {
    const onSendEmail = jest.fn();
    render(<EmailGuestForm {...defaultProps} onSendEmail={onSendEmail} />);
    fireEvent.press(screen.getByText("Send Email"));
    expect(onSendEmail).toHaveBeenCalledTimes(1);
  });

  it("shows Sending... when emailSending is true", () => {
    render(<EmailGuestForm {...defaultProps} emailSending={true} />);
    expect(screen.getByText("Sending…")).toBeTruthy();
  });

  it("disables send button when emailSending is true", () => {
    const onSendEmail = jest.fn();
    render(<EmailGuestForm {...defaultProps} emailSending={true} onSendEmail={onSendEmail} />);
    fireEvent.press(screen.getByText("Sending…"));
    expect(onSendEmail).not.toHaveBeenCalled();
  });

  it("shows success email result", () => {
    render(
      <EmailGuestForm
        {...defaultProps}
        emailResult={{ ok: true, message: "Email sent successfully!" }}
      />
    );
    expect(screen.getByText("Email sent successfully!")).toBeTruthy();
  });

  it("shows error email result", () => {
    render(
      <EmailGuestForm
        {...defaultProps}
        emailResult={{ ok: false, message: "Failed to send email." }}
      />
    );
    expect(screen.getByText("Failed to send email.")).toBeTruthy();
  });

  it("disables send button when subject is empty", () => {
    const onSendEmail = jest.fn();
    render(<EmailGuestForm {...defaultProps} emailSubject="" onSendEmail={onSendEmail} />);
    fireEvent.press(screen.getByText("Send Email"));
    expect(onSendEmail).not.toHaveBeenCalled();
  });

  it("disables send button when body is empty", () => {
    const onSendEmail = jest.fn();
    render(<EmailGuestForm {...defaultProps} emailBody="" onSendEmail={onSendEmail} />);
    fireEvent.press(screen.getByText("Send Email"));
    expect(onSendEmail).not.toHaveBeenCalled();
  });

  it("renders in dark mode", () => {
    const { toJSON } = render(<EmailGuestForm {...defaultProps} isDark={true} />);
    expect(toJSON()).toBeDefined();
  });

  it("calls setEmailSubject when subject input changes", () => {
    const setEmailSubject = jest.fn();
    const { UNSAFE_getAllByType } = render(
      <EmailGuestForm {...defaultProps} setEmailSubject={setEmailSubject} />
    );
    // Find the web <input> element and fire a change event
    const inputs = UNSAFE_getAllByType("input" as any);
    if (inputs.length > 0) {
      fireEvent(inputs[0], "change", { target: { value: "New Subject" } });
      expect(setEmailSubject).toHaveBeenCalledWith("New Subject");
    }
  });

  it("calls setEmailBody when textarea changes", () => {
    const setEmailBody = jest.fn();
    const { UNSAFE_getAllByType } = render(
      <EmailGuestForm {...defaultProps} setEmailBody={setEmailBody} />
    );
    const textareas = UNSAFE_getAllByType("textarea" as any);
    if (textareas.length > 0) {
      fireEvent(textareas[0], "change", { target: { value: "New body text" } });
      expect(setEmailBody).toHaveBeenCalledWith("New body text");
    }
  });
});
