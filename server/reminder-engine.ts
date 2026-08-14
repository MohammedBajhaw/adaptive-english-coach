export function reminderCron(hourUtc: number) {
  if (!Number.isInteger(hourUtc) || hourUtc < 0 || hourUtc > 23) throw new Error("ساعة التذكير يجب أن تكون بين 0 و23 بتوقيت UTC.");
  return `0 0 ${hourUtc} * * *`;
}

export function shouldDispatchReminder(input: { enabled: boolean; lastReminderDateKey: string | null; dateKey: string; dueCards: number; pendingTasks: number }) {
  return input.enabled && input.lastReminderDateKey !== input.dateKey && (input.dueCards > 0 || input.pendingTasks > 0);
}

export function reminderMessage(input: { dueCards: number; pendingTasks: number }) {
  const parts = [input.dueCards > 0 ? `${input.dueCards} بطاقة مستحقة` : null, input.pendingTasks > 0 ? `${input.pendingTasks} مهمة يومية غير مكتملة` : null].filter(Boolean);
  return { title: "تذكير من مهندس الإنجليزية", content: `لديك ${parts.join(" و")} اليوم. افتح خطتك واختر خطوة قصيرة تحافظ على الاستمرارية.` };
}
