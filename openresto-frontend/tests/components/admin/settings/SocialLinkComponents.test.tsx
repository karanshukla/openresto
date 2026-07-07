import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { SocialLinkEditForm, emptyEdit } from "@/components/admin/settings/SocialLinkEditForm";
import { SocialLinkRow } from "@/components/admin/settings/SocialLinkRow";
import type { AdminSocialLinkDto } from "@/api/admin";

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

jest.mock("@/components/common/Input", () => {
  const { TextInput } = require("react-native");
  return {
    __esModule: true,
    default: (props: any) => <TextInput {...props} />,
  };
});

const theme = {
  primaryColor: "#0a7ea4",
  cardBg: "#fff",
  borderColor: "#ddd",
  mutedColor: "#888",
  surface2: "#f9fafb",
  colors: { input: "#f0f0f0" } as any,
};

describe("SocialLinkEditForm", () => {
  const baseProps = {
    state: emptyEdit(0),
    onChange: jest.fn(),
    onSave: jest.fn(),
    onCancel: jest.fn(),
    saving: false,
    ...theme,
  };

  beforeEach(() => jest.clearAllMocks());

  it("renders the label and url placeholders", () => {
    render(<SocialLinkEditForm {...baseProps} />);
    expect(screen.getByPlaceholderText("e.g. Instagram, Yelp, Menu PDF")).toBeTruthy();
    expect(screen.getByPlaceholderText("https://instagram.com/yourresto")).toBeTruthy();
  });

  it("typing in the label field calls onChange with the new label", () => {
    render(<SocialLinkEditForm {...baseProps} />);
    fireEvent.changeText(
      screen.getByPlaceholderText("e.g. Instagram, Yelp, Menu PDF"),
      "Instagram"
    );
    expect(baseProps.onChange).toHaveBeenCalledWith(
      expect.objectContaining({ label: "Instagram" })
    );
  });

  it("cancel button calls onCancel", () => {
    render(<SocialLinkEditForm {...baseProps} />);
    fireEvent.press(screen.getByText("Cancel"));
    expect(baseProps.onCancel).toHaveBeenCalled();
  });

  it("save button calls onSave when label + url are present", () => {
    render(
      <SocialLinkEditForm
        {...baseProps}
        state={{
          label: "Insta",
          url: "https://instagram.com/x",
          iconKey: "logo-instagram",
          sortOrder: 0,
        }}
      />
    );
    fireEvent.press(screen.getByText("Save"));
    expect(baseProps.onSave).toHaveBeenCalled();
  });

  it("shows 'Saving…' label when saving is true", () => {
    render(
      <SocialLinkEditForm
        {...baseProps}
        saving={true}
        state={{
          label: "Insta",
          url: "https://instagram.com/x",
          iconKey: "logo-instagram",
          sortOrder: 0,
        }}
      />
    );
    expect(screen.getByText("Saving…")).toBeTruthy();
  });
});

describe("SocialLinkRow", () => {
  const link: AdminSocialLinkDto = {
    id: 1,
    label: "Instagram",
    url: "https://instagram.com/resto",
    iconKey: "logo-instagram",
    sortOrder: 0,
  };

  const baseProps = {
    link,
    onEdit: jest.fn(),
    onDelete: jest.fn(),
    ...theme,
  };

  beforeEach(() => jest.clearAllMocks());

  it("renders the link label and url", () => {
    render(<SocialLinkRow {...baseProps} />);
    expect(screen.getByText("Instagram")).toBeTruthy();
    expect(screen.getByText("https://instagram.com/resto")).toBeTruthy();
  });

  it("edit button fires onEdit with the link", () => {
    render(<SocialLinkRow {...baseProps} />);
    fireEvent.press(screen.getByLabelText("Edit Instagram"));
    expect(baseProps.onEdit).toHaveBeenCalledWith(link);
  });

  it("delete button fires onDelete with the id", () => {
    render(<SocialLinkRow {...baseProps} />);
    fireEvent.press(screen.getByLabelText("Delete Instagram"));
    expect(baseProps.onDelete).toHaveBeenCalledWith(1);
  });
});

describe("emptyEdit helper", () => {
  it("returns a blank edit state with the given sort order", () => {
    expect(emptyEdit(3)).toEqual({
      label: "",
      url: "",
      iconKey: "link-outline",
      sortOrder: 3,
    });
  });

  it("defaults sort order to 0", () => {
    expect(emptyEdit().sortOrder).toBe(0);
  });
});
