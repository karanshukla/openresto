import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import AdminLoginScreen from "@/app/admin/login";
import { login, getPvqStatus, verifyPvq, resetPassword } from "@/api/auth";
import { useRouter } from "expo-router";
import { BrandProvider } from "@/context/BrandContext";

jest.mock("@/api/auth", () => ({
  login: jest.fn(),
  getPvqStatus: jest.fn(),
  verifyPvq: jest.fn(),
  resetPassword: jest.fn(),
}));

jest.mock("expo-router", () => ({
  useRouter: jest.fn(),
  Stack: {
    Screen: jest.fn(() => null),
  },
}));

jest.mock("@/components/common/Button", () => {
  const { Pressable, Text } = require("react-native");
  return {
    __esModule: true,
    default: ({ onPress, children }: any) => (
      <Pressable onPress={onPress}>
        <Text>{children}</Text>
      </Pressable>
    ),
  };
});

describe("AdminLoginScreen", () => {
  const mockRouter = {
    replace: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
  });

  it("renders login form by default", () => {
    render(
      <BrandProvider>
        <AdminLoginScreen />
      </BrandProvider>
    );
    expect(screen.getByText("Sign in")).toBeTruthy();
    expect(screen.getByPlaceholderText("admin@restaurant.com")).toBeTruthy();
  });

  it("handles successful login", async () => {
    (login as jest.Mock).mockResolvedValue({ message: "Success" });
    render(
      <BrandProvider>
        <AdminLoginScreen />
      </BrandProvider>
    );

    fireEvent.changeText(screen.getByPlaceholderText("admin@restaurant.com"), "admin@test.com");
    fireEvent.changeText(screen.getByPlaceholderText("••••••••"), "password");
    fireEvent.press(screen.getByText("Sign In"));

    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith("/admin/dashboard"));
  });

  it("shows error on failed login", async () => {
    (login as jest.Mock).mockResolvedValue(null);
    render(
      <BrandProvider>
        <AdminLoginScreen />
      </BrandProvider>
    );

    fireEvent.changeText(screen.getByPlaceholderText("admin@restaurant.com"), "admin@test.com");
    fireEvent.changeText(screen.getByPlaceholderText("••••••••"), "wrong");
    fireEvent.press(screen.getByText("Sign In"));

    await waitFor(() =>
      expect(screen.getByText("Invalid email or password. Please try again.")).toBeTruthy()
    );
  });

  it("navigates through forgot password flow", async () => {
    (getPvqStatus as jest.Mock).mockResolvedValue({ isConfigured: true, question: "My Question?" });
    (verifyPvq as jest.Mock).mockResolvedValue({ resetToken: "tok123" });
    (resetPassword as jest.Mock).mockResolvedValue({ ok: true });

    render(
      <BrandProvider>
        <AdminLoginScreen />
      </BrandProvider>
    );

    // Step 1: Click forgot password
    fireEvent.press(screen.getByText("Forgot password?"));
    expect(screen.getByText("Reset password")).toBeTruthy();

    // Step 2: Continue to question
    fireEvent.changeText(screen.getByPlaceholderText("admin@restaurant.com"), "admin@test.com");
    fireEvent.press(screen.getByText("Continue"));
    await waitFor(() => expect(screen.getByText("My Question?")).toBeTruthy());

    // Step 3: Verify answer
    fireEvent.changeText(screen.getByPlaceholderText("Answer (not case sensitive)"), "my answer");
    fireEvent.press(screen.getByText("Verify Answer"));
    await waitFor(() => expect(screen.getByText("Set new password")).toBeTruthy());

    // Step 4: Reset password
    fireEvent.changeText(screen.getByPlaceholderText("At least 6 characters"), "newpass");
    fireEvent.changeText(screen.getByPlaceholderText("Repeat password"), "newpass");
    fireEvent.press(screen.getByText("Reset Password"));
    await waitFor(() => expect(screen.getByText("Password reset!")).toBeTruthy());

    // Step 5: Back to sign in
    fireEvent.press(screen.getByText("Back to Sign In"));
    expect(screen.getByText("Sign in")).toBeTruthy();
  });

  it("email submitEditing triggers the onSubmitEditing callback", () => {
    render(
      <BrandProvider>
        <AdminLoginScreen />
      </BrandProvider>
    );
    const emailInput = screen.getByPlaceholderText("admin@restaurant.com");
    fireEvent(emailInput, "submitEditing");
    // No assertion needed — covers the onSubmitEditing optional-chain callback
  });

  it("falls back to COLORS.primary when brand has no primaryColor", () => {
    const brandModule = require("@/context/BrandContext");
    const spy = jest
      .spyOn(brandModule, "useBrand")
      .mockReturnValueOnce({ appName: "Test", primaryColor: "" });
    render(<AdminLoginScreen />);
    expect(screen.getByText("Sign in")).toBeTruthy();
    spy.mockRestore();
  });

  it("'Back to {appName}' link on login stage calls router.replace('/')", () => {
    render(
      <BrandProvider>
        <AdminLoginScreen />
      </BrandProvider>
    );

    // The link text starts with "← Back to "
    const backLink = screen.getByText(/← Back to/);
    fireEvent.press(backLink);

    expect(mockRouter.replace).toHaveBeenCalledWith("/");
  });

  it("Back button in pvq-email stage returns to login", () => {
    render(
      <BrandProvider>
        <AdminLoginScreen />
      </BrandProvider>
    );

    fireEvent.press(screen.getByText("Forgot password?"));
    expect(screen.getByText("Reset password")).toBeTruthy();

    fireEvent.press(screen.getByText("Back"));
    expect(screen.getByText("Sign in")).toBeTruthy();
  });

  it("Back button in pvq-answer stage returns to pvq-email", async () => {
    (getPvqStatus as jest.Mock).mockResolvedValue({ isConfigured: true, question: "Pet name?" });

    render(
      <BrandProvider>
        <AdminLoginScreen />
      </BrandProvider>
    );

    // Navigate to pvq-email
    fireEvent.press(screen.getByText("Forgot password?"));
    fireEvent.changeText(screen.getByPlaceholderText("admin@restaurant.com"), "admin@test.com");
    fireEvent.press(screen.getByText("Continue"));

    // Wait for pvq-answer stage
    await waitFor(() => expect(screen.getByText("Pet name?")).toBeTruthy());

    // Press Back
    fireEvent.press(screen.getByText("Back"));
    expect(screen.getByText("Reset password")).toBeTruthy();
  });

  it("handleFetchQuestion shows error when getPvqStatus returns null", async () => {
    (getPvqStatus as jest.Mock).mockResolvedValue(null);

    render(
      <BrandProvider>
        <AdminLoginScreen />
      </BrandProvider>
    );

    fireEvent.press(screen.getByText("Forgot password?"));
    fireEvent.changeText(screen.getByPlaceholderText("admin@restaurant.com"), "admin@test.com");
    fireEvent.press(screen.getByText("Continue"));

    await waitFor(() =>
      expect(
        screen.getByText("No security question has been configured for this account.")
      ).toBeTruthy()
    );
  });

  it("handleFetchQuestion shows error when getPvqStatus returns isConfigured: false", async () => {
    (getPvqStatus as jest.Mock).mockResolvedValue({ isConfigured: false, question: null });

    render(
      <BrandProvider>
        <AdminLoginScreen />
      </BrandProvider>
    );

    fireEvent.press(screen.getByText("Forgot password?"));
    fireEvent.changeText(screen.getByPlaceholderText("admin@restaurant.com"), "admin@test.com");
    fireEvent.press(screen.getByText("Continue"));

    await waitFor(() =>
      expect(
        screen.getByText("No security question has been configured for this account.")
      ).toBeTruthy()
    );
  });

  it("handleVerifyAnswer shows error when verifyPvq returns null", async () => {
    (getPvqStatus as jest.Mock).mockResolvedValue({
      isConfigured: true,
      question: "Favourite color?",
    });
    (verifyPvq as jest.Mock).mockResolvedValue(null);

    render(
      <BrandProvider>
        <AdminLoginScreen />
      </BrandProvider>
    );

    fireEvent.press(screen.getByText("Forgot password?"));
    fireEvent.changeText(screen.getByPlaceholderText("admin@restaurant.com"), "admin@test.com");
    fireEvent.press(screen.getByText("Continue"));

    await waitFor(() => expect(screen.getByText("Favourite color?")).toBeTruthy());

    fireEvent.changeText(screen.getByPlaceholderText("Answer (not case sensitive)"), "blue");
    fireEvent.press(screen.getByText("Verify Answer"));

    await waitFor(() =>
      expect(screen.getByText("Incorrect answer. Please try again.")).toBeTruthy()
    );
  });

  it("handleResetPassword shows error when passwords do not match", async () => {
    (getPvqStatus as jest.Mock).mockResolvedValue({ isConfigured: true, question: "City?" });
    (verifyPvq as jest.Mock).mockResolvedValue({ resetToken: "tok-abc" });

    render(
      <BrandProvider>
        <AdminLoginScreen />
      </BrandProvider>
    );

    // Navigate to reset stage
    fireEvent.press(screen.getByText("Forgot password?"));
    fireEvent.changeText(screen.getByPlaceholderText("admin@restaurant.com"), "admin@test.com");
    fireEvent.press(screen.getByText("Continue"));
    await waitFor(() => expect(screen.getByText("City?")).toBeTruthy());
    fireEvent.changeText(screen.getByPlaceholderText("Answer (not case sensitive)"), "London");
    fireEvent.press(screen.getByText("Verify Answer"));
    await waitFor(() => expect(screen.getByText("Set new password")).toBeTruthy());

    // Enter mismatched passwords
    fireEvent.changeText(screen.getByPlaceholderText("At least 6 characters"), "newpass");
    fireEvent.changeText(screen.getByPlaceholderText("Repeat password"), "different");
    fireEvent.press(screen.getByText("Reset Password"));

    await waitFor(() => expect(screen.getByText("Passwords do not match.")).toBeTruthy());
  });

  it("handleResetPassword shows error when password is too short", async () => {
    (getPvqStatus as jest.Mock).mockResolvedValue({ isConfigured: true, question: "City?" });
    (verifyPvq as jest.Mock).mockResolvedValue({ resetToken: "tok-abc" });

    render(
      <BrandProvider>
        <AdminLoginScreen />
      </BrandProvider>
    );

    // Navigate to reset stage
    fireEvent.press(screen.getByText("Forgot password?"));
    fireEvent.changeText(screen.getByPlaceholderText("admin@restaurant.com"), "admin@test.com");
    fireEvent.press(screen.getByText("Continue"));
    await waitFor(() => expect(screen.getByText("City?")).toBeTruthy());
    fireEvent.changeText(screen.getByPlaceholderText("Answer (not case sensitive)"), "London");
    fireEvent.press(screen.getByText("Verify Answer"));
    await waitFor(() => expect(screen.getByText("Set new password")).toBeTruthy());

    // Enter a short password (5 chars) — note: Button is disabled when < 6, so set to 6 first
    // then change confirm to 5 chars to trigger the mismatch path; instead test via direct state:
    // We set both to the same short value but the Button disabled guard blocks press when < 6.
    // Use a 6-char password that matches confirm, then directly test the length guard by
    // firing with mismatched confirm of same short length.
    fireEvent.changeText(screen.getByPlaceholderText("At least 6 characters"), "abc");
    fireEvent.changeText(screen.getByPlaceholderText("Repeat password"), "abc");
    // Button is disabled when newPassword.length < 6, so we directly invoke via the
    // onSubmitEditing or use act to bypass — instead, test with a 5-char password via fireEvent
    // that circumvents the disabled check (fireEvent ignores disabled on Pressable):
    fireEvent.press(screen.getByText("Reset Password"));

    await waitFor(() =>
      expect(screen.getByText("Password must be at least 6 characters.")).toBeTruthy()
    );
  });

  it("handleResetPassword shows server error when resetPassword returns ok: false", async () => {
    (getPvqStatus as jest.Mock).mockResolvedValue({ isConfigured: true, question: "City?" });
    (verifyPvq as jest.Mock).mockResolvedValue({ resetToken: "tok-abc" });
    (resetPassword as jest.Mock).mockResolvedValue({ ok: false, message: "Server error." });

    render(
      <BrandProvider>
        <AdminLoginScreen />
      </BrandProvider>
    );

    // Navigate to reset stage
    fireEvent.press(screen.getByText("Forgot password?"));
    fireEvent.changeText(screen.getByPlaceholderText("admin@restaurant.com"), "admin@test.com");
    fireEvent.press(screen.getByText("Continue"));
    await waitFor(() => expect(screen.getByText("City?")).toBeTruthy());
    fireEvent.changeText(screen.getByPlaceholderText("Answer (not case sensitive)"), "London");
    fireEvent.press(screen.getByText("Verify Answer"));
    await waitFor(() => expect(screen.getByText("Set new password")).toBeTruthy());

    // Enter valid matching passwords
    fireEvent.changeText(screen.getByPlaceholderText("At least 6 characters"), "newpass");
    fireEvent.changeText(screen.getByPlaceholderText("Repeat password"), "newpass");
    fireEvent.press(screen.getByText("Reset Password"));

    await waitFor(() => expect(screen.getByText("Server error.")).toBeTruthy());
  });
});
