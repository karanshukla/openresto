import { test, expect } from "@playwright/test";

/**
 * Guards the /lookup customer funnel: the search Pressable must stay inert
 * until both reference and email are present, and a miss must surface the
 * "No booking found" card. These are pure UI invariants (no booking is
 * created), so the spec is self-contained and fast.
 *
 * The Pressable's disabled state is enforced react-native-web-side via
 * `disabled` + opacity — there's no native <button disabled> to assert on, so
 * we verify behaviour instead: clicking with one field empty must not flip
 * `searched`, hence the not-found card never appears.
 */
test.describe("Lookup form validation", () => {
  test("Look Up stays inert with one field empty and does not show the not-found card", async ({
    page,
  }) => {
    await page.goto("/lookup");
    await expect(page.getByText("Find My Booking")).toBeVisible({ timeout: 15_000 });

    const refInput = page.getByPlaceholder("e.g. crispy-basil-thyme");
    const emailInput = page.getByPlaceholder("The email used when booking");
    const lookUpBtn = page.getByText("Look Up", { exact: true });

    // Only the reference is filled — `canSearch` is false, so pressing the
    // button must be a no-op: no network call, no state change, no card.
    await refInput.fill("some-ref");
    await lookUpBtn.click({ force: true });

    // Give any (incorrectly) fired request a moment to settle, then assert
    // the not-found card is still absent.
    await page.waitForTimeout(500);
    await expect(page.getByText("No booking found matching that reference and email.")).toHaveCount(
      0
    );
    await expect(emailInput).toHaveValue("");

    // Fill the email too and now the same press reaches the API → miss card.
    await emailInput.fill("nobody@example.com");
    await lookUpBtn.click();

    await expect(page.getByText("No booking found matching that reference and email.")).toBeVisible(
      { timeout: 15_000 }
    );
  });

  test("both fields empty keeps Look Up inert (no card, inputs unchanged)", async ({ page }) => {
    await page.goto("/lookup");
    await expect(page.getByText("Find My Booking")).toBeVisible({ timeout: 15_000 });

    const lookUpBtn = page.getByText("Look Up", { exact: true });
    await lookUpBtn.click({ force: true });
    await page.waitForTimeout(500);

    await expect(page.getByText("No booking found matching that reference and email.")).toHaveCount(
      0
    );
    // The form inputs remain empty (no submit was attempted).
    await expect(page.getByPlaceholder("e.g. crispy-basil-thyme")).toHaveValue("");
  });
});
