import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import { createHmac } from "node:crypto";
import { writeFileSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
const secret = "local-browser-fixture-secret-ileraher-2026";
function token(id = "fixture-one") {
  const p = Buffer.from(
    JSON.stringify({
      sub: id,
      phone: "+2348000000000",
      exp: Math.floor(Date.now() / 1000) + 3600,
    }),
  ).toString("base64url");
  return p + "." + createHmac("sha256", secret).update(p).digest("base64url");
}
async function signIn(context: BrowserContext, id = "fixture-one") {
  await context.addCookies([
    {
      name: "ileraher_session",
      value: token(id),
      domain: "127.0.0.1",
      path: "/",
    },
  ]);
}
async function preferences(page: Page, id = "fixture-one", extra = {}) {
  await page.evaluate(
    ({ id, extra }) =>
      localStorage.setItem(
        "ileraher:account:" + id + ":preferences-v1",
        JSON.stringify({
          version: 1,
          focus: "periods",
          sharedDevice: false,
          conversationRetention: "session",
          keepAudio: false,
          voiceNoticeAccepted: true,
          externalAI: false,
          onboardingVersionCompleted: 1,
          ...extra,
        }),
      ),
    { id, extra },
  );
}
async function period(page: Page, date = "2026-09-01") {
  await page.goto("/log");
  await page.getByLabel("Period start date", { exact: true }).fill(date);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Review before saving" }),
  ).toBeVisible();
}
async function overflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}

test("public Help and protected legacy route return targets", async ({
  page,
}) => {
  await page.goto("/log?date=2026-10-01");
  await expect(page).toHaveURL(/\/login\?next=/);
  await expect(
    page.getByRole("heading", { name: "Sign in", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Show password" }),
  ).toBeVisible();
  await page.goto("/help");
  await expect(
    page.getByRole("heading", { name: "Help", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "How to ask" })).toBeVisible();
  expect(
    (
      await page.request.post("/api/ask", { data: { question: "hello" } })
    ).status(),
  ).toBe(401);
});
test("period review, unknown defaults, single commit, edit and scoped deletion", async ({
  page,
  context,
}) => {
  await signIn(context);
  await page.goto("/home");
  await preferences(page);
  await period(page);
  await expect(
    page.getByText("Not provided", { exact: false }).first(),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Save period", exact: true })
    .dblclick();
  await expect(
    page.getByRole("heading", { name: "Period saved on this device" }),
  ).toBeVisible();
  const saved = await page.evaluate(
    () =>
      JSON.parse(
        localStorage.getItem("ileraher:account:fixture-one:health-v3")!,
      ).periods,
  );
  expect(saved).toHaveLength(1);
  expect(saved[0].pain).toBeNull();
  expect(saved[0].flow).toBeNull();
  await page.getByRole("link", { name: "View record", exact: true }).click();
  await page.getByRole("button", { name: "Change · Details" }).click();
  await page.getByLabel("0", { exact: true }).check();
  await page.getByLabel("Light", { exact: true }).check();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await page.goto("/history");
  await expect(
    page.getByRole("link", { name: "Periods", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.locator("dialog")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Keep record", exact: true }),
  ).toBeFocused();
  await page
    .getByRole("button", { name: "Delete", exact: true })
    .last()
    .click();
  await expect(
    page.getByRole("heading", { name: "No records yet" }),
  ).toBeVisible();
});
test("failed save retains reviewed draft and never reports success", async ({
  page,
  context,
}) => {
  await signIn(context);
  await period(page);
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) {
      if (k.endsWith("health-v3"))
        throw new DOMException("Quota", "QuotaExceededError");
      return original.call(this, k, v);
    };
  });
  await page.getByRole("button", { name: "Save period", exact: true }).click();
  await expect(page.locator("main [role=alert]")).toContainText(
    "has not been saved",
  );
  await expect(
    page.getByRole("heading", { name: "Review before saving" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Period saved on this device" }),
  ).toHaveCount(0);
});
test("two accounts cannot see new records and legacy recovery is explicit", async ({
  page,
  context,
}) => {
  await signIn(context);
  await page.goto("/home");
  await page.evaluate(() => {
    localStorage.setItem(
      "ileraher-periods-v2",
      JSON.stringify([
        {
          id: "old",
          startDate: "2026-01-01",
          flow: "light",
          pain: 0,
          notes: "Old synthetic note",
        },
      ]),
    );
  });
  await page.goto("/history");
  await expect(
    page.getByRole("heading", { name: "No records yet" }),
  ).toBeVisible();
  await page.goto("/settings");
  await expect(
    page.getByText("Found 1 period records", { exact: false }),
  ).toBeVisible();
  await page
    .getByLabel("I confirm these old records are mine", { exact: false })
    .check();
  await page.getByRole("button", { name: "Copy my old records" }).click();
  await expect(page.locator("main [role=status]").last()).toContainText(
    "Recovery completed",
  );
  await page.getByRole("button", { name: "Copy my old records" }).click();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(
          localStorage.getItem("ileraher:account:fixture-one:health-v3")!,
        ).periods.length,
    ),
  ).toBe(1);
  await signIn(context, "fixture-two");
  await page.goto("/history");
  await expect(
    page.getByRole("heading", { name: "No records yet" }),
  ).toBeVisible();
});
test("provider pregnancy date survives LMP changes and pause hides gestational card", async ({
  page,
  context,
}) => {
  await signIn(context);
  await page.goto("/pregnancy");
  await page
    .getByRole("combobox", { name: "Dating information", exact: true })
    .selectOption("provider");
  await page.getByLabel("Provider-supplied due date").fill("2026-12-20");
  await page
    .getByRole("button", { name: "Review before saving", exact: true })
    .click();
  await page.getByRole("button", { name: "Save pregnancy details" }).click();
  await expect(page.getByText("29 weeks, 6 days")).toBeVisible();
  await page
    .getByRole("button", { name: "Update details or pause/end tracking" })
    .click();
  await page
    .getByRole("combobox", { name: "Dating information", exact: true })
    .selectOption("lmp");
  await page
    .getByLabel("First day of last period", { exact: true })
    .fill("2026-04-01");
  await page
    .getByRole("button", { name: "Review before saving", exact: true })
    .click();
  await expect(
    page.getByText("will remain selected", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Save pregnancy details" }).click();
  await expect(page.getByText("29 weeks, 6 days")).toBeVisible();
  await page
    .getByRole("button", { name: "Update details or pause/end tracking" })
    .click();
  await page.getByLabel("Tracking status").selectOption("paused");
  await page
    .getByRole("button", { name: "Review before saving", exact: true })
    .click();
  await page.getByRole("button", { name: "Save pregnancy details" }).click();
  await expect(page.getByText("29 weeks, 6 days")).toHaveCount(0);
});
test("two children keep measurement units and profiles separate", async ({
  page,
  context,
}) => {
  await signIn(context);
  for (const name of ["Synthetic Ada", "Synthetic Bisi"]) {
    await page.goto("/baby");
    await page
      .getByRole("button", { name: "Add a child profile / record a birth" })
      .click();
    await page.getByLabel("Display name (optional)").fill(name);
    await page
      .getByLabel("Actual birth date", { exact: true })
      .fill("2026-10-01");
    await page
      .getByRole("button", { name: "Review before saving", exact: true })
      .click();
    await page.getByRole("button", { name: "Save child profile" }).click();
    await expect(
      page.getByText("Child profile saved on this device.", { exact: true }),
    ).toBeVisible();
  }
  const ids = await page.evaluate(() =>
    JSON.parse(
      localStorage.getItem("ileraher:account:fixture-one:health-v3")!,
    ).babies.map((x: { id: string }) => x.id),
  );
  for (const [i, value, unit] of [
    [0, "3500", "g"],
    [1, "4", "kg"],
  ] as const) {
    await page.goto("/growth");
    await page
      .getByRole("combobox", { name: "Selected child", exact: true })
      .selectOption(ids[i]);
    await page.getByRole("button", { name: "Add a measurement" }).click();
    await page.getByLabel("Value", { exact: true }).fill(value);
    await page
      .getByRole("combobox", { name: "Unit", exact: true })
      .selectOption(unit);
    await page
      .getByRole("button", { name: "Review before saving", exact: true })
      .click();
    await expect(
      page.getByText(value + " " + unit, { exact: false }).first(),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Save measurement", exact: true })
      .click();
    await expect(
      page.getByText("Measurement saved on this device.", { exact: true }),
    ).toBeVisible();
  }
  const measurements = await page.evaluate(
    () =>
      JSON.parse(
        localStorage.getItem("ileraher:account:fixture-one:health-v3")!,
      ).measurements,
  );
  expect(measurements.map((x: { normalized: number }) => x.normalized)).toEqual(
    [3.5, 4],
  );
  expect(measurements[0].babyId).not.toBe(measurements[1].babyId);
  await expect(
    page.getByText("Reference comparisons are unavailable", { exact: false }),
  ).toBeVisible();
});
test("voice checks transcript before guidance and session-only does not persist", async ({
  page,
  context,
}) => {
  await signIn(context);
  await context.grantPermissions(["microphone"]);
  await page.goto("/home");
  await preferences(page);
  let asks = 0;
  await page.route("**/api/transcribe", (r) =>
    r.fulfill({ json: { text: "I have period cramps" } }),
  );
  await page.route("**/api/ask", (r) => {
    asks++;
    return r.fulfill({
      json: {
        answer:
          "Synthetic basic guidance: discuss persistent symptoms with a provider.",
        urgency: "attention",
        disclaimer: "Synthetic fixture.",
        nextSteps: ["Seek care if symptoms are worrying."],
        sources: [],
        model: "curated",
        generationProvider: "curated",
      },
    });
  });
  await page.goto("/voice");
  await page
    .getByRole("button", { name: "Record a question", exact: true })
    .click();
  await page.waitForTimeout(1200);
  await page.getByRole("button", { name: "Stop", exact: true }).click();
  await expect(
    page.getByText("I have period cramps", { exact: true }),
  ).toBeVisible();
  expect(asks).toBe(0);
  await page.getByRole("button", { name: "Confirm and ask" }).click();
  await expect(
    page.getByText("Synthetic basic guidance", { exact: false }),
  ).toBeVisible();
  expect(asks).toBe(1);
  const count = await page.evaluate(
    () =>
      new Promise<number>((resolve, reject) => {
        const req = indexedDB.open("ileraher-voice-chat-v1", 2);
        req.onsuccess = () => {
          const db = req.result,
            r = db
              .transaction("scopedMessages")
              .objectStore("scopedMessages")
              .count();
          r.onsuccess = () => {
            db.close();
            resolve(r.result);
          };
        };
        req.onerror = () => reject(req.error);
      }),
  );
  expect(count).toBe(0);
});
test("layouts, long translated labels, empty/error states and keyboard focus", async ({
  page,
  context,
}) => {
  await signIn(context);
  await page.goto("/home");
  await preferences(page);
  for (const width of [320, 360, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/home");
    await overflow(page);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/home");
  await page.screenshot({
    path: "artifacts/screenshots/home-phone.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({
    path: "artifacts/screenshots/home-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto("/settings");
  await page
    .getByRole("combobox", { name: "Language", exact: true })
    .selectOption("yo");
  await overflow(page);
  await page.screenshot({
    path: "artifacts/screenshots/settings-yoruba-phone.png",
    fullPage: true,
  });
  for (const code of ["ha", "ig", "en-NG"]) {
    await page.locator("select").first().selectOption(code);
    await overflow(page);
  }
  await page.goto("/cycle");
  await page.getByRole("button", { name: "List", exact: true }).click();
  await expect(page.locator(".dateList button").first()).toBeVisible();
  await page.screenshot({
    path: "artifacts/screenshots/tracker-empty-phone.png",
    fullPage: true,
  });
  await page.goto("/log?date=2026-02-30");
  await expect(page.locator("main [role=alert]")).toBeVisible();
  await page.screenshot({
    path: "artifacts/screenshots/log-invalid-date-phone.png",
    fullPage: true,
  });
  await page.goto("/home");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to main content" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#screen")).toBeFocused();
  await page.evaluate(() => {
    const sizes = [...document.querySelectorAll<HTMLElement>("*")].map(
      (node) => ({ node, size: parseFloat(getComputedStyle(node).fontSize) }),
    );
    for (const { node, size } of sizes)
      if (Number.isFinite(size)) node.style.fontSize = size * 2 + "px";
  });
  await overflow(page);
  await page.screenshot({
    path: "artifacts/screenshots/home-text-200-phone.png",
    fullPage: true,
  });
});
test("Lite initial transfer is measured separately from full Ask", async ({
  browser,
}) => {
  const values: Record<string, number> = {};
  for (const path of ["/voice", "/lite"]) {
    const context = await browser.newContext({ serviceWorkers: "block" });
    await signIn(context);
    const page = await context.newPage();
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    values[path] = await page.evaluate(
      () =>
        performance
          .getEntriesByType("resource")
          .filter((x) => !x.name.includes("/api/"))
          .reduce(
            (n, x) => n + (x as PerformanceResourceTiming).encodedBodySize,
            0,
          ) +
        (
          performance.getEntriesByType(
            "navigation",
          )[0] as PerformanceNavigationTiming
        ).encodedBodySize,
    );
    await context.close();
  }
  writeFileSync(
    "artifacts/lite-transfer.json",
    JSON.stringify(
      {
        measuredAt: new Date().toISOString(),
        encodedInitialBytes: values,
        budgetBytes: 350000,
        savingsBytes: values["/voice"] - values["/lite"],
        fixture:
          "local production HTTP, Chromium, cold context; compression differs by host",
      },
      null,
      2,
    ),
  );
  expect(values["/lite"]).toBeLessThan(values["/voice"]);
  expect(values["/lite"]).toBeLessThan(350000);
});
test("onboarding preserves a deep link and creates preferences without a pregnancy record", async ({
  page,
  context,
}) => {
  await signIn(context);
  await page.goto("/onboarding?next=%2Flog%3Fdate%3D2026-10-01");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page
    .getByRole("radio", { name: "Pregnancy records", exact: true })
    .check();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByLabel("Shared device", { exact: false }).check();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page).toHaveURL(/\/log\?date=2026-10-01/);
  await expect(
    page.getByLabel("Period start date", { exact: true }),
  ).toHaveValue("2026-10-01");
  const result = await page.evaluate(() => ({
    preferences: JSON.parse(
      localStorage.getItem("ileraher:account:fixture-one:preferences-v1")!,
    ),
    records: localStorage.getItem("ileraher:account:fixture-one:health-v3"),
  }));
  expect(result.preferences).toMatchObject({
    focus: "pregnancy",
    sharedDevice: true,
    conversationRetention: "session",
    onboardingVersionCompleted: 1,
  });
  expect(result.records).toBeNull();
});
test("structured restore previews child identity, is idempotent and preserves data after invalid import", async ({
  page,
  context,
}) => {
  await signIn(context);
  await page.goto("/settings");
  const data = {
    version: 3,
    revision: 0,
    periods: [],
    pregnancies: [],
    babies: [
      {
        id: "child-a",
        name: "Synthetic child",
        birthDate: "2026-10-01",
        referenceSex: "unknown",
        term: "unknown",
      },
    ],
    measurements: [
      {
        id: "m-a",
        babyId: "child-a",
        date: "2026-10-10",
        measure: "weight",
        value: 3500,
        unit: "g",
        normalized: 3.5,
        method: "unknown",
        source: "unknown",
        confirmed: true,
        revision: 1,
      },
    ],
    appointments: [],
    conception: [],
    tests: [],
  };
  for (let i = 0; i < 2; i++) {
    await page.locator("input[type=file]").setInputFiles({
      name: "synthetic-export.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(data)),
    });
    await expect(
      page.getByRole("heading", { name: "Review this import" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Confirm import" }),
    ).toBeDisabled();
    await page.getByLabel("Keep the child profiles", { exact: false }).check();
    await page.getByRole("button", { name: "Confirm import" }).click();
    await expect(page.locator("main [role=status]").last()).toContainText(
      "restored",
    );
    await page.reload();
  }
  const before = await page.evaluate(() =>
    localStorage.getItem("ileraher:account:fixture-one:health-v3"),
  );
  expect(JSON.parse(before!).measurements).toHaveLength(1);
  await page.locator("input[type=file]").setInputFiles({
    name: "invalid.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({ ...data, version: 99 })),
  });
  await expect(page.locator("main [role=status]").last()).toContainText(
    "Unsupported",
  );
  expect(
    await page.evaluate(() =>
      localStorage.getItem("ileraher:account:fixture-one:health-v3"),
    ),
  ).toBe(before);
});
test("microphone denial retains tap topics, and feedback failure retains the draft", async ({
  page,
  context,
}) => {
  await signIn(context);
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      throw new DOMException("Blocked", "NotAllowedError");
    };
  });
  await page.goto("/home");
  await preferences(page);
  await page.goto("/voice");
  await page
    .getByRole("button", { name: "Record a question", exact: true })
    .click();
  await expect(page.locator("main [role=alert]")).toBeVisible();
  await expect(page.locator(".guidedTopics")).toBeVisible();
  await page.route("**/api/feedback", (r) =>
    r.fulfill({ status: 503, json: { error: "Synthetic connection failure" } }),
  );
  await page.goto("/feedback");
  await expect(page.locator("input[name=rating]:checked")).toHaveCount(0);
  await page.locator('input[name=rating][value="4"]').check();
  await page.getByRole("textbox").fill("Synthetic layout feedback");
  await page.getByRole("button", { name: "Send feedback" }).click();
  await expect(page.locator("main [role=status]").first()).toContainText(
    "Synthetic connection failure",
  );
  await expect(page.getByRole("textbox")).toHaveValue(
    "Synthetic layout feedback",
  );
});
test("phone readiness failure recovers without exposing an unverified call button", async ({
  page,
}) => {
  let count = 0;
  await page.route("**/api/ivr/status", (r) =>
    ++count === 1
      ? r.fulfill({ status: 503, json: {} })
      : r.fulfill({ json: { ready: false, phoneNumber: null, languages: [] } }),
  );
  await page.goto("/help");
  await expect(
    page.getByText("Could not check phone availability.", { exact: true }),
  ).toBeVisible();
  await expect(page.locator('a[href^="tel:"]')).toHaveCount(0);
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(
    page.getByText("A verified support number", { exact: false }),
  ).toBeVisible();
});
test("WCAG automated checks cover current and record-only tasks", async ({
  page,
  context,
}) => {
  await signIn(context);
  const reports = [];
  for (const route of [
    "/home",
    "/track",
    "/cycle",
    "/log",
    "/voice",
    "/history",
    "/settings",
    "/help",
    "/pregnancy",
    "/baby",
    "/growth",
    "/fertility",
    "/conception",
    "/late-period",
    "/feedback",
    "/lite",
  ]) {
    await page.goto(route);
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    reports.push({ route, violations: result.violations });
    await page.setViewportSize({ width: 390, height: 844 });
    await overflow(page);
    await page.screenshot({
      path: "artifacts/screenshots/" + route.slice(1) + "-initial-phone.png",
      fullPage: true,
    });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await overflow(page);
    await page.screenshot({
      path: "artifacts/screenshots/" + route.slice(1) + "-initial-desktop.png",
      fullPage: true,
    });
  }
  writeFileSync(
    "artifacts/accessibility-results.json",
    JSON.stringify(reports, null, 2),
  );
  expect(
    reports.flatMap((x) =>
      x.violations.map((v) => ({
        route: x.route,
        id: v.id,
        nodes: v.nodes.map((n) => n.target),
      })),
    ),
  ).toEqual([]);
});
test("offline cache contains public help and static assets, never an account document", async ({
  browser,
}) => {
  const context = await browser.newContext({ serviceWorkers: "allow" });
  await signIn(context);
  const page = await context.newPage();
  await page.goto("/history");
  await page.evaluate(() => navigator.serviceWorker.ready);
  const keys = await page.evaluate(async () =>
    (
      await Promise.all(
        (await caches.keys()).map(async (name) =>
          (await (await caches.open(name)).keys()).map(
            (r) => new URL(r.url).pathname,
          ),
        ),
      )
    ).flat(),
  );
  expect(keys).toContain("/offline.html");
  expect(
    keys.some(
      (x) => x.startsWith("/api/") || x === "/history" || x === "/home",
    ),
  ).toBe(false);
  await context.setOffline(true);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "You are offline" }),
  ).toBeVisible();
  await context.close();
});
test("leaving Ask stops microphone tracks and cancellation discards a late answer", async ({
  page,
  context,
}) => {
  await signIn(context);
  await context.grantPermissions(["microphone"]);
  await page.addInitScript(() => {
    const original = navigator.mediaDevices.getUserMedia.bind(
      navigator.mediaDevices,
    );
    const state = window as typeof window & {
      fixtureTracks: MediaStreamTrack[];
    };
    state.fixtureTracks = [];
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      const stream = await original(constraints);
      state.fixtureTracks.push(...stream.getTracks());
      return stream;
    };
  });
  await page.goto("/home");
  await preferences(page);
  await page.goto("/voice");
  await page
    .getByRole("button", { name: "Record a question", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Stop", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Home", exact: true }).first().click();
  await expect(page).toHaveURL(/\/home$/);
  expect(
    await page.evaluate(() =>
      (
        window as typeof window & { fixtureTracks: MediaStreamTrack[] }
      ).fixtureTracks.map((t) => t.readyState),
    ),
  ).toEqual(["ended"]);
  await page.route("**/api/transcribe", (r) =>
    r.fulfill({ json: { text: "I have period cramps" } }),
  );
  let answerStarted = false;
  await page.route("**/api/ask", async (r) => {
    answerStarted = true;
    await new Promise((resolve) => setTimeout(resolve, 500));
    await r
      .fulfill({
        json: {
          answer: "Late synthetic answer that must be discarded",
          urgency: "attention",
          nextSteps: [],
          sources: [],
        },
      })
      .catch(() => {});
  });
  await page
    .getByRole("link", { name: "Record a question", exact: false })
    .click();
  await page
    .getByRole("button", { name: "Record a question", exact: true })
    .click();
  await page.waitForTimeout(1000);
  await page.getByRole("button", { name: "Stop", exact: true }).click();
  await expect(
    page.getByText("I have period cramps", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Confirm and ask" }).click();
  await expect.poll(() => answerStarted).toBe(true);
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page
    .getByRole("button", { name: "Start a new conversation", exact: true })
    .click();
  await page.waitForTimeout(700);
  await expect(
    page.getByText("Late synthetic answer", { exact: false }),
  ).toHaveCount(0);
});
