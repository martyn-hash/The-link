import { sql } from 'drizzle-orm';
import {
  index,
  pgTable,
  timestamp,
  varchar,
  text,
  integer,
  unique,
} from "drizzle-orm/pg-core";
import { users } from '../users/tables';

export const funnyErrorPhrases = pgTable("funny_error_phrases", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  phrase: text("phrase").notNull(),
  category: varchar("category", { length: 50 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_funny_error_phrases_category").on(table.category),
]);

export const userSeenPhrases = pgTable("user_seen_phrases", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  phraseId: integer("phrase_id").notNull().references(() => funnyErrorPhrases.id, { onDelete: "cascade" }),
  seenAt: timestamp("seen_at").notNull().defaultNow(),
}, (table) => [
  index("idx_user_seen_phrases_user_id").on(table.userId),
  index("idx_user_seen_phrases_phrase_id").on(table.phraseId),
  unique("unique_user_phrase").on(table.userId, table.phraseId),
]);
