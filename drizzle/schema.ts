import {
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const learnerProfiles = mysqlTable(
  "learner_profiles",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    dailyMinutes: int("dailyMinutes").notNull().default(50),
    engineeringSpecialty: varchar("engineeringSpecialty", { length: 80 }).notNull().default("general"),
    goalTrack: varchar("goalTrack", { length: 40 }).notNull().default("job_interviews"),
    startingBand: varchar("startingBand", { length: 16 }).notNull().default("A2/B1"),
    vocabularyWeight: int("vocabularyWeight").notNull().default(25),
    grammarWeight: int("grammarWeight").notNull().default(20),
    listeningWeight: int("listeningWeight").notNull().default(15),
    speakingWeight: int("speakingWeight").notNull().default(25),
    writingWeight: int("writingWeight").notNull().default(15),
    calibrationConfidence: int("calibrationConfidence").notNull().default(15),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [uniqueIndex("learner_profiles_user_unique").on(table.userId)],
);

export const skillSnapshots = mysqlTable(
  "skill_snapshots",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    dateKey: varchar("dateKey", { length: 10 }).notNull(),
    vocabularyScore: int("vocabularyScore").notNull(),
    grammarScore: int("grammarScore").notNull(),
    listeningScore: int("listeningScore").notNull(),
    speakingScore: int("speakingScore").notNull(),
    writingScore: int("writingScore").notNull(),
    aggregateScore: int("aggregateScore").notNull(),
    practicalBand: varchar("practicalBand", { length: 32 }).notNull(),
    evidenceCount: int("evidenceCount").notNull().default(0),
    summary: text("summary").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("skill_snapshots_user_date_idx").on(table.userId, table.dateKey)],
);

export const diagnosticAttempts = mysqlTable(
  "diagnostic_attempts",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    skill: mysqlEnum("skill", ["vocabulary", "grammar", "listening", "speaking", "writing"]).notNull(),
    evidenceType: varchar("evidenceType", { length: 40 }).notNull(),
    prompt: text("prompt").notNull(),
    response: text("response").notNull(),
    score: int("score").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("diagnostic_attempts_user_skill_idx").on(table.userId, table.skill)],
);

export const vocabularyCards = mysqlTable(
  "vocabulary_cards",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    term: varchar("term", { length: 160 }).notNull(),
    arabicMeaning: text("arabicMeaning").notNull(),
    partOfSpeech: varchar("partOfSpeech", { length: 48 }).notNull(),
    ipa: varchar("ipa", { length: 120 }).notNull(),
    engineeringDomain: varchar("engineeringDomain", { length: 80 }).notNull(),
    examples: json("examples").notNull(),
    reviewStrength: int("reviewStrength").notNull().default(0),
    reviewCount: int("reviewCount").notNull().default(0),
    nextReviewAt: timestamp("nextReviewAt").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [index("vocabulary_cards_user_due_idx").on(table.userId, table.nextReviewAt)],
);

export const cardReviews = mysqlTable(
  "card_reviews",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    cardId: int("cardId").notNull().references(() => vocabularyCards.id, { onDelete: "cascade" }),
    rating: mysqlEnum("rating", ["again", "hard", "good", "easy"]).notNull(),
    strengthAfter: int("strengthAfter").notNull(),
    reviewedAt: timestamp("reviewedAt").defaultNow().notNull(),
  },
  table => [index("card_reviews_user_card_idx").on(table.userId, table.cardId)],
);

export const dailyTasks = mysqlTable(
  "daily_tasks",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    dateKey: varchar("dateKey", { length: 10 }).notNull(),
    taskKey: varchar("taskKey", { length: 48 }).notNull(),
    skill: mysqlEnum("skill", ["vocabulary", "grammar", "listening", "speaking", "writing"]).notNull(),
    title: varchar("title", { length: 180 }).notNull(),
    instructions: text("instructions").notNull(),
    minutes: int("minutes").notNull(),
    status: mysqlEnum("status", ["pending", "completed"]).notNull().default("pending"),
    completedAt: timestamp("completedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    uniqueIndex("daily_tasks_user_date_task_unique").on(table.userId, table.dateKey, table.taskKey),
    index("daily_tasks_user_date_idx").on(table.userId, table.dateKey),
  ],
);

export type LearnerProfile = typeof learnerProfiles.$inferSelect;
export type VocabularyCard = typeof vocabularyCards.$inferSelect;
export type DailyTask = typeof dailyTasks.$inferSelect;
export type User = typeof users.$inferSelect;
