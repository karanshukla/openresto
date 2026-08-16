/**
 * @jest-environment jsdom
 */
import React from "react";
import { screen, fireEvent } from "@testing-library/react-native";
import { Text } from "react-native";
import { DeleteLocationModal } from "@/components/admin/locations/DeleteLocationModal";
import { renderWithProviders } from "@/tests/helpers/renderWithProviders";
import type { RestaurantDeletePreview } from "@/api/admin";

const preview = (over: Partial<RestaurantDeletePreview> = {}): RestaurantDeletePreview => ({
  id: 1,
  name: "Downtown",
  isArchived: true,
  sectionCount: 1,
  tableCount: 1,
  tableGroupCount: 0,
  bookingCount: 1,
  upcomingBookingCount: 0,
  ...over,
});

const renderModal = (props: Partial<React.ComponentProps<typeof DeleteLocationModal>> = {}) =>
  renderWithProviders(
    <DeleteLocationModal
      visible
      name="Downtown"
      preview={preview()}
      loadingPreview={false}
      deleting={false}
      failed={false}
      onCancel={jest.fn()}
      onConfirm={jest.fn()}
      {...props}
    />
  );

describe("DeleteLocationModal", () => {
  it("singularises the impact counts", () => {
    renderModal();
    expect(screen.getByText("1 section")).toBeTruthy();
    expect(screen.getByText("1 table")).toBeTruthy();
    expect(screen.getByText("1 booking")).toBeTruthy();
  });

  it("omits combinable groups when the location has none", () => {
    renderModal();
    expect(screen.queryByText(/combinable group/)).toBeNull();
  });

  it("lists combinable groups when the location has them", () => {
    renderModal({ preview: preview({ tableGroupCount: 2 }) });
    expect(screen.getByText("2 combinable groups")).toBeTruthy();
  });

  it("shows a spinner while the preflight is in flight", () => {
    renderModal({ preview: null, loadingPreview: true });
    expect(screen.getByLabelText("Loading impact")).toBeTruthy();
    expect(screen.queryByText(/section/)).toBeNull();
  });

  it("still allows deletion when the preflight failed", () => {
    const onConfirm = jest.fn();
    renderModal({ preview: null, loadingPreview: false, onConfirm });
    expect(screen.getByText(/Could not load what this would delete/)).toBeTruthy();
    fireEvent.changeText(screen.getByTestId("delete-location-name-input"), "Downtown");
    fireEvent.press(screen.getByText("Delete permanently"));
    expect(onConfirm).toHaveBeenCalled();
  });

  it("ignores a name that does not match", () => {
    const onConfirm = jest.fn();
    renderModal({ onConfirm });
    fireEvent.changeText(screen.getByTestId("delete-location-name-input"), "Downtow");
    fireEvent.press(screen.getByText("Delete permanently"));
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("clears a typed name when reopened", () => {
    // Closing and reopening must not leave a previously typed name in the box, or the second
    // visit would arrive already unlocked.
    function Harness() {
      const [visible, setVisible] = React.useState(true);
      return (
        <>
          <DeleteLocationModal
            visible={visible}
            name="Downtown"
            preview={preview()}
            loadingPreview={false}
            deleting={false}
            failed={false}
            onCancel={() => setVisible(false)}
            onConfirm={jest.fn()}
          />
          <Text onPress={() => setVisible(true)}>reopen</Text>
        </>
      );
    }
    renderWithProviders(<Harness />);
    fireEvent.changeText(screen.getByTestId("delete-location-name-input"), "Downtown");
    fireEvent.press(screen.getByText("Cancel"));
    fireEvent.press(screen.getByText("reopen"));
    expect(screen.getByTestId("delete-location-name-input").props.value).toBe("");
  });

  it("blocks both buttons while the delete is in flight", () => {
    const onCancel = jest.fn();
    const onConfirm = jest.fn();
    renderModal({ deleting: true, onCancel, onConfirm });
    expect(screen.getByText("Deleting…")).toBeTruthy();
    fireEvent.press(screen.getByText("Cancel"));
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("cancels on request", () => {
    const onCancel = jest.fn();
    renderModal({ onCancel });
    fireEvent.press(screen.getByText("Cancel"));
    expect(onCancel).toHaveBeenCalled();
  });

  it("reports a failed delete", () => {
    renderModal({ failed: true });
    expect(screen.getByText("Failed to delete. Please try again.")).toBeTruthy();
  });
});
