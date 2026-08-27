import i18n from "@/i18n";
import { apiErrorMessage } from "@/api/errors";

describe("apiErrorMessage", () => {
  afterEach(async () => {
    await i18n.changeLanguage("en");
  });

  it("translates a known code into the active language", async () => {
    await i18n.changeLanguage("fr");

    expect(
      apiErrorMessage(
        { message: "Cannot create a booking in the past.", code: "booking.past_date" },
        "fallback"
      )
    ).toBe("Impossible de créer une réservation dans le passé.");
  });

  it("interpolates args into the translated sentence", async () => {
    await i18n.changeLanguage("fr");

    // The English sentence arrives with the numbers already baked in; args is the only way the
    // French one can name the same two.
    expect(
      apiErrorMessage(
        {
          message: "This table only has 4 seats, but 6 guests were requested.",
          code: "table.seats_exceeded",
          args: { seats: 4, requested: 6 },
        },
        "fallback"
      )
    ).toBe("Cette table ne compte que 4 places, mais 6 convives ont été demandés.");
  });

  it("keeps the server's message for a code with no copy yet", () => {
    // Degrades to today's English rather than rendering a raw key.
    expect(
      apiErrorMessage(
        { message: "Some new rule rejected this.", code: "booking.not_a_real_code" },
        "fallback"
      )
    ).toBe("Some new rule rejected this.");
  });

  it("keeps the server's message when the response carries no code", () => {
    expect(apiErrorMessage({ message: "Legacy rejection." }, "fallback")).toBe("Legacy rejection.");
  });

  it("falls back when the response carried no message at all", () => {
    expect(apiErrorMessage({}, "Request failed.")).toBe("Request failed.");
    expect(apiErrorMessage(null, "Request failed.")).toBe("Request failed.");
  });

  it("translates the same code differently per language", async () => {
    const body = { message: "Table group not found.", code: "table_group.not_found" };

    await i18n.changeLanguage("de");
    expect(apiErrorMessage(body, "fallback")).toBe("Tischgruppe nicht gefunden.");

    await i18n.changeLanguage("es");
    expect(apiErrorMessage(body, "fallback")).toBe("Grupo de mesas no encontrado.");
  });
});
