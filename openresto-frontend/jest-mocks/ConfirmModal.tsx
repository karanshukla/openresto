/**
 * Shared ConfirmModal mock. Extracted from the 3 identical inline copies in
 * lookup, booking-confirmation, and bookings-index screen tests.
 * (Bundle 13: Test Infrastructure & Fixtures.)
 *
 * Renders the visible state + confirm/cancel pressables so tests can drive the
 * modal via text. Matches the public props of the real ConfirmModal.
 */
const React = require("react");
const { View, Pressable, Text } = require("react-native");

function MockConfirmModal({
  visible,
  onConfirm,
  onCancel,
  message,
  confirmLabel,
  cancelLabel,
}: any) {
  if (!visible) return null;
  return (
    <View testID="confirm-modal">
      {message ? <Text>{message}</Text> : null}
      <Pressable onPress={onConfirm}>
        <Text>{confirmLabel || "Confirm"}</Text>
      </Pressable>
      <Pressable onPress={onCancel}>
        <Text>{cancelLabel || "Cancel"}</Text>
      </Pressable>
    </View>
  );
}

module.exports = MockConfirmModal;
module.exports.default = MockConfirmModal;
