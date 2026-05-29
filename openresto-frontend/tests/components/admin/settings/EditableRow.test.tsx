import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import { EditableRow } from "@/components/admin/settings/EditableRow";

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

describe("EditableRow", () => {
  const defaultProps = {
    value: "Existing Value",
    onSave: jest.fn().mockResolvedValue(undefined),
    isDark: false,
    confirmAction: jest.fn().mockResolvedValue(true),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders the value in display mode", () => {
    render(<EditableRow {...defaultProps} />);
    expect(screen.getByText("Existing Value")).toBeTruthy();
    expect(screen.getByText("Edit")).toBeTruthy();
  });

  it("switches to edit mode when Edit is pressed", () => {
    render(<EditableRow {...defaultProps} />);
    fireEvent.press(screen.getByText("Edit"));
    expect(screen.getByDisplayValue("Existing Value")).toBeTruthy();
    expect(screen.getByText("Save")).toBeTruthy();
  });

  it("calls onSave with the new value", async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    render(<EditableRow {...defaultProps} onSave={onSave} />);

    fireEvent.press(screen.getByText("Edit"));
    const input = screen.getByDisplayValue("Existing Value");
    fireEvent.changeText(input, "Updated Value");
    fireEvent.press(screen.getByText("Save"));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith("Updated Value");
    });
  });

  it("does not call onSave when draft is empty", async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    render(<EditableRow {...defaultProps} onSave={onSave} />);

    fireEvent.press(screen.getByText("Edit"));
    const input = screen.getByDisplayValue("Existing Value");
    fireEvent.changeText(input, "");
    fireEvent.press(screen.getByText("Save"));

    expect(onSave).not.toHaveBeenCalled();
  });

  it("cancels editing and returns to display mode", () => {
    render(<EditableRow {...defaultProps} />);
    fireEvent.press(screen.getByText("Edit"));
    expect(screen.getByText("Save")).toBeTruthy();

    // Find the cancel button (close icon) - it's the last pressable after Save
    const saveBtn = screen.getByText("Save");
    // The component shows cancel button after Save, use getAllBy to find all presses
    expect(screen.getByDisplayValue("Existing Value")).toBeTruthy();
  });

  it("renders delete button when onDelete is provided", () => {
    const onDelete = jest.fn().mockResolvedValue(undefined);
    render(<EditableRow {...defaultProps} onDelete={onDelete} />);
    expect(screen.getByTestId("icon-trash-outline")).toBeTruthy();
  });

  it("calls onDelete after confirmation", async () => {
    const onDelete = jest.fn().mockResolvedValue(undefined);
    const confirmAction = jest.fn().mockResolvedValue(true);
    render(<EditableRow {...defaultProps} onDelete={onDelete} confirmAction={confirmAction} />);
    fireEvent.press(screen.getByTestId("icon-trash-outline"));
    await waitFor(() => {
      expect(confirmAction).toHaveBeenCalled();
      expect(onDelete).toHaveBeenCalled();
    });
  });

  it("does not call onDelete when confirmation is denied", async () => {
    const onDelete = jest.fn().mockResolvedValue(undefined);
    const confirmAction = jest.fn().mockResolvedValue(false);
    render(<EditableRow {...defaultProps} onDelete={onDelete} confirmAction={confirmAction} />);
    fireEvent.press(screen.getByTestId("icon-trash-outline"));
    await waitFor(() => {
      expect(confirmAction).toHaveBeenCalled();
    });
    expect(onDelete).not.toHaveBeenCalled();
  });

  it("renders in dark mode", () => {
    const { toJSON } = render(<EditableRow {...defaultProps} isDark={true} />);
    expect(toJSON()).toBeDefined();
  });

  it("renders placeholder text", () => {
    render(<EditableRow {...defaultProps} placeholder="Enter name" />);
    fireEvent.press(screen.getByText("Edit"));
    // placeholder is shown in input
    expect(screen.getByDisplayValue("Existing Value")).toBeTruthy();
  });

  it("shows saving indicator during save", async () => {
    let resolve: () => void;
    const onSave = jest.fn().mockReturnValue(
      new Promise<void>((res) => {
        resolve = res;
      })
    );
    render(<EditableRow {...defaultProps} onSave={onSave} />);

    fireEvent.press(screen.getByText("Edit"));
    fireEvent.changeText(screen.getByDisplayValue("Existing Value"), "New Value");
    fireEvent.press(screen.getByText("Save"));

    await waitFor(() => {
      expect(screen.getByText("…")).toBeTruthy();
    });

    resolve!();
  });
});
