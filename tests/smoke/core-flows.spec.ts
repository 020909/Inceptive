import { test, expect } from "@playwright/test";

const EMAIL = process.env.SMOKE_EMAIL;
const PASSWORD = process.env.SMOKE_PASSWORD;

test.describe("Core flow smoke", () => {
  test.skip(!EMAIL || !PASSWORD, "SMOKE_EMAIL/SMOKE_PASSWORD not configured");

  test("dashboard chat and reports generate", async ({ page }) => {
    await page.goto("/login");
    await page.getByPlaceholder(/Email/i).fill(EMAIL!);
    await page.getByPlaceholder(/Password/i).fill(PASSWORD!);
    await page.getByRole("button", { name: /sign in|login/i }).click();

    await page.waitForURL(/\/dashboard/, { timeout: 30_000 });

    const prompt = "do I have unread emails today?";
    const chatBox = page.getByPlaceholder(/Ask Inceptive anything|Send a message/i).first();
    await chatBox.fill(prompt);
    await page.keyboard.press("Enter");

    // Exactly one user bubble with this prompt.
    await expect(page.getByText(prompt, { exact: true })).toHaveCount(1, { timeout: 20_000 });

    // Wait for an assistant response that is not blank/{}.
    const assistantText = page.locator("main").locator("div").filter({ hasText: /Scanning Gmail|Thinking|I checked your inbox|couldn’t complete|emails/ }).first();
    await expect(assistantText).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("{}")).toHaveCount(0);

    await page.goto("/reports");
    await page.getByRole("button", { name: /Generate Report/i }).click();

    // Report page should eventually not be in pure empty state.
    await expect(page.getByText(/No reports yet/i)).toHaveCount(0, { timeout: 30_000 });
  });
});

