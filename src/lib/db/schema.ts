import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Stored E.164 without the plus: "919876543210". */
    phone: varchar("phone", { length: 20 }).notNull(),
    name: varchar("name", { length: 60 }),
    gender: varchar("gender", { length: 10 }),
    age: integer("age"),
    city: varchar("city", { length: 80 }),
    state: varchar("state", { length: 80 }),
    bio: text("bio"),
    danceStyles: text("dance_styles").array(),
    skillLevel: varchar("skill_level", { length: 20 }),
    avatarUrl: text("avatar_url"),
    profileComplete: boolean("profile_complete").notNull().default(false),

    /** Search economy. */
    freeSpinsUsed: integer("free_spins_used").notNull().default(0),
    paidSpins: integer("paid_spins").notNull().default(0),

    /** Safety. */
    strikes: integer("strikes").notNull().default(0),
    chatBannedUntil: timestamp("chat_banned_until", { withTimezone: true }),
    suspendedAt: timestamp("suspended_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("users_phone_idx").on(t.phone),
    index("users_discovery_idx").on(t.profileComplete, t.gender, t.city),
  ],
);

export const otpCodes = pgTable(
  "otp_codes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    phone: varchar("phone", { length: 20 }).notNull(),
    /** SHA-256 of the code plus a server pepper — never the code itself. */
    codeHash: text("code_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    attempts: integer("attempts").notNull().default(0),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("otp_phone_idx").on(t.phone, t.createdAt)],
);

/** One row per reel pull, free or paid. Also our "don't show them again" log. */
export const spins = pgTable(
  "spins",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    shownUserId: uuid("shown_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    paid: boolean("paid").notNull().default(false),
    genderFilter: varchar("gender_filter", { length: 10 }),
    cityFilter: varchar("city_filter", { length: 80 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("spins_user_idx").on(t.userId, t.createdAt)],
);

/** A one-way "dandiya" invite. Two of them facing each other make a match. */
export const interests = pgTable(
  "interests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    fromUserId: uuid("from_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    toUserId: uuid("to_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    status: varchar("status", { length: 12 }).notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("interests_pair_idx").on(t.fromUserId, t.toUserId),
    index("interests_inbox_idx").on(t.toUserId, t.status),
  ],
);

/** userAId is always the lexicographically smaller uuid, so the pair is unique. */
export const matches = pgTable(
  "matches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userAId: uuid("user_a_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    userBId: uuid("user_b_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
    closedAt: timestamp("closed_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("matches_pair_idx").on(t.userAId, t.userBId),
    index("matches_a_idx").on(t.userAId),
    index("matches_b_idx").on(t.userBId),
  ],
);

/**
 * The chat meter. One row per person per match, so buying time is a personal
 * purchase and one person running out never silences the other.
 */
export const chatSessions = pgTable(
  "chat_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    matchId: uuid("match_id").notNull().references(() => matches.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    purchasedSeconds: integer("purchased_seconds").notNull().default(0),
    consumedSeconds: integer("consumed_seconds").notNull().default(0),
    /** Last heartbeat. The gap since this is what we bill, capped. */
    lastTickAt: timestamp("last_tick_at", { withTimezone: true }),
    /** Last time this person had the conversation open, for unread counts. */
    lastReadAt: timestamp("last_read_at", { withTimezone: true }),
    /** Digits this sender recently emitted, for cross-message stitching. */
    carryDigits: varchar("carry_digits", { length: 24 }),
    carryUpdatedAt: timestamp("carry_updated_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("chat_sessions_member_idx").on(t.matchId, t.userId)],
);

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    matchId: uuid("match_id").notNull().references(() => matches.id, { onDelete: "cascade" }),
    senderId: uuid("sender_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("messages_match_idx").on(t.matchId, t.createdAt)],
);

/** Every block decision, kept for appeals and for spotting repeat offenders. */
export const moderationEvents = pgTable(
  "moderation_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    matchId: uuid("match_id").references(() => matches.id, { onDelete: "set null" }),
    context: varchar("context", { length: 16 }).notNull(),
    reasonCode: varchar("reason_code", { length: 32 }).notNull(),
    severity: varchar("severity", { length: 12 }).notNull(),
    /** Truncated original text. Needed to review a wrong block. */
    snippet: text("snippet"),
    matchedTerms: text("matched_terms").array(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("moderation_user_idx").on(t.userId, t.createdAt)],
);

export const reports = pgTable(
  "reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reporterId: uuid("reporter_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    reportedId: uuid("reported_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    matchId: uuid("match_id").references(() => matches.id, { onDelete: "set null" }),
    reason: varchar("reason", { length: 40 }).notNull(),
    details: text("details"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("reports_reported_idx").on(t.reportedId)],
);

export const blocks = pgTable(
  "blocks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blockerId: uuid("blocker_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    blockedId: uuid("blocked_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("blocks_pair_idx").on(t.blockerId, t.blockedId)],
);

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    packKey: varchar("pack_key", { length: 24 }).notNull(),
    kind: varchar("kind", { length: 10 }).notNull(),
    amountPaise: integer("amount_paise").notNull(),
    status: varchar("status", { length: 12 }).notNull().default("created"),
    provider: varchar("provider", { length: 16 }).notNull(),
    providerOrderId: text("provider_order_id"),
    providerPaymentId: text("provider_payment_id"),
    /** Chat packs are bought for one specific conversation. */
    matchId: uuid("match_id").references(() => matches.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    paidAt: timestamp("paid_at", { withTimezone: true }),
  },
  (t) => [
    index("payments_user_idx").on(t.userId, t.createdAt),
    uniqueIndex("payments_order_idx").on(t.providerOrderId),
  ],
);

export type User = typeof users.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type Match = typeof matches.$inferSelect;
export type ChatSession = typeof chatSessions.$inferSelect;
export type Payment = typeof payments.$inferSelect;
