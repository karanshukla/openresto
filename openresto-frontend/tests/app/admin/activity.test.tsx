/**
 * @jest-environment jsdom
 */
import React from "react";
import { screen, waitFor, fireEvent } from "@testing-library/react-native";
import { Platform } from "react-native";
import ActivityScreen from "@/app/admin/activity";
import * as auditApi from "@/api/audit";
import * as restaurantsApi from "@/api/restaurants";
import * as usersApi from "@/api/users";
import * as authApi from "@/api/auth";
import { REDACTED_MARKER } from "@/utils/audit";
import { renderWithProviders } from "@/tests/helpers/renderWithProviders";

const mockRedirect = jest.fn();
jest.mock("expo-router", () => {
  const Screen = () => null;
  Screen.displayName = "Screen";
  const Redirect = (props: { href: string }) => {
    mockRedirect(props.href);
    const { Text } = require("react-native");
    return <Text>{`redirect:${props.href}`}</Text>;
  };
  Redirect.displayName = "Redirect";
  return { Stack: { Screen }, Redirect };
});

jest.mock("@/api/audit", () => ({ getAuditEntries: jest.fn() }));
jest.mock("@/api/restaurants", () => ({ fetchRestaurants: jest.fn() }));
jest.mock("@/api/users", () => ({ adminListUsers: jest.fn() }));
jest.mock("@/api/auth", () => ({ checkSession: jest.fn(), logout: jest.fn() }));

const mockGetAuditEntries = auditApi.getAuditEntries as jest.Mock;
const mockFetchRestaurants = restaurantsApi.fetchRestaurants as jest.Mock;
const mockAdminListUsers = usersApi.adminListUsers as jest.Mock;
const mockCheckSession = authApi.checkSession as jest.Mock;

const asRole = (role: string) =>
  mockCheckSession.mockResolvedValue({
    id: 1,
    email: "owner@test.com",
    displayName: null,
    role,
  });

const entry = (over: Partial<auditApi.AdminAuditEntryDto> = {}): auditApi.AdminAuditEntryDto => ({
  id: 1,
  occurredAt: new Date().toISOString(),
  actorUserId: 1,
  actorEmail: "owner@test.com",
  actorDisplayName: "Dana",
  actorRole: "Owner",
  action: "booking.cancel",
  targetType: "Booking",
  targetId: "42",
  targetLabel: "REF001",
  restaurantId: 1,
  summary: "Cancelled REF001 at Resto A",
  changes: [],
  httpMethod: "POST",
  path: "/api/admin/bookings/42/cancel",
  statusCode: 200,
  ipAddress: "10.0.0.4",
  userAgent: "Mozilla/5.0",
  ...over,
});

const page = (items: auditApi.AdminAuditEntryDto[], totalCount = items.length) => ({
  items,
  totalCount,
  page: 1,
  pageSize: 25,
});

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, "error").mockImplementation(() => {});
  Object.defineProperty(Platform, "OS", { value: "web", configurable: true });
  localStorage.clear();

  mockGetAuditEntries.mockReset();
  mockGetAuditEntries.mockResolvedValue(page([entry()]));
  mockFetchRestaurants.mockResolvedValue([{ id: 1, name: "Resto A" }]);
  mockAdminListUsers.mockResolvedValue([
    { id: 1, email: "owner@test.com", displayName: "Dana", role: "Owner", isActive: true },
  ]);
  asRole("Owner");
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("ActivityScreen capability gate", () => {
  it("holds on the loader while the session is still resolving", async () => {
    mockCheckSession.mockImplementation(() => new Promise(() => {}));
    renderWithProviders(<ActivityScreen />, { withAuth: true });
    expect(screen.getByTestId("loading-screen")).toBeTruthy();
    expect(mockGetAuditEntries).not.toHaveBeenCalled();
  });

  it("shows the trail to an Owner", async () => {
    renderWithProviders(<ActivityScreen />, { withAuth: true });
    await waitFor(() => expect(screen.getByText("Activity")).toBeTruthy());
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("bounces a Manager to the dashboard without ever querying the trail", async () => {
    asRole("Manager");
    renderWithProviders(<ActivityScreen />, { withAuth: true });
    await waitFor(() => expect(mockRedirect).toHaveBeenCalledWith("/admin/dashboard"));
    expect(screen.queryByText("Activity")).toBeNull();
    expect(mockGetAuditEntries).not.toHaveBeenCalled();
  });
});

describe("ActivityScreen", () => {
  it("shows a loading subtitle before the first page lands", async () => {
    let resolvePage: (value: unknown) => void = () => {};
    mockGetAuditEntries.mockImplementation(() => new Promise((resolve) => (resolvePage = resolve)));
    renderWithProviders(<ActivityScreen />, { withAuth: true });
    await waitFor(() => expect(screen.getByText("Loading…")).toBeTruthy());
    resolvePage(page([entry()]));
    await waitFor(() => expect(screen.getByText("1 recorded event")).toBeTruthy());
  });

  it("leads a row with its summary, actor and status", async () => {
    renderWithProviders(<ActivityScreen />, { withAuth: true });
    await waitFor(() => expect(screen.getByText("Cancelled REF001 at Resto A")).toBeTruthy());
    expect(screen.getByText(/Dana · Owner · just now/)).toBeTruthy();
    expect(screen.getByText("200")).toBeTruthy();
  });

  it("does not repeat the action label or target above a summary that already says both", async () => {
    renderWithProviders(<ActivityScreen />, { withAuth: true });
    await waitFor(() => expect(screen.getByText("Cancelled REF001 at Resto A")).toBeTruthy());
    expect(screen.queryByText("Cancelled booking")).toBeNull();
    expect(screen.queryByText("REF001")).toBeNull();
  });

  it("still announces the action category to a screen reader when the summary is what shows", async () => {
    renderWithProviders(<ActivityScreen />, { withAuth: true });
    await waitFor(() => expect(screen.getByText("Cancelled REF001 at Resto A")).toBeTruthy());
    const label = screen.getAllByTestId("activity-row")[0].props.accessibilityLabel;
    expect(label).toContain("Cancelled booking");
    expect(label).toContain("Cancelled REF001 at Resto A");
  });

  it("falls back to the action label, then the target, when there is no summary", async () => {
    mockGetAuditEntries.mockResolvedValue(
      page([entry({ action: "auth.login", summary: null, targetLabel: "owner@test.com" })])
    );
    renderWithProviders(<ActivityScreen />, { withAuth: true });
    await waitFor(() => expect(screen.getByText("Signed in")).toBeTruthy());
    expect(screen.getByText("owner@test.com")).toBeTruthy();
  });

  it("pluralises the recorded-event count", async () => {
    mockGetAuditEntries.mockResolvedValue(page([entry(), entry({ id: 2 })]));
    renderWithProviders(<ActivityScreen />, { withAuth: true });
    await waitFor(() => expect(screen.getByText("2 recorded events")).toBeTruthy());
  });

  it("falls back to a zero count when the envelope omits totalCount", async () => {
    mockGetAuditEntries.mockResolvedValue({ items: [entry()] });
    renderWithProviders(<ActivityScreen />, { withAuth: true });
    await waitFor(() => expect(screen.getByText("0 recorded events")).toBeTruthy());
  });

  it("shows an error state when the request fails", async () => {
    mockGetAuditEntries.mockResolvedValue(null);
    renderWithProviders(<ActivityScreen />, { withAuth: true });
    await waitFor(() => expect(screen.getByText("Something went wrong")).toBeTruthy());
  });

  it("shows an empty state when nothing has been recorded", async () => {
    mockGetAuditEntries.mockResolvedValue(page([]));
    renderWithProviders(<ActivityScreen />, { withAuth: true });
    await waitFor(() => expect(screen.getByText("No activity yet")).toBeTruthy());
    expect(screen.getByText("Every admin action lands here as it happens.")).toBeTruthy();
  });

  it("says the filters are what emptied the list once one is applied", async () => {
    mockGetAuditEntries.mockResolvedValueOnce(page([entry()])).mockResolvedValueOnce(page([]));
    renderWithProviders(<ActivityScreen />, { withAuth: true });
    await waitFor(() => expect(screen.getByText("Bookings")).toBeTruthy());
    fireEvent.press(screen.getByText("Bookings"));
    await waitFor(() => expect(screen.getByText("Nothing matches these filters")).toBeTruthy());
    expect(screen.getByText("Try a wider location, activity type or person.")).toBeTruthy();
  });

  it("refetches with the action prefix when an activity-type pill is pressed", async () => {
    renderWithProviders(<ActivityScreen />, { withAuth: true });
    await waitFor(() => expect(screen.getByText("Sign-ins")).toBeTruthy());
    fireEvent.press(screen.getByText("Sign-ins"));
    await waitFor(() =>
      expect(mockGetAuditEntries).toHaveBeenCalledWith(expect.objectContaining({ action: "auth" }))
    );
  });

  it("refetches for one location when its pill is pressed", async () => {
    mockFetchRestaurants.mockResolvedValue([
      { id: 1, name: "Resto A" },
      { id: 2, name: "Resto B" },
    ]);
    renderWithProviders(<ActivityScreen />, { withAuth: true });
    await waitFor(() => expect(screen.getByText("Resto B")).toBeTruthy());
    fireEvent.press(screen.getByText("Resto B"));
    await waitFor(() =>
      expect(mockGetAuditEntries).toHaveBeenCalledWith(expect.objectContaining({ restaurantId: 2 }))
    );
  });

  it("refetches for one actor when their pill is pressed", async () => {
    mockAdminListUsers.mockResolvedValue([
      { id: 7, email: "sam@test.com", displayName: null, role: "Manager", isActive: true },
    ]);
    renderWithProviders(<ActivityScreen />, { withAuth: true });
    await waitFor(() => expect(screen.getByText("sam@test.com")).toBeTruthy());
    fireEvent.press(screen.getByText("sam@test.com"));
    await waitFor(() =>
      expect(mockGetAuditEntries).toHaveBeenCalledWith(expect.objectContaining({ actorUserId: 7 }))
    );
  });

  it("clears a filter again when the catch-all pill is pressed", async () => {
    renderWithProviders(<ActivityScreen />, { withAuth: true });
    await waitFor(() => expect(screen.getByText("Bookings")).toBeTruthy());
    fireEvent.press(screen.getByText("Bookings"));
    await waitFor(() =>
      expect(mockGetAuditEntries).toHaveBeenCalledWith(
        expect.objectContaining({ action: "booking" })
      )
    );
    fireEvent.press(screen.getByText("All activity"));
    fireEvent.press(screen.getByText("All locations"));
    fireEvent.press(screen.getByText("Anyone"));
    await waitFor(() =>
      expect(mockGetAuditEntries).toHaveBeenLastCalledWith(
        expect.objectContaining({ action: undefined, restaurantId: undefined })
      )
    );
  });

  it("leaves the actor pills alone when the user list cannot be read", async () => {
    mockAdminListUsers.mockResolvedValue(null);
    renderWithProviders(<ActivityScreen />, { withAuth: true });
    await waitFor(() => expect(screen.getByText("Anyone")).toBeTruthy());
    expect(screen.queryByText("Dana")).toBeNull();
  });

  it("appends the next page when Show more is pressed", async () => {
    mockGetAuditEntries
      .mockResolvedValueOnce(page([entry()], 26))
      .mockResolvedValueOnce(page([entry({ id: 2, summary: "Created REF002" })], 26));
    renderWithProviders(<ActivityScreen />, { withAuth: true });
    await waitFor(() => expect(screen.getByText("Show 25 more")).toBeTruthy());
    fireEvent.press(screen.getByText("Show 25 more"));
    await waitFor(() =>
      expect(mockGetAuditEntries).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }))
    );
    await waitFor(() => expect(screen.getByText("Created REF002")).toBeTruthy());
  });

  it("expands a row to its changes and the raw request, and collapses it again", async () => {
    mockGetAuditEntries.mockResolvedValue(
      page([
        entry({
          changes: [
            { field: "seats", before: "2", after: "4" },
            { field: "notes", before: null, after: "" },
          ],
        }),
      ])
    );
    renderWithProviders(<ActivityScreen />, { withAuth: true });
    await waitFor(() => expect(screen.getAllByTestId("activity-row")[0]).toBeTruthy());
    expect(screen.queryByTestId("activity-detail-1")).toBeNull();

    fireEvent.press(screen.getAllByTestId("activity-row")[0]);
    await waitFor(() => expect(screen.getByTestId("activity-detail-1")).toBeTruthy());
    expect(screen.getByText("seats")).toBeTruthy();
    expect(screen.getByText("2")).toBeTruthy();
    expect(screen.getByText("4")).toBeTruthy();
    expect(screen.getByText("—")).toBeTruthy();
    expect(screen.getByText("(empty)")).toBeTruthy();
    expect(screen.getByText("POST /api/admin/bookings/42/cancel → 200")).toBeTruthy();
    expect(screen.getByText("IP 10.0.0.4")).toBeTruthy();
    expect(screen.getByText("Mozilla/5.0")).toBeTruthy();

    fireEvent.press(screen.getAllByTestId("activity-row")[0]);
    await waitFor(() => expect(screen.queryByTestId("activity-detail-1")).toBeNull());
  });

  it("renders a masked value as-is rather than hiding the row", async () => {
    mockGetAuditEntries.mockResolvedValue(
      page([
        entry({
          action: "email_settings.update",
          summary: "Updated the SMTP credentials",
          changes: [{ field: "smtpPassword", before: REDACTED_MARKER, after: REDACTED_MARKER }],
        }),
      ])
    );
    renderWithProviders(<ActivityScreen />, { withAuth: true });
    await waitFor(() => expect(screen.getByText("Updated the SMTP credentials")).toBeTruthy());
    fireEvent.press(screen.getAllByTestId("activity-row")[0]);
    await waitFor(() => expect(screen.getAllByText("[redacted]")).toHaveLength(2));
    expect(screen.getByText("smtpPassword")).toBeTruthy();
  });

  it("shows the request line on a row the middleware floor recorded with nothing else", async () => {
    mockGetAuditEntries.mockResolvedValue(
      page([
        entry({
          action: "http.post",
          targetLabel: null,
          summary: null,
          ipAddress: null,
          userAgent: null,
          statusCode: 403,
        }),
      ])
    );
    renderWithProviders(<ActivityScreen />, { withAuth: true });
    await waitFor(() => expect(screen.getByText("POST request")).toBeTruthy());
    // The path is the only thing that distinguishes this row, so it shows while collapsed.
    expect(screen.getByText("POST /api/admin/bookings/42/cancel → 403")).toBeTruthy();
    expect(screen.getByText("403")).toBeTruthy();

    fireEvent.press(screen.getAllByTestId("activity-row")[0]);
    await waitFor(() => expect(screen.getByText("IP unknown")).toBeTruthy());
    expect(screen.getAllByText("POST /api/admin/bookings/42/cancel → 403")).toHaveLength(2);
    expect(screen.queryByText("Mozilla/5.0")).toBeNull();
  });

  it("only expands the row that was pressed", async () => {
    mockGetAuditEntries.mockResolvedValue(page([entry(), entry({ id: 2 })]));
    renderWithProviders(<ActivityScreen />, { withAuth: true });
    await waitFor(() => expect(screen.getAllByTestId("activity-row")[1]).toBeTruthy());
    fireEvent.press(screen.getAllByTestId("activity-row")[1]);
    await waitFor(() => expect(screen.getByTestId("activity-detail-2")).toBeTruthy());
    expect(screen.queryByTestId("activity-detail-1")).toBeNull();
  });

  it("honours a persisted filter on mount", async () => {
    localStorage.setItem("activity:action", JSON.stringify("auth"));
    renderWithProviders(<ActivityScreen />, { withAuth: true });
    await waitFor(() => expect(mockGetAuditEntries).toHaveBeenCalled());
    expect(mockGetAuditEntries.mock.calls[0][0].action).toBe("auth");
  });

  it("renders the native stack title off web", async () => {
    Object.defineProperty(Platform, "OS", { value: "ios", configurable: true });
    renderWithProviders(<ActivityScreen />, { withAuth: true });
    await waitFor(() => expect(screen.getByText("Activity")).toBeTruthy());
  });
});
