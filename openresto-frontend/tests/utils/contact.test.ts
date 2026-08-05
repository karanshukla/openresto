import { hasContact, mailtoHref, resolveContact, telHref } from "@/utils/contact";

describe("resolveContact", () => {
  it("prefers the location's own contact details", () => {
    expect(
      resolveContact(
        { phoneNumber: "+1 555 0100", emailAddress: "local@example.com" },
        { phoneNumber: "+44 20 7946 0958", emailAddress: "global@example.com" }
      )
    ).toEqual({ phone: "+1 555 0100", email: "local@example.com" });
  });

  it("falls back to the brand defaults when the location has none", () => {
    expect(
      resolveContact({}, { phoneNumber: "+44 20 7946 0958", emailAddress: "global@example.com" })
    ).toEqual({ phone: "+44 20 7946 0958", email: "global@example.com" });
  });

  it("resolves each field independently", () => {
    expect(
      resolveContact({ phoneNumber: "+1 555 0100" }, { emailAddress: "global@example.com" })
    ).toEqual({ phone: "+1 555 0100", email: "global@example.com" });
  });

  it("treats blank and whitespace-only values as absent", () => {
    expect(
      resolveContact(
        { phoneNumber: "   ", emailAddress: "" },
        { phoneNumber: "+44 20 7946 0958", emailAddress: null }
      )
    ).toEqual({ phone: "+44 20 7946 0958", email: null });
  });

  it("trims the resolved values", () => {
    expect(resolveContact({ phoneNumber: "  +1 555 0100  " }, null)).toEqual({
      phone: "+1 555 0100",
      email: null,
    });
  });

  it("returns nulls when neither level has contact details", () => {
    expect(resolveContact(null, undefined)).toEqual({ phone: null, email: null });
  });
});

describe("hasContact", () => {
  it.each([
    [{ phone: "+1 555 0100", email: null }, true],
    [{ phone: null, email: "hi@example.com" }, true],
    [{ phone: null, email: null }, false],
  ])("%p -> %p", (contact, expected) => {
    expect(hasContact(contact)).toBe(expected);
  });
});

describe("telHref", () => {
  it("strips formatting characters", () => {
    expect(telHref("(020) 7946-0958")).toBe("tel:02079460958");
  });

  it("keeps a leading country-code plus", () => {
    expect(telHref(" +44 20 7946 0958 ")).toBe("tel:+442079460958");
  });
});

describe("mailtoHref", () => {
  it("builds a mailto target", () => {
    expect(mailtoHref("hi@example.com")).toBe("mailto:hi@example.com");
  });
});
