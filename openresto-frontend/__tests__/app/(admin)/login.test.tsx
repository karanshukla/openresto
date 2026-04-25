import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react-native";
import AdminLoginScreen from "@/app/(admin)/login";
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

    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith("/(admin)/dashboard"));
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

    await waitFor(() => expect(screen.getByText("Invalid email or password. Please try again.")).toBeTruthy());
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
});
