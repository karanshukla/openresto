import { editableRowStyles } from "@/components/admin/settings/EditableRow.styles";

describe("EditableRow.styles", () => {
  it("exports editableRowStyles with expected shape", () => {
    expect(editableRowStyles).toBeDefined();
    expect(editableRowStyles.editableRow).toBeDefined();
    expect(editableRowStyles.rowActions).toBeDefined();
    expect(editableRowStyles.smallBtn).toBeDefined();
    expect(editableRowStyles.editableValue).toBeDefined();
    expect(editableRowStyles.editableInput).toBeDefined();
  });
});
