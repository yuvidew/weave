import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";

// Number of agents a user can create on the free plan. Matches
// `users.agentCredits`'s default below, which tracks credits *remaining*
// (agents created so far = AGENT_LIMIT - agentCredits).
export const AGENT_LIMIT = 5;

// Application users, keyed by their Clerk-verified email.
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name"),
  email: text("email").notNull().unique(),
  agentCredits: integer("agentCredits").default(5),
  usageCredits: integer("usageCredits").default(100),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});


// Row shape returned by SELECTs against `users`.
export type User = typeof users.$inferSelect;
// Shape expected when inserting a new `users` row.
export type NewUser = typeof users.$inferInsert;
