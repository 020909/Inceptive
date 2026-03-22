import { createClient } from "@supabase/supabase-js";
import { assertUrlSafeForServerFetch } from "@/lib/url-safety";

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

type SessionEntry = {
  browser: import("playwright").Browser;
  page: import("playwright").Page;
  idleTimer: ReturnType<typeof setTimeout> | null;
};

const sessions = new Map<string, SessionEntry>();

const IDLE_MS = 30 * 60 * 1000;

function scheduleIdleClose(key: string) {
  const prev = sessions.get(key);
  if (prev?.idleTimer) clearTimeout(prev.idleTimer);
  const t = setTimeout(() => {
    void closeComputerSession(key);
  }, IDLE_MS);
  if (prev) prev.idleTimer = t;
}

export async function closeComputerSession(key: string) {
  const e = sessions.get(key);
  if (!e) return;
  if (e.idleTimer) clearTimeout(e.idleTimer);
  await e.browser.close().catch(() => {});
  sessions.delete(key);
}

async function getSession(userId: string, sessionId: string): Promise<SessionEntry> {
  const key = `${userId}:${sessionId}`;
  let entry = sessions.get(key);
  if (!entry) {
    const { chromium } = await import("playwright");
    const exe = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
    const browser = await chromium.launch({
      headless: true,
      executablePath: exe || undefined,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    });
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1280, height: 720 });
    entry = { browser, page, idleTimer: null };
    sessions.set(key, entry);
  }
  scheduleIdleClose(key);
  return entry;
}

async function persistPreview(userId: string, sessionId: string, png: Buffer) {
  const image_base64 = png.toString("base64");
  await admin().from("computer_session_previews").upsert(
    {
      user_id: userId,
      session_id: sessionId,
      image_base64,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,session_id" }
  );
}

export async function computerScreenshot(userId: string, sessionId: string) {
  const { page } = await getSession(userId, sessionId);
  const buf = await page.screenshot({ type: "png" });
  await persistPreview(userId, sessionId, buf);
  return buf.toString("base64");
}

export async function computerGoto(userId: string, sessionId: string, url: string) {
  assertUrlSafeForServerFetch(url);
  const { page } = await getSession(userId, sessionId);
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
  const buf = await page.screenshot({ type: "png" });
  await persistPreview(userId, sessionId, buf);
}

export async function computerClick(userId: string, sessionId: string, x: number, y: number) {
  const { page } = await getSession(userId, sessionId);
  await page.mouse.click(x, y);
  const buf = await page.screenshot({ type: "png" });
  await persistPreview(userId, sessionId, buf);
}

export async function computerType(userId: string, sessionId: string, text: string) {
  const { page } = await getSession(userId, sessionId);
  await page.keyboard.type(text, { delay: 15 });
  const buf = await page.screenshot({ type: "png" });
  await persistPreview(userId, sessionId, buf);
}

export async function computerScroll(userId: string, sessionId: string, deltaY: number) {
  const { page } = await getSession(userId, sessionId);
  await page.mouse.wheel(0, deltaY);
  const buf = await page.screenshot({ type: "png" });
  await persistPreview(userId, sessionId, buf);
}

export async function computerMoveMouse(userId: string, sessionId: string, x: number, y: number) {
  const { page } = await getSession(userId, sessionId);
  await page.mouse.move(x, y);
}
