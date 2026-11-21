import React from "react";
import { Pressable, Text } from "react-native";
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import { AuthProvider, useAuth, useCan } from "@/context/AuthContext";
import { checkSession, logout } from "@/api/auth";

jest.mock("@/api/auth", () => ({
  checkSession: jest.fn(),
  logout: jest.fn().mockResolvedValue(undefined),
}));

const OWNER = { id: 7, email: "owner@test.com", displayName: "Ola", role: "Owner" };

function Probe() {
  const { user, status, signOut, refresh, setUser } = useAuth();
  const canManage = useCan("manage:users");
  return (
    <>
      <Text testID="status">{status}</Text>
      <Text testID="who">{user ? `${user.displayName}:${user.email}:${user.role}` : "none"}</Text>
      <Text testID="can">{canManage ? "yes" : "no"}</Text>
      <Pressable testID="signout" onPress={() => signOut()}>
        <Text>Sign out</Text>
      </Pressable>
      <Pressable testID="refresh" onPress={() => refresh()}>
        <Text>Refresh</Text>
      </Pressable>
      <Pressable testID="rename" onPress={() => setUser({ ...OWNER, email: "moved@test.com" })}>
        <Text>Rename</Text>
      </Pressable>
    </>
  );
}

const renderProbe = () =>
  render(
    <AuthProvider>
      <Probe />
    </AuthProvider>
  );

describe("AuthProvider", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (checkSession as jest.Mock).mockResolvedValue(OWNER);
  });

  it("resolves the session on mount", async () => {
    renderProbe();

    await waitFor(() => expect(screen.getByTestId("status").props.children).toBe("authenticated"));
    expect(screen.getByTestId("who").props.children).toBe("Ola:owner@test.com:Owner");
    expect(checkSession).toHaveBeenCalledTimes(1);
  });

  it("reports unauthenticated when there is no session", async () => {
    (checkSession as jest.Mock).mockResolvedValue(null);
    renderProbe();

    await waitFor(() =>
      expect(screen.getByTestId("status").props.children).toBe("unauthenticated")
    );
    expect(screen.getByTestId("who").props.children).toBe("none");
  });

  it("holds a signed-in session through a rate-limited check", async () => {
    (checkSession as jest.Mock).mockResolvedValueOnce(OWNER).mockResolvedValueOnce("rate-limited");
    renderProbe();
    await waitFor(() => expect(screen.getByTestId("status").props.children).toBe("authenticated"));

    fireEvent.press(screen.getByTestId("refresh"));

    await waitFor(() => expect(checkSession).toHaveBeenCalledTimes(2));
    expect(screen.getByTestId("status").props.children).toBe("authenticated");
  });

  it("does not promote an unauthenticated session on a rate-limited check", async () => {
    (checkSession as jest.Mock).mockResolvedValueOnce(null).mockResolvedValueOnce("rate-limited");
    renderProbe();
    await waitFor(() =>
      expect(screen.getByTestId("status").props.children).toBe("unauthenticated")
    );

    fireEvent.press(screen.getByTestId("refresh"));

    await waitFor(() => expect(checkSession).toHaveBeenCalledTimes(2));
    expect(screen.getByTestId("status").props.children).toBe("unauthenticated");
  });

  it("exposes capabilities for the signed-in role", async () => {
    renderProbe();
    await waitFor(() => expect(screen.getByTestId("can").props.children).toBe("yes"));
  });

  it("withholds owner capabilities from a Manager", async () => {
    (checkSession as jest.Mock).mockResolvedValue({ ...OWNER, role: "Manager" });
    renderProbe();

    await waitFor(() => expect(screen.getByTestId("status").props.children).toBe("authenticated"));
    expect(screen.getByTestId("can").props.children).toBe("no");
  });

  it("clears the session on sign out", async () => {
    renderProbe();
    await waitFor(() => expect(screen.getByTestId("status").props.children).toBe("authenticated"));

    fireEvent.press(screen.getByTestId("signout"));

    await waitFor(() =>
      expect(screen.getByTestId("status").props.children).toBe("unauthenticated")
    );
    expect(logout).toHaveBeenCalled();
    expect(screen.getByTestId("who").props.children).toBe("none");
  });

  it("accepts an identity pushed in by a caller", async () => {
    renderProbe();
    await waitFor(() => expect(screen.getByTestId("status").props.children).toBe("authenticated"));

    fireEvent.press(screen.getByTestId("rename"));

    await waitFor(() =>
      expect(screen.getByTestId("who").props.children).toBe("Ola:moved@test.com:Owner")
    );
  });

  it("throws when used outside a provider", () => {
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow("useAuth must be used inside an AuthProvider");
    spy.mockRestore();
  });
});
