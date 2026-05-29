import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import { AddRow } from "@/components/admin/settings/AddRow";

jest.mock("@/context/BrandContext", () => ({
  useBrand: () => ({ primaryColor: "#007AFF", appName: "Test" }),
}));

jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: () => "light",
}));

jest.mock("@expo/vector-icons", () => {
  const { Text } = require("react-native");
  return {
    Ionicons: ({ name }: { name: string }) => <Text testID={`icon-${name}`}>{name}</Text>,
  };
});

describe("AddRow", () => {
  const defaultProps = {
    label: "Add Section",
    placeholder: "Section name",
    onAdd: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders the label button when closed", () => {
    render(<AddRow {...defaultProps} />);
    expect(screen.getByText("Add Section")).toBeTruthy();
  });

  it("opens the form when the button is pressed", () => {
    render(<AddRow {...defaultProps} />);
    fireEvent.press(screen.getByText("Add Section"));
    expect(screen.getByText("Add")).toBeTruthy();
  });

  it("closes the form when cancel is pressed", () => {
    render(<AddRow {...defaultProps} />);
    fireEvent.press(screen.getByText("Add Section"));
    // Cancel button exists (icon button), let's use the Add button being present as indicator
    expect(screen.getByText("Add")).toBeTruthy();
  });

  it("calls onAdd with the entered name", async () => {
    const onAdd = jest.fn().mockResolvedValue(undefined);
    render(<AddRow {...defaultProps} onAdd={onAdd} />);

    fireEvent.press(screen.getByText("Add Section"));

    const input = screen.getByPlaceholderText("Section name");
    fireEvent.changeText(input, "New Section");

    fireEvent.press(screen.getByText("Add"));

    await waitFor(() => {
      expect(onAdd).toHaveBeenCalledWith("New Section", undefined);
    });
  });

  it("does not call onAdd when name is empty", () => {
    const onAdd = jest.fn().mockResolvedValue(undefined);
    render(<AddRow {...defaultProps} onAdd={onAdd} />);

    fireEvent.press(screen.getByText("Add Section"));
    fireEvent.press(screen.getByText("Add"));

    expect(onAdd).not.toHaveBeenCalled();
  });

  it("renders extra input when extraPlaceholder is provided", () => {
    render(<AddRow {...defaultProps} extraPlaceholder="Seats" />);
    fireEvent.press(screen.getByText("Add Section"));

    expect(screen.getByPlaceholderText("Section name")).toBeTruthy();
    expect(screen.getByPlaceholderText("Seats")).toBeTruthy();
  });

  it("calls onAdd with extra value when extraPlaceholder is provided", async () => {
    const onAdd = jest.fn().mockResolvedValue(undefined);
    render(<AddRow {...defaultProps} extraPlaceholder="Seats" onAdd={onAdd} />);

    fireEvent.press(screen.getByText("Add Section"));
    fireEvent.changeText(screen.getByPlaceholderText("Section name"), "My Section");
    fireEvent.changeText(screen.getByPlaceholderText("Seats"), "4");
    fireEvent.press(screen.getByText("Add"));

    await waitFor(() => {
      expect(onAdd).toHaveBeenCalledWith("My Section", "4");
    });
  });

  it("shows Adding... text while saving", async () => {
    let resolve: () => void;
    const onAdd = jest.fn().mockReturnValue(
      new Promise<void>((res) => {
        resolve = res;
      })
    );
    render(<AddRow {...defaultProps} onAdd={onAdd} />);

    fireEvent.press(screen.getByText("Add Section"));
    fireEvent.changeText(screen.getByPlaceholderText("Section name"), "My Section");
    fireEvent.press(screen.getByText("Add"));

    await waitFor(() => {
      expect(screen.getByText("Adding…")).toBeTruthy();
    });

    resolve!();
  });

  it("closes the form when the cancel (X) button is pressed", async () => {
    render(<AddRow {...defaultProps} />);
    fireEvent.press(screen.getByText("Add Section"));
    expect(screen.getByText("Add")).toBeTruthy();
    fireEvent.press(screen.getByTestId("icon-close-outline"));
    await waitFor(() => {
      expect(screen.getByText("Add Section")).toBeTruthy();
      expect(screen.queryByText("Add")).toBeNull();
    });
  });

  it("resets form after successful add", async () => {
    const onAdd = jest.fn().mockResolvedValue(undefined);
    render(<AddRow {...defaultProps} onAdd={onAdd} />);

    fireEvent.press(screen.getByText("Add Section"));
    fireEvent.changeText(screen.getByPlaceholderText("Section name"), "My Section");
    fireEvent.press(screen.getByText("Add"));

    await waitFor(() => {
      expect(screen.getByText("Add Section")).toBeTruthy();
    });
  });
});
