import { describe, expect, it } from "vitest";
import { resolveReportViewData } from "./reportData";

describe("resolveReportViewData", () => {
  const fallback = { weekly: { snapshotCount: 0 }, monthly: { snapshotCount: 0 } };
  const live = { weekly: { snapshotCount: 3 }, monthly: { snapshotCount: 8 } };

  it("uses the authenticated report payload rather than the preview fallback", () => {
    expect(resolveReportViewData(true, live, fallback)).toBe(live);
  });

  it("keeps the preview fallback only before authentication or before a payload exists", () => {
    expect(resolveReportViewData(false, live, fallback)).toBe(fallback);
    expect(resolveReportViewData(true, undefined, fallback)).toBe(fallback);
  });
});
