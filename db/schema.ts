import { pgTable, serial, text, timestamp, integer, uuid, varchar, boolean, PgJsonb, jsonb, uniqueIndex, index } from "drizzle-orm/pg-core";

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

export const tools = pgTable("tools", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  name: varchar("name", { length: 150 }).notNull(),
  description: text("description"),

  category: varchar("category", { length: 100 }).notNull(),
  type: varchar("type", { length: 50 }).notNull(),
  provider: varchar("provider", { length: 100 }).notNull(),

  icon: varchar("icon", { length: 100 }),

  status: varchar("status", { length: 50 }).default("active"),

  requireAuth: boolean("requires_auth").default(false),
  authType: varchar("auth_type", { length: 50 }),
  authProvider: varchar("auth_provider", { length: 100 }),

  capabilities: jsonb("capabilities").$type<string[]>().default([]),
  useCases: jsonb("use_cases").$type<string[]>().default([]),

  permissions: jsonb('permissions').$type<string[]>().default([]),
  approvalRules: jsonb("approval_rules").$type<Record<string, boolean>>(),

  config: jsonb("config").$type<Record<string, any>>(),

  riskLevel: varchar("risk_level", { length: 30 }).default("low"),
  canRead: boolean("can_read").default(false),
  canWrite: boolean("can_write").default(false),
  canDelete: boolean("can_delete").default(false),
  canExecute: boolean("can_execute").default(true),
  enabled: boolean("enabled").default(true),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("upated_at").defaultNow(),

})

export const AgentConfig = pgTable("agentConfig", {
  id: serial("id").primaryKey(),
  userEmail: text("email").references(() => users.email),
  agentId: varchar("agentId").notNull().unique(),
  name: varchar("name"),
  agentImage: varchar("agentImage"),
  description: text("description"),
  instructions: text("instructions"),
  objective: text("objective"),
  tools: jsonb("tools"),
  skills: jsonb("skills"),
  schedule: jsonb("schedule"),
  outputFormat: text("outputFormat"),
  // Per-action defaults an agent has learned during chat — e.g. once it
  // auto-discovers a Notion parent page for notion_create_page, it's saved
  // here so future turns reuse it instead of searching again. Shape:
  // Record<actionName, Record<argName, value>> — see constant/agent-actions.ts.
  toolDefaults: jsonb("toolDefaults"),
  status: varchar("status").default("active"), // Active. Pause
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("upated_at").defaultNow().notNull(),
})

// One turn in an agent's chat transcript. Row-per-message (not one JSON blob
// per agent) so the tool-call approval flow can update a single pending call
// inside a single message with a plain `UPDATE ... WHERE id = ?`, and history
// is a simple ordered SELECT. The tool calls *within* one assistant turn stay
// denormalized as a JSONB array on that row, since they're always produced
// and resolved together as a batch (see constant/agent-actions.ts and
// app/api/agent/chat/route.ts for the shape/lifecycle of each call).
export const chatMessages = pgTable("chatMessages", {
  id: serial("id").primaryKey(),
  agentId: varchar("agentId").notNull().references(() => AgentConfig.agentId),
  userEmail: text("email").references(() => users.email),
  role: varchar("role").notNull(), // "user" | "assistant" | "tool"
  content: text("content"), // nullable — an assistant turn that's only tool_calls has no content yet
  toolCallId: varchar("toolCallId"), // set on role="tool" rows — which call this result answers
  toolCalls: jsonb("toolCalls"), // set on role="assistant" rows that requested calls
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const AgentRun = pgTable(
  "agentRun",
  {
    id: uuid("id")
      .defaultRandom()
      .primaryKey(),

    agentId: varchar("agentId")
      .notNull()
      .references(() => AgentConfig.agentId),

    userEmail: text("email").notNull(),

    scheduledFor: timestamp("scheduled_for", {
      withTimezone: true,
    }).notNull(),

    timezone: varchar("timezone", {
      length: 100,
    }).notNull(),

    status: varchar("status")
      .default("scheduled")
      .notNull(),

    output: jsonb("output"),
    error: text("error"),

    queuedAt: timestamp("queued_at", {
      withTimezone: true,
    }),

    startedAt: timestamp("started_at", {
      withTimezone: true,
    }),

    completedAt: timestamp("completed_at", {
      withTimezone: true,
    }),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
  },
  table => [
    uniqueIndex("unique_agent_occurrence").on(
      table.agentId,
      table.scheduledFor,
    ),

    index("agent_run_schedule_lookup").on(
      table.status,
      table.scheduledFor,
    ),
  ],
);

// Row shape returned by SELECTs against `users`.
export type User = typeof users.$inferSelect;
// Shape expected when inserting a new `users` row.
export type NewUser = typeof users.$inferInsert;
