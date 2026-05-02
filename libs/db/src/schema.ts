import { relations } from "drizzle-orm";
import { pgTable, text, timestamp, boolean, index, pgEnum, integer, jsonb } from "drizzle-orm/pg-core";

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_userId_idx").on(table.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("account_userId_idx").on(table.userId)],
);

// Role enum for user permissions
export const roleEnum = pgEnum("role", ["admin", "member", "viewer"]);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    token: text("token").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    subAgencyId: text("sub_agency_id"),
    role: roleEnum("role").notNull().default("member"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  }
);

export type CreateInvitationData = typeof verification.$inferInsert;
export type Verification = typeof verification.$inferSelect;

// Sub-Agency table
export const subAgency = pgTable(
  "sub_agency",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    description: text("description"),
    parentAgencyId: text("parent_agency_id"),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index("sub_agency_ownerId_idx").on(table.ownerId),
    index("sub_agency_parentAgencyId_idx").on(table.parentAgencyId),
  ]
);

// Agency-User join table with roles
export const agencyUser = pgTable(
  "agency_user",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    subAgencyId: text("sub_agency_id")
      .references(() => subAgency.id, { onDelete: "cascade" }),
    role: roleEnum("role").notNull().default("member"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index("agency_user_userId_idx").on(table.userId),
    index("agency_user_subAgencyId_idx").on(table.subAgencyId),
  ]
);

// Relations for sub-agencies
export const subAgencyRelations = relations(subAgency, ({ one, many }) => ({
  owner: one(user, {
    fields: [subAgency.ownerId],
    references: [user.id],
  }),
  parentAgency: one(subAgency, {
    fields: [subAgency.parentAgencyId],
    references: [subAgency.id],
    relationName: "subAgencies",
  }),
  childAgencies: many(subAgency, {
    relationName: "subAgencies",
  }),
  agencyUsers: many(agencyUser),
  emailAccounts: many(emailAccount),
  emailCampaigns: many(emailCampaign),
  emailTemplates: many(emailTemplate),
}));

// Relations for agency users
export const agencyUserRelations = relations(agencyUser, ({ one }) => ({
  user: one(user, {
    fields: [agencyUser.userId],
    references: [user.id],
  }),
  subAgency: one(subAgency, {
    fields: [agencyUser.subAgencyId],
    references: [subAgency.id],
  }),
}));

// API Key table
export const apiKey = pgTable(
  "api_key",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    hashedKey: text("hashed_key").notNull().unique(),
    prefix: text("prefix").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    subAgencyId: text("sub_agency_id").references(() => subAgency.id, {
      onDelete: "cascade",
    }),
    lastUsedAt: timestamp("last_used_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    expiresAt: timestamp("expires_at"),
  },
  (table) => [
    index("api_key_userId_idx").on(table.userId),
    index("api_key_hashedKey_idx").on(table.hashedKey),
    index("api_key_subAgencyId_idx").on(table.subAgencyId),
    index("api_key_userId_subAgencyId_idx").on(table.userId, table.subAgencyId),
  ]
);

// Email System Enums
export const emailProviderEnum = pgEnum("email_provider", ["gmail", "outlook", "imap"]);
export const emailAccountStatusEnum = pgEnum("email_account_status", ["connected", "disconnected", "error"]);
export const emailQueueStatusEnum = pgEnum("email_queue_status", ["pending", "processing", "sent", "failed", "bounced"]);
export const emailEventTypeEnum = pgEnum("email_event_type", ["sent", "opened", "clicked", "replied", "bounced", "unsubscribed"]);
export const campaignStatusEnum = pgEnum("campaign_status", ["draft", "scheduled", "sending", "completed", "paused"]);

// Email Account table - stores OAuth tokens and connection info for sending email accounts
export const emailAccount = pgTable (
  "email_account",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    subAgencyId: text("sub_agency_id").references(() => subAgency.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    provider: emailProviderEnum("provider").notNull(),
    encryptedAccessToken: text("encrypted_access_token"),
    encryptedRefreshToken: text("encrypted_refresh_token"),
    tokenExpiresAt: timestamp("token_expires_at"),
    scopes: text("scopes"),
    status: emailAccountStatusEnum("status").notNull().default("connected"),
    dailyQuota: integer("daily_quota").notNull().default(500), // Standard Gmail default
    quotaUsedToday: integer("quota_used_today").notNull().default(0),
    quotaResetAt: timestamp("quota_reset_at"),
    lastSyncedAt: timestamp("last_synced_at"),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("email_account_userId_idx").on(table.userId),
    index("email_account_subAgencyId_idx").on(table.subAgencyId),
    index("email_account_email_idx").on(table.email),
    index("email_account_status_idx").on(table.status),
    index("email_account_tokenExpiresAt_idx").on(table.tokenExpiresAt),
  ]
);

// Email Campaign table - tracks email campaigns
export const emailCampaign = pgTable(
  "email_campaign",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    subAgencyId: text("sub_agency_id").references(() => subAgency.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    status: campaignStatusEnum("status").notNull().default("draft"),
    totalRecipients: integer("total_recipients").notNull().default(0),
    sentCount: integer("sent_count").notNull().default(0),
    openCount: integer("open_count").notNull().default(0),
    clickCount: integer("click_count").notNull().default(0),
    replyCount: integer("reply_count").notNull().default(0),
    bounceCount: integer("bounce_count").notNull().default(0),
    unsubscribeCount: integer("unsubscribe_count").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("email_campaign_userId_idx").on(table.userId),
    index("email_campaign_subAgencyId_idx").on(table.subAgencyId),
    index("email_campaign_status_idx").on(table.status),
  ]
);

// Email Queue table - queues emails for sending
export const emailQueue = pgTable(
  "email_queue",
  {
    id: text("id").primaryKey(),
    campaignId: text("campaign_id")
      .notNull()
      .references(() => emailCampaign.id, { onDelete: "cascade" }),
    emailAccountId: text("email_account_id")
      .notNull()
      .references(() => emailAccount.id, { onDelete: "cascade" }),
    recipientEmail: text("recipient_email").notNull(),
    recipientName: text("recipient_name"),
    subject: text("subject").notNull(),
    bodyHtml: text("body_html"),
    bodyText: text("body_text"),
    scheduledFor: timestamp("scheduled_for").notNull().defaultNow(),
    status: emailQueueStatusEnum("status").notNull().default("pending"),
    priority: integer("priority").notNull().default(0),
    attemptCount: integer("attempt_count").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(3),
    lastAttemptAt: timestamp("last_attempt_at"),
    sentAt: timestamp("sent_at"),
    errorMessage: text("error_message"),
    trackingId: text("tracking_id").notNull().unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("email_queue_campaignId_idx").on(table.campaignId),
    index("email_queue_emailAccountId_idx").on(table.emailAccountId),
    index("email_queue_status_idx").on(table.status),
    index("email_queue_scheduledFor_idx").on(table.scheduledFor),
    index("email_queue_trackingId_idx").on(table.trackingId),
    index("email_queue_status_scheduledFor_idx").on(table.status, table.scheduledFor),
  ]
);

// Email Event table - tracks email events (opens, clicks, etc.)
export const emailEvent = pgTable(
  "email_event",
  {
    id: text("id").primaryKey(),
    queueId: text("queue_id")
      .notNull()
      .references(() => emailQueue.id, { onDelete: "cascade" }),
    trackingId: text("tracking_id").notNull(),
    eventType: emailEventTypeEnum("event_type").notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    timestamp: timestamp("timestamp").defaultNow().notNull(),
    metadata: jsonb("metadata"),
  },
  (table) => [
    index("email_event_queueId_idx").on(table.queueId),
    index("email_event_trackingId_idx").on(table.trackingId),
    index("email_event_eventType_idx").on(table.eventType),
    index("email_event_timestamp_idx").on(table.timestamp),
  ]
);

// Email Template table - stores email templates
export const emailTemplate = pgTable(
  "email_template",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    subAgencyId: text("sub_agency_id").references(() => subAgency.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    subject: text("subject").notNull(),
    bodyHtml: text("body_html"),
    bodyText: text("body_text"),
    variables: jsonb("variables"), // JSON array of variable names used in template
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("email_template_userId_idx").on(table.userId),
    index("email_template_subAgencyId_idx").on(table.subAgencyId),
  ]
);

// Email Unsubscribe table - global unsubscribe list
export const emailUnsubscribe = pgTable(
  "email_unsubscribe",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull().unique(),
    reason: text("reason"),
    campaignId: text("campaign_id").references(() => emailCampaign.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("email_unsubscribe_email_idx").on(table.email),
  ]
);

// Reply Follow-up enums + table
// Tracks scheduled follow-up sends for prospects who replied (with question/pricing intent)
// then went silent. README differentiator: "this is where the follow up actually decides the deal".
export const replyFollowupStatusEnum = pgEnum("reply_followup_status", ["scheduled", "sent", "cancelled"]);

export const replyFollowup = pgTable(
  "reply_followup",
  {
    id: text("id").primaryKey(),
    // Sequence in the README maps to "campaign" in the current schema.
    sequenceId: text("sequence_id")
      .notNull()
      .references(() => emailCampaign.id, { onDelete: "cascade" }),
    // Contact identity within a sequence is the original outbound email_queue row
    // (carries recipient_email + recipient_name + email account context).
    contactId: text("contact_id")
      .notNull()
      .references(() => emailQueue.id, { onDelete: "cascade" }),
    recipientEmail: text("recipient_email").notNull(),
    lastReplyAt: timestamp("last_reply_at").notNull(),
    lastReplyExcerpt: text("last_reply_excerpt"),
    scheduledSendAt: timestamp("scheduled_send_at").notNull(),
    status: replyFollowupStatusEnum("status").notNull().default("scheduled"),
    templateId: text("template_id").references(() => emailTemplate.id, { onDelete: "set null" }),
    // Queue row created when the follow-up is dispatched (null until sent).
    sentQueueId: text("sent_queue_id").references(() => emailQueue.id, { onDelete: "set null" }),
    cancelReason: text("cancel_reason"),
    sentAt: timestamp("sent_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("reply_followup_sequenceId_idx").on(table.sequenceId),
    index("reply_followup_contactId_idx").on(table.contactId),
    index("reply_followup_status_idx").on(table.status),
    index("reply_followup_scheduledSendAt_idx").on(table.scheduledSendAt),
    index("reply_followup_status_scheduledSendAt_idx").on(table.status, table.scheduledSendAt),
  ]
);

// All Relations (defined after all tables)
export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
  ownedAgencies: many(subAgency),
  agencyMemberships: many(agencyUser),
  apiKeys: many(apiKey),
  emailAccounts: many(emailAccount),
  emailCampaigns: many(emailCampaign),
  emailTemplates: many(emailTemplate),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}));

export const apiKeyRelations = relations(apiKey, ({ one }) => ({
  user: one(user, {
    fields: [apiKey.userId],
    references: [user.id],
  }),
  subAgency: one(subAgency, {
    fields: [apiKey.subAgencyId],
    references: [subAgency.id],
  }),
}));

// Email Relations
export const emailAccountRelations = relations(emailAccount, ({ one, many }) => ({
  user: one(user, {
    fields: [emailAccount.userId],
    references: [user.id],
  }),
  subAgency: one(subAgency, {
    fields: [emailAccount.subAgencyId],
    references: [subAgency.id],
  }),
  queueEntries: many(emailQueue),
}));

export const emailCampaignRelations = relations(emailCampaign, ({ one, many }) => ({
  user: one(user, {
    fields: [emailCampaign.userId],
    references: [user.id],
  }),
  subAgency: one(subAgency, {
    fields: [emailCampaign.subAgencyId],
    references: [subAgency.id],
  }),
  queueEntries: many(emailQueue),
  unsubscribes: many(emailUnsubscribe),
}));

export const emailQueueRelations = relations(emailQueue, ({ one, many }) => ({
  campaign: one(emailCampaign, {
    fields: [emailQueue.campaignId],
    references: [emailCampaign.id],
  }),
  emailAccount: one(emailAccount, {
    fields: [emailQueue.emailAccountId],
    references: [emailAccount.id],
  }),
  events: many(emailEvent),
}));

export const emailEventRelations = relations(emailEvent, ({ one }) => ({
  queueEntry: one(emailQueue, {
    fields: [emailEvent.queueId],
    references: [emailQueue.id],
  }),
}));

export const emailTemplateRelations = relations(emailTemplate, ({ one }) => ({
  user: one(user, {
    fields: [emailTemplate.userId],
    references: [user.id],
  }),
  subAgency: one(subAgency, {
    fields: [emailTemplate.subAgencyId],
    references: [subAgency.id],
  }),
}));

export const emailUnsubscribeRelations = relations(emailUnsubscribe, ({ one }) => ({
  campaign: one(emailCampaign, {
    fields: [emailUnsubscribe.campaignId],
    references: [emailCampaign.id],
  }),
}));

export const replyFollowupRelations = relations(replyFollowup, ({ one }) => ({
  campaign: one(emailCampaign, {
    fields: [replyFollowup.sequenceId],
    references: [emailCampaign.id],
  }),
  contact: one(emailQueue, {
    fields: [replyFollowup.contactId],
    references: [emailQueue.id],
    relationName: "replyFollowupContact",
  }),
  sentQueue: one(emailQueue, {
    fields: [replyFollowup.sentQueueId],
    references: [emailQueue.id],
    relationName: "replyFollowupSentQueue",
  }),
  template: one(emailTemplate, {
    fields: [replyFollowup.templateId],
    references: [emailTemplate.id],
  }),
}));

// Type exports for email system
export type EmailAccount = typeof emailAccount.$inferSelect;
export type InsertEmailAccount = typeof emailAccount.$inferInsert;
export type EmailCampaign = typeof emailCampaign.$inferSelect;
export type InsertEmailCampaign = typeof emailCampaign.$inferInsert;
export type EmailQueue = typeof emailQueue.$inferSelect;
export type InsertEmailQueue = typeof emailQueue.$inferInsert;
export type EmailEvent = typeof emailEvent.$inferSelect;
export type InsertEmailEvent = typeof emailEvent.$inferInsert;
export type EmailTemplate = typeof emailTemplate.$inferSelect;
export type InsertEmailTemplate = typeof emailTemplate.$inferInsert;
export type EmailUnsubscribe = typeof emailUnsubscribe.$inferSelect;
export type InsertEmailUnsubscribe = typeof emailUnsubscribe.$inferInsert;
export type ReplyFollowup = typeof replyFollowup.$inferSelect;
export type InsertReplyFollowup = typeof replyFollowup.$inferInsert;

