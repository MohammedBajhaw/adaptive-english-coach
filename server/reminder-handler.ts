import type express from "express";
import { sdk } from "./_core/sdk";
import { createScheduledReminder, getScheduledReminder } from "./db";

export function registerReminderSchedule(app: express.Express) {
  app.post("/api/scheduled/learning-reminder", async (req, res) => {
    try {
      const user = await sdk.authenticateRequest(req);
      if (!user.isCron || !user.taskUid) return res.status(403).json({ error: "cron-only" });
      const reminder = await getScheduledReminder(user.taskUid);
      if (!reminder) return res.json({ ok: true, skipped: "orphan-or-complete" });
      const created = await createScheduledReminder(user.taskUid, reminder.dateKey, reminder.message);
      return res.json({ ok: true, created, taskUid: user.taskUid });
    } catch (error) {
      return res.status(500).json({ error: error instanceof Error ? error.message : String(error), context: { path: "/api/scheduled/learning-reminder" }, timestamp: new Date().toISOString() });
    }
  });
}
