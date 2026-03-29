import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import LoginScreen from "@/app/(admin)/login";

jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: () => "light",
}));

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

jest.mock("@/context/BrandContext", () => ({
  useBrand: () => ({ appName: "Open Resto", primaryColor: "#0a7ea4" }),
}));

const mockReplace = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: mockReplace }),
  Stack: { Screen: () => null },
}));

jest.mock("@/api/auth", () => ({
  login: jest.fn(),
  getPvqStatus: jest.fn(),
  verifyPvq: jest.fn(),
  resetPassword: jest.fn(),
}));

describe("LoginScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders the login form", () => {
    render(<LoginScreen />);
    expect(screen.getByPlaceholderText("admin@restaurant.com")).toBeTruthy();
  });

  it("renders the sign in button", () => {
    render(<LoginScreen />);
    expect(screen.getByText("Sign In")).toBeTruthy();
  });

  it("renders forgot password link", () => {
    render(<LoginScreen />);
    expect(screen.getByText("Forgot password?")).toBeTruthy();
  });

  it("calls login on form submit", async () => {
    const { login } = require("@/api/auth");
    login.mockResolvedValueOnce(true);

    render(<LoginScreen />);
    fireEvent.changeText(screen.getByPlaceholderText("admin@restaurant.com"), "admin@test.com");
    fireEvent.changeText(screen.getByPlaceholderText("••••••••"), "secret123");
    fireEvent.press(screen.getByText("Sign In"));

    await waitFor(() => {
      expect(login).toHaveBeenCalledWith("admin@test.com", "secret123");
    });
  });

  it("shows error on failed login", async () => {
    const { login } = require("@/api/auth");
    login.mockResolvedValueOnce(false);

    render(<LoginScreen />);
    fireEvent.changeText(screen.getByPlaceholderText("admin@restaurant.com"), "wrong@test.com");
    fireEvent.changeText(screen.getByPlaceholderText("••••••••"), "wrong");
    fireEvent.press(screen.getByText("Sign In"));

    await waitFor(() => {
      expect(screen.getByText(/Invalid email or password/)).toBeTruthy();
    });
  });
});
