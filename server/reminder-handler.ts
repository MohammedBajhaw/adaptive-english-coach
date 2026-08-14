import type express from "express";
import { notifyOwner } from "./_core/notification";
import { sdk } from "./_core/sdk";
import { getScheduledReminder, markScheduledReminderDispatched } from "./db";

export function registerReminderSchedule(app: express.Express) {
  app.post("/api/scheduled/learning-reminder", async (req, res) => {
    try {
      const user = await sdk.authenticateRequest(req);
      if (!user.isCron || !user.taskUid) return res.status(403).json({ error: "cron-only" });
      const reminder = await getScheduledReminder(user.taskUid);
      if (!reminder) return res.json({ ok: true, skipped: "orphan-or-complete" });
      const delivered = await notifyOwner(reminder.message);
      if (!delivered) return res.status(503).json({ error: "reminder-notification-unavailable", taskUid: user.taskUid });
      await markScheduledReminderDispatched(user.taskUid, reminder.dateKey);
      return res.json({ ok: true, delivered: true, taskUid: user.taskUid });
    } catch (error) {
      return res.status(500).json({ error: error instanceof Error ? error.message : String(error), context: { path: "/api/scheduled/learning-reminder" }, timestamp: new Date().toISOString() });
    }
  });
}
