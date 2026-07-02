import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react-native";
import { NewBookingModal } from "@/components/admin/bookings/NewBookingModal";
import * as restaurantsApi from "@/api/restaurants";
import * as adminApi from "@/api/admin";

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

jest.mock("@/api/restaurants", () => ({
  fetchRestaurants: jest.fn(),
}));

jest.mock("@/api/admin", () => ({
  adminCreateBooking: jest.fn(),
}));

jest.mock("@/context/BrandContext", () => {
  const brand = { primaryColor: "#0a7ea4", appName: "Open Resto" };
  return { useBrand: () => brand };
});

jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: () => "light",
}));

jest.mock("@/components/common/Select", () => {
  const { View, Text, Pressable } = require("react-native");
  return {
    __esModule: true,
    default: ({
      onSelect,
      options,
    }: {
      onSelect: (v: string | number) => void;
      options: { label: string; value: string | number }[];
    }) => (
      <View testID="mock-select">
        {options.map((o) => (
          <Pressable key={String(o.value)} onPress={() => onSelect(o.value)}>
            <Text>{o.label}</Text>
          </Pressable>
        ))}
      </View>
    ),
  };
});

jest.mock("@/components/common/DatePicker", () => {
  const { View, Text, Pressable } = require("react-native");
  return {
    __esModule: true,
    default: ({
      selectedDate,
      onSelect,
      allowPast,
    }: {
      selectedDate?: string;
      onSelect: (v: string) => void;
      allowPast?: boolean;
    }) => (
      <View>
        <Text testID="date-picker">{selectedDate ?? "no date"}</Text>
        <Text testID="date-picker-allowpast">{allowPast ? "true" : "false"}</Text>
        <Pressable
          testID="date-picker-past"
          onPress={() => {
            const d = new Date();
            d.setDate(d.getDate() - 7);
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, "0");
            const day = String(d.getDate()).padStart(2, "0");
            onSelect(`${y}-${m}-${day}`);
          }}
        >
          <Text>Select Past Date</Text>
        </Pressable>
      </View>
    ),
  };
});

jest.mock("@/components/common/TimePicker", () => {
  const { View, Text } = require("react-native");
  return {
    __esModule: true,
    default: ({ selectedTime }: { selectedTime?: string }) => (
      <View>
        <Text testID="time-picker">{selectedTime ?? "no time"}</Text>
      </View>
    ),
  };
});

jest.mock("@/components/common/ConfirmModal", () => {
  const { View, Pressable, Text } = require("react-native");
  return {
    __esModule: true,
    default: ({ visible, message, onConfirm, onCancel }: any) =>
      visible ? (
        <View>
          <Text testID="confirm-message">{message}</Text>
          <Pressable testID="confirm-ok" onPress={onConfirm}>
            <Text>Book Anyway</Text>
          </Pressable>
          <Pressable testID="confirm-cancel" onPress={onCancel}>
            <Text>Go Back</Text>
          </Pressable>
        </View>
      ) : null,
  };
});

jest.mock("@/components/common/Button", () => {
  const { Pressable, Text } = require("react-native");
  return {
    __esModule: true,
    default: ({ onPress, children, disabled }: any) => (
      <Pressable onPress={onPress} disabled={disabled}>
        <Text>{children}</Text>
      </Pressable>
    ),
  };
});

const mockRestaurants = [
  {
    id: 1,
    name: "Test Restaurant",
    openTime: "09:00",
    closeTime: "22:00",
    openDays: "1,2,3,4,5",
    address: "123 Street",
    timezone: "UTC",
    tags: [],
    sections: [
      {
        id: 10,
        name: "Main",
        tables: [
          { id: 100, name: "Table 1", seats: 4 },
          { id: 101, name: "Table 2", seats: 2 },
        ],
      },
    ],
  },
];

describe("NewBookingModal", () => {
  const onClose = jest.fn();
  const onCreated = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (restaurantsApi.fetchRestaurants as jest.Mock).mockResolvedValue(mockRestaurants);
  });

  it("does not render content when visible is false", () => {
    render(<NewBookingModal visible={false} onClose={onClose} onCreated={onCreated} />);
    expect(screen.queryByText("New Booking")).toBeNull();
  });

  it("renders New Booking title when visible", async () => {
    render(<NewBookingModal visible onClose={onClose} onCreated={onCreated} />);
    await waitFor(() => {
      expect(screen.getByText("New Booking")).toBeTruthy();
    });
  });

  it("shows loading indicator while fetching restaurants", async () => {
    let resolveRestaurants: (v: typeof mockRestaurants) => void;
    (restaurantsApi.fetchRestaurants as jest.Mock).mockReturnValue(
      new Promise((r) => {
        resolveRestaurants = r;
      })
    );
    render(<NewBookingModal visible onClose={onClose} onCreated={onCreated} />);
    expect(screen.getByText("New Booking")).toBeTruthy();
    await act(async () => {
      resolveRestaurants!(mockRestaurants);
    });
  });

  it("shows restaurant options after loading", async () => {
    render(<NewBookingModal visible onClose={onClose} onCreated={onCreated} />);
    await waitFor(() => {
      expect(screen.getByText("Test Restaurant")).toBeTruthy();
    });
  });

  it("calls onClose when close button is pressed", async () => {
    render(<NewBookingModal visible onClose={onClose} onCreated={onCreated} />);
    await waitFor(() => expect(screen.getByText("New Booking")).toBeTruthy());
    const accessible = screen.UNSAFE_getAllByProps({ accessible: true });
    // Close button is typically the first accessible element (X icon)
    fireEvent.press(accessible[0]);
    expect(onClose).toHaveBeenCalled();
  });

  it("shows guest email input field", async () => {
    render(<NewBookingModal visible onClose={onClose} onCreated={onCreated} />);
    await waitFor(() => {
      expect(screen.getByPlaceholderText("guest@example.com")).toBeTruthy();
    });
  });

  it("handles restaurant change", async () => {
    render(<NewBookingModal visible onClose={onClose} onCreated={onCreated} />);
    await waitFor(() => expect(screen.getByText("Test Restaurant")).toBeTruthy());
    fireEvent.press(screen.getByText("Test Restaurant"));
    expect(screen.getByText("New Booking")).toBeTruthy();
  });

  it("handles section change", async () => {
    render(<NewBookingModal visible onClose={onClose} onCreated={onCreated} />);
    await waitFor(() => expect(screen.getByText("Main")).toBeTruthy());
    fireEvent.press(screen.getByText("Main"));
    expect(screen.getByText("New Booking")).toBeTruthy();
  });

  it("creates booking successfully", async () => {
    (adminApi.adminCreateBooking as jest.Mock).mockResolvedValue({ id: 42 });
    render(<NewBookingModal visible onClose={onClose} onCreated={onCreated} />);
    await waitFor(() => expect(screen.getByPlaceholderText("guest@example.com")).toBeTruthy());
    fireEvent.changeText(screen.getByPlaceholderText("guest@example.com"), "test@example.com");
    await act(async () => {
      fireEvent.press(screen.getByText("Create Booking"));
    });
    await waitFor(() => {
      expect(onCreated).toHaveBeenCalledWith(42);
      expect(onClose).toHaveBeenCalled();
    });
  });

  it("shows error when adminCreateBooking throws", async () => {
    (adminApi.adminCreateBooking as jest.Mock).mockRejectedValue(new Error("Booking failed"));
    render(<NewBookingModal visible onClose={onClose} onCreated={onCreated} />);
    await waitFor(() => expect(screen.getByPlaceholderText("guest@example.com")).toBeTruthy());
    fireEvent.changeText(screen.getByPlaceholderText("guest@example.com"), "test@example.com");
    await act(async () => {
      fireEvent.press(screen.getByText("Create Booking"));
    });
    await waitFor(() => {
      expect(screen.getByText("Booking failed")).toBeTruthy();
    });
  });

  it("shows capacity warning when seats exceed table capacity", async () => {
    render(<NewBookingModal visible onClose={onClose} onCreated={onCreated} />);
    await waitFor(() => expect(screen.getByPlaceholderText("guest@example.com")).toBeTruthy());
    fireEvent.press(screen.getByText("5 guests"));
    fireEvent.changeText(screen.getByPlaceholderText("guest@example.com"), "test@example.com");
    await act(async () => {
      fireEvent.press(screen.getByText("Create Booking"));
    });
    await waitFor(() => {
      expect(screen.getByText("Book Anyway")).toBeTruthy();
    });
    const message = screen.getByTestId("confirm-message").props.children as string;
    expect(message).toContain("5");
  });

  it("proceeds to book when capacity warning is confirmed", async () => {
    (adminApi.adminCreateBooking as jest.Mock).mockResolvedValue({ id: 99 });
    render(<NewBookingModal visible onClose={onClose} onCreated={onCreated} />);
    await waitFor(() => expect(screen.getByPlaceholderText("guest@example.com")).toBeTruthy());
    fireEvent.press(screen.getByText("5 guests"));
    fireEvent.changeText(screen.getByPlaceholderText("guest@example.com"), "test@example.com");
    await act(async () => {
      fireEvent.press(screen.getByText("Create Booking"));
    });
    await waitFor(() => expect(screen.getByTestId("confirm-ok")).toBeTruthy());
    await act(async () => {
      fireEvent.press(screen.getByTestId("confirm-ok"));
    });
    await waitFor(() => {
      expect(adminApi.adminCreateBooking).toHaveBeenCalled();
    });
  });

  it("cancels capacity warning when Go Back is pressed", async () => {
    render(<NewBookingModal visible onClose={onClose} onCreated={onCreated} />);
    await waitFor(() => expect(screen.getByPlaceholderText("guest@example.com")).toBeTruthy());
    fireEvent.press(screen.getByText("5 guests"));
    fireEvent.changeText(screen.getByPlaceholderText("guest@example.com"), "test@example.com");
    await act(async () => {
      fireEvent.press(screen.getByText("Create Booking"));
    });
    await waitFor(() => expect(screen.getByTestId("confirm-cancel")).toBeTruthy());
    fireEvent.press(screen.getByTestId("confirm-cancel"));
    await waitFor(() => {
      expect(screen.queryByText("Book Anyway")).toBeNull();
    });
  });

  it("resets state when modal closes", async () => {
    const { rerender } = render(
      <NewBookingModal visible onClose={onClose} onCreated={onCreated} />
    );
    await waitFor(() => expect(screen.getByPlaceholderText("guest@example.com")).toBeTruthy());
    fireEvent.changeText(screen.getByPlaceholderText("guest@example.com"), "test@example.com");
    rerender(<NewBookingModal visible={false} onClose={onClose} onCreated={onCreated} />);
    (restaurantsApi.fetchRestaurants as jest.Mock).mockResolvedValue(mockRestaurants);
    rerender(<NewBookingModal visible onClose={onClose} onCreated={onCreated} />);
    await waitFor(() => expect(screen.getByText("Test Restaurant")).toBeTruthy());
    expect(screen.getByPlaceholderText("guest@example.com").props.value).toBeFalsy();
  });

  it("opts in to past dates and creates a booking with a past date (#160)", async () => {
    (adminApi.adminCreateBooking as jest.Mock).mockResolvedValue({ id: 77 });
    render(<NewBookingModal visible onClose={onClose} onCreated={onCreated} />);
    await waitFor(() => expect(screen.getByPlaceholderText("guest@example.com")).toBeTruthy());

    // The admin modal must opt in to past dates on the shared DatePicker.
    expect(screen.getByTestId("date-picker-allowpast").props.children).toBe("true");

    // Select a date 7 days ago via the mocked picker.
    fireEvent.press(screen.getByTestId("date-picker-past"));
    fireEvent.changeText(screen.getByPlaceholderText("guest@example.com"), "test@example.com");

    await act(async () => {
      fireEvent.press(screen.getByText("Create Booking"));
    });
    await waitFor(() => expect(adminApi.adminCreateBooking).toHaveBeenCalled());

    const payload = (adminApi.adminCreateBooking as jest.Mock).mock.calls[0][0];
    // The submitted date is genuinely in the past.
    expect(new Date(payload.date).getTime()).toBeLessThan(Date.now());
    expect(onCreated).toHaveBeenCalledWith(77);
  });
});
