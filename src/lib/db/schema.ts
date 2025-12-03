import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core'
import { relations } from 'drizzle-orm'

/**
 * Usuarios de la aplicación (login con Farcaster)
 */
export const users = sqliteTable(
  'users',
  {
    id: text('id').primaryKey(),
    fid: integer('fid').notNull().unique(),
    username: text('username').notNull(),
    displayName: text('display_name'),
    pfpUrl: text('pfp_url'),
    role: text('role', { enum: ['admin', 'member'] })
      .notNull()
      .default('admin'), // Por ahora todos son admin
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    fidIdx: index('users_fid_idx').on(table.fid),
  })
)

/**
 * Cuentas de Farcaster conectadas al estudio
 */
export const accounts = sqliteTable(
  'accounts',
  {
    id: text('id').primaryKey(),
    fid: integer('fid').notNull().unique(),
    username: text('username').notNull(),
    displayName: text('display_name'),
    pfpUrl: text('pfp_url'),
    signerUuid: text('signer_uuid').notNull(),
    signerStatus: text('signer_status', { enum: ['pending', 'approved', 'revoked'] })
      .notNull()
      .default('pending'),
    type: text('type', { enum: ['personal', 'business'] })
      .notNull()
      .default('personal'),
    isPremium: integer('is_premium', { mode: 'boolean' })
      .notNull()
      .default(false),
    // Ownership y sharing
    ownerId: text('owner_id').references(() => users.id, { onDelete: 'set null' }),
    isShared: integer('is_shared', { mode: 'boolean' })
      .notNull()
      .default(false),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    fidIdx: index('accounts_fid_idx').on(table.fid),
    signerIdx: index('accounts_signer_idx').on(table.signerUuid),
    ownerIdx: index('accounts_owner_idx').on(table.ownerId),
  })
)

/**
 * Casts programados
 */
export const scheduledCasts = sqliteTable(
  'scheduled_casts',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    content: text('content').notNull(),
    scheduledAt: integer('scheduled_at', { mode: 'timestamp' }).notNull(),
    publishedAt: integer('published_at', { mode: 'timestamp' }),
    status: text('status', { enum: ['draft', 'scheduled', 'publishing', 'published', 'failed'] })
      .notNull()
      .default('draft'),
    castHash: text('cast_hash'),
    parentHash: text('parent_hash'), // Para replies
    channelId: text('channel_id'), // Para publicar en un canal
    errorMessage: text('error_message'),
    retryCount: integer('retry_count').notNull().default(0),
    // Thread support
    threadId: text('thread_id'),
    threadOrder: integer('thread_order'),
    // Quién programó el cast
    createdById: text('created_by_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    accountIdx: index('casts_account_idx').on(table.accountId),
    statusIdx: index('casts_status_idx').on(table.status),
    scheduledIdx: index('casts_scheduled_idx').on(table.scheduledAt),
    threadIdx: index('casts_thread_idx').on(table.threadId),
    createdByIdx: index('casts_created_by_idx').on(table.createdById),
  })
)

/**
 * Media adjunta a los casts
 */
export const castMedia = sqliteTable(
  'cast_media',
  {
    id: text('id').primaryKey(),
    castId: text('cast_id')
      .notNull()
      .references(() => scheduledCasts.id, { onDelete: 'cascade' }),
    url: text('url').notNull(),
    type: text('type', { enum: ['image', 'video'] })
      .notNull()
      .default('image'),
    order: integer('order').notNull().default(0),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    castIdx: index('media_cast_idx').on(table.castId),
  })
)

/**
 * Templates de casts reutilizables
 */
export const templates = sqliteTable(
  'templates',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    content: text('content').notNull(),
    channelId: text('channel_id'), // Canal por defecto
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    accountIdx: index('templates_account_idx').on(table.accountId),
  })
)

/**
 * Threads (agrupación de casts)
 */
export const threads = sqliteTable(
  'threads',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    title: text('title'), // Título interno para identificar el thread
    status: text('status', { enum: ['draft', 'scheduled', 'publishing', 'published', 'failed'] })
      .notNull()
      .default('draft'),
    scheduledAt: integer('scheduled_at', { mode: 'timestamp' }),
    publishedAt: integer('published_at', { mode: 'timestamp' }),
    errorMessage: text('error_message'),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    accountIdx: index('threads_account_idx').on(table.accountId),
    statusIdx: index('threads_status_idx').on(table.status),
  })
)

// Relaciones
export const usersRelations = relations(users, ({ many }) => ({
  ownedAccounts: many(accounts),
  createdCasts: many(scheduledCasts),
}))

export const accountsRelations = relations(accounts, ({ one, many }) => ({
  owner: one(users, {
    fields: [accounts.ownerId],
    references: [users.id],
  }),
  scheduledCasts: many(scheduledCasts),
  threads: many(threads),
  templates: many(templates),
}))

export const scheduledCastsRelations = relations(scheduledCasts, ({ one, many }) => ({
  account: one(accounts, {
    fields: [scheduledCasts.accountId],
    references: [accounts.id],
  }),
  createdBy: one(users, {
    fields: [scheduledCasts.createdById],
    references: [users.id],
  }),
  media: many(castMedia),
}))

export const castMediaRelations = relations(castMedia, ({ one }) => ({
  cast: one(scheduledCasts, {
    fields: [castMedia.castId],
    references: [scheduledCasts.id],
  }),
}))

export const threadsRelations = relations(threads, ({ one }) => ({
  account: one(accounts, {
    fields: [threads.accountId],
    references: [accounts.id],
  }),
}))

export const templatesRelations = relations(templates, ({ one }) => ({
  account: one(accounts, {
    fields: [templates.accountId],
    references: [accounts.id],
  }),
}))

// Types inferidos
export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type Account = typeof accounts.$inferSelect
export type NewAccount = typeof accounts.$inferInsert
export type ScheduledCast = typeof scheduledCasts.$inferSelect
export type NewScheduledCast = typeof scheduledCasts.$inferInsert
export type CastMedia = typeof castMedia.$inferSelect
export type Thread = typeof threads.$inferSelect
export type Template = typeof templates.$inferSelect
export type NewTemplate = typeof templates.$inferInsert
