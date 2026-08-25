import i18n from "@/i18n";
import {
  ANY_ID,
  PAGE_SIZE,
  REDACTED_MARKER,
  actionGroup,
  actionIcon,
  actionLabel,
  actorName,
  formatChangeValue,
  formatExactTime,
  fromIdFilter,
  getActionGroups,
  httpLine,
  isRedacted,
  personLabel,
  statusColor,
  statusTone,
  toIdFilter,
} from "@/utils/audit";
import { theme } from "@/theme/theme";

const t = i18n.getFixedT("en");

describe("actionLabel", () => {
  it("names a known action", () => {
    expect(actionLabel("booking.cancel", t)).toBe("Cancelled booking");
    expect(actionLabel("auth.login_failed", t)).toBe("Failed sign-in");
    expect(actionLabel("table_group.update", t)).toBe("Updated table group");
  });

  it("names an undescribed request by its HTTP method", () => {
    expect(actionLabel("http.post", t)).toBe("POST request");
    expect(actionLabel("http.delete", t)).toBe("DELETE request");
  });

  it("humanizes a key nobody has labelled yet", () => {
    expect(actionLabel("widget.frobnicate_thing", t)).toBe("Widget frobnicate thing");
  });

  it("passes an empty key through rather than rendering blank", () => {
    expect(actionLabel("", t)).toBe("");
  });
});

describe("actionGroup", () => {
  it("is the first dotted segment", () => {
    expect(actionGroup("booking.cancel")).toBe("booking");
    expect(actionGroup("email_settings.test")).toBe("email_settings");
  });
});

describe("actionIcon", () => {
  it("gives every action in a group the same glyph", () => {
    expect(actionIcon("booking.create")).toBe(actionIcon("booking.purge"));
    expect(actionIcon("booking.create")).toBe("calendar-outline");
  });

  it("singles out a failed sign-in from the rest of its group", () => {
    expect(actionIcon("auth.login")).toBe("log-in-outline");
    expect(actionIcon("auth.login_failed")).toBe("alert-circle-outline");
  });

  it("falls back for an action from a group it does not know", () => {
    expect(actionIcon("http.post")).toBe("ellipsis-horizontal-outline");
  });
});

describe("statusTone", () => {
  it("reads a 2xx/3xx response as success", () => {
    expect(statusTone(200)).toBe("success");
    expect(statusTone(204)).toBe("success");
    expect(statusTone(399)).toBe("success");
  });

  it("reads a refusal as a warning, on both sides of the 400 boundary", () => {
    expect(statusTone(399)).toBe("success");
    expect(statusTone(400)).toBe("warning");
    expect(statusTone(499)).toBe("warning");
  });

  it("reads a server failure as danger, on both sides of the 500 boundary", () => {
    expect(statusTone(499)).toBe("warning");
    expect(statusTone(500)).toBe("danger");
  });
});

describe("statusColor", () => {
  it("maps each tone to its theme colour", () => {
    expect(statusColor(201)).toBe(theme.colors.success);
    expect(statusColor(403)).toBe(theme.colors.warning);
    expect(statusColor(500)).toBe(theme.colors.error);
  });
});

describe("actorName", () => {
  it("prefers the display name", () => {
    expect(actorName({ actorDisplayName: "Dana", actorEmail: "dana@example.com" })).toBe("Dana");
  });

  it("falls back to the email when there is no display name", () => {
    expect(actorName({ actorDisplayName: null, actorEmail: "dana@example.com" })).toBe(
      "dana@example.com"
    );
  });

  it("falls back to the email when the display name is only whitespace", () => {
    expect(actorName({ actorDisplayName: "   ", actorEmail: "dana@example.com" })).toBe(
      "dana@example.com"
    );
  });
});

describe("personLabel", () => {
  it("names a live user row by the same rule as an audit entry's actor", () => {
    expect(personLabel("Dana", "dana@example.com")).toBe("Dana");
    expect(personLabel(null, "dana@example.com")).toBe("dana@example.com");
    expect(personLabel(undefined, "dana@example.com")).toBe("dana@example.com");
  });
});

describe("httpLine", () => {
  it("reads as method, path and status", () => {
    expect(httpLine({ httpMethod: "POST", path: "/api/bookings", statusCode: 201 })).toBe(
      "POST /api/bookings → 201"
    );
  });
});

describe("formatExactTime", () => {
  it("renders a readable local timestamp rather than the raw ISO string", () => {
    const iso = "2026-08-17T14:32:05Z";
    const formatted = formatExactTime(iso);
    expect(formatted).not.toBe(iso);
    expect(formatted).toContain("2026");
  });
});

describe("formatChangeValue", () => {
  it("distinguishes unset from empty from a real value", () => {
    expect(formatChangeValue(null, t)).toBe("—");
    expect(formatChangeValue("", t)).toBe("(empty)");
    expect(formatChangeValue("   ", t)).toBe("(empty)");
    expect(formatChangeValue("Bistro", t)).toBe("Bistro");
  });
});

describe("isRedacted", () => {
  it("recognises a masked value and leaves an ordinary one alone", () => {
    expect(isRedacted(REDACTED_MARKER)).toBe(true);
    expect(isRedacted("[redacted]")).toBe(true);
    expect(isRedacted("Bistro")).toBe(false);
    expect(isRedacted(null)).toBe(false);
  });
});

describe("id filter conversion", () => {
  it("carries an id into a Select value and back unchanged", () => {
    expect(toIdFilter(7)).toBe(7);
    expect(fromIdFilter(toIdFilter(7))).toBe(7);
  });

  it("reads the catch-all option as no filter rather than as an id", () => {
    expect(toIdFilter(null)).toBe(ANY_ID);
    expect(fromIdFilter(ANY_ID)).toBeNull();
  });

  it("takes an id the Select handed back as a string", () => {
    expect(fromIdFilter("7")).toBe(7);
  });
});

describe("getActionGroups", () => {
  it("offers an unfiltered option plus one prefix per group", () => {
    const groups = getActionGroups(t);
    expect(groups[0]).toEqual({ label: "All activity", value: "" });
    expect(groups.map((g) => g.value)).toEqual([
      "",
      "booking",
      "restaurant",
      "user",
      "auth",
      "brand",
      "email_settings",
      "media",
    ]);
  });

  it("translates the label while the value stays the machine prefix the API matches on", () => {
    const groups = getActionGroups(i18n.getFixedT("fr"));
    expect(groups.find((g) => g.value === "booking")?.label).toBe("Réservations");
    expect(groups.find((g) => g.value === "booking")?.value).toBe("booking");
  });
});

describe("PAGE_SIZE", () => {
  it("requests a page the API will not clamp", () => {
    expect(PAGE_SIZE).toBeGreaterThan(0);
    expect(PAGE_SIZE).toBeLessThanOrEqual(100);
  });
});
