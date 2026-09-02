import { act, renderHook, waitFor } from "@testing-library/react-native";
import { useBookingReminder } from "@/hooks/use-booking-reminder";
import { canRegisterForReminders, registerForReminders } from "@/services/pushRegistration";
import { subscribeReminder, unsubscribeReminder } from "@/api/reminders";
import { forgetReminder, rememberReminder, reminderEndpointFor } from "@/utils/reminderRegistry";

jest.mock("@/services/pushRegistration", () => ({
  canRegisterForReminders: jest.fn(),
  registerForReminders: jest.fn(),
}));
jest.mock("@/api/reminders", () => ({
  subscribeReminder: jest.fn(),
  unsubscribeReminder: jest.fn(),
}));
jest.mock("@/utils/reminderRegistry", () => ({
  reminderEndpointFor: jest.fn(),
  rememberReminder: jest.fn(),
  forgetReminder: jest.fn(),
}));
jest.mock("@/context/BrandContext", () => ({
  useBrand: () => ({ appName: "Open Resto", primaryColor: "#000", webPushPublicKey: "KEY" }),
}));
jest.mock("@/context/LocaleContext", () => ({
  useLocale: () => ({ locale: "fr", setLocale: jest.fn() }),
}));

const can = canRegisterForReminders as jest.Mock;
const register = registerForReminders as jest.Mock;
const subscribe = subscribeReminder as jest.Mock;
const unsubscribe = unsubscribeReminder as jest.Mock;
const endpointFor = reminderEndpointFor as jest.Mock;

const REG = { channel: "expo", endpoint: "ExponentPushToken[1]" };

beforeEach(() => {
  jest.clearAllMocks();
  can.mockReturnValue(true);
  endpointFor.mockReturnValue(null);
});

describe("useBookingReminder", () => {
  it("is unsupported where this device cannot register, and never prompts", () => {
    can.mockReturnValue(false);
    const { result } = renderHook(() => useBookingReminder("ref-1", "x@y.z"));
    expect(result.current.status).toBe("unsupported");
    expect(can).toHaveBeenCalledWith({ webPushPublicKey: "KEY" });
  });

  it("reads as on when this device already remembered the booking", () => {
    endpointFor.mockReturnValue("ExponentPushToken[1]");
    const { result } = renderHook(() => useBookingReminder("ref-1", "x@y.z"));
    expect(result.current.status).toBe("on");
  });

  it("re-reads the device's memory when the booking changes", async () => {
    endpointFor.mockImplementation((ref: string) => (ref === "ref-2" ? "tok" : null));
    const { result, rerender } = renderHook(
      (props: { ref: string }) => useBookingReminder(props.ref, "x@y.z"),
      { initialProps: { ref: "ref-1" } }
    );
    expect(result.current.status).toBe("off");
    rerender({ ref: "ref-2" });
    await waitFor(() => expect(result.current.status).toBe("on"));
  });

  it("registers, subscribes in the active locale, remembers, and turns on", async () => {
    register.mockResolvedValue({ status: "registered", registration: REG });
    subscribe.mockResolvedValue(true);
    const { result } = renderHook(() => useBookingReminder("ref-1", "x@y.z"));

    await act(() => result.current.enable());

    expect(subscribe).toHaveBeenCalledWith("ref-1", "x@y.z", REG, "fr");
    expect(rememberReminder).toHaveBeenCalledWith("ref-1", "ExponentPushToken[1]");
    expect(result.current.status).toBe("on");
  });

  it("reports denied when the OS prompt is refused, and unsupported when nothing can register", async () => {
    register.mockResolvedValueOnce({ status: "denied" });
    const { result } = renderHook(() => useBookingReminder("ref-1", "x@y.z"));
    await act(() => result.current.enable());
    expect(result.current.status).toBe("denied");
    expect(subscribe).not.toHaveBeenCalled();

    register.mockResolvedValueOnce({ status: "unsupported" });
    await act(() => result.current.enable());
    expect(result.current.status).toBe("unsupported");
  });

  it("reports an error and remembers nothing when the server refuses", async () => {
    register.mockResolvedValue({ status: "registered", registration: REG });
    subscribe.mockResolvedValue(false);
    const { result } = renderHook(() => useBookingReminder("ref-1", "x@y.z"));

    await act(() => result.current.enable());

    expect(result.current.status).toBe("error");
    expect(rememberReminder).not.toHaveBeenCalled();
  });

  it("forgets the device first and then tells the server when turning off", async () => {
    endpointFor.mockReturnValue("ExponentPushToken[1]");
    unsubscribe.mockResolvedValue(true);
    const { result } = renderHook(() => useBookingReminder("ref-1", "x@y.z"));

    await act(() => result.current.disable());

    expect(forgetReminder).toHaveBeenCalledWith("ref-1");
    expect(unsubscribe).toHaveBeenCalledWith("ref-1", "x@y.z", "ExponentPushToken[1]");
    expect(result.current.status).toBe("off");
  });

  it("turns off cleanly even when the device has no remembered address", async () => {
    const { result } = renderHook(() => useBookingReminder("ref-1", "x@y.z"));
    await act(() => result.current.disable());
    expect(unsubscribe).not.toHaveBeenCalled();
    expect(result.current.status).toBe("off");
  });
});
