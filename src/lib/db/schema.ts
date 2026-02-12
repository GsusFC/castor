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
    voiceMode: text('voice_mode', { enum: ['auto', 'brand', 'personal'] })
      .notNull()
      .default('auto'),
    isPremium: integer('is_premium', { mode: 'boolean' })
      .notNull()
      .default(false),
    // Ownership
    ownerId: text('owner_id').references(() => users.id, { onDelete: 'set null' }),
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
    status: text('status', { enum: ['draft', 'scheduled', 'publishing', 'published', 'failed', 'retrying'] })
      .notNull()
      .default('draft'),
    castHash: text('cast_hash'),
    parentHash: text('parent_hash'), // Para replies
    channelId: text('channel_id'), // Para publicar en un canal
    network: text('network', { enum: ['farcaster', 'x', 'linkedin'] }),
    publishTargets: text('publish_targets'), // JSON array de redes objetivo
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
    // Campos para videos de Cloudflare Stream
    cloudflareId: text('cloudflare_id'), // ID del video en Cloudflare Stream
    // Campos para videos de Livepeer
    livepeerAssetId: text('livepeer_asset_id'), // ID del asset en Livepeer
    livepeerPlaybackId: text('livepeer_playback_id'), // Playback ID de Livepeer
    videoStatus: text('video_status', { enum: ['pending', 'processing', 'ready', 'error'] }),
    mp4Url: text('mp4_url'), // URL del MP4 cuando esté listo
    hlsUrl: text('hls_url'), // URL HLS para streaming
    thumbnailUrl: text('thumbnail_url'), // URL del thumbnail
    // Dimensiones del video (para aspect ratio correcto)
    width: integer('width'),
    height: integer('height'),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    castIdx: index('media_cast_idx').on(table.castId),
    cloudflareIdx: index('media_cloudflare_idx').on(table.cloudflareId),
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
export const usersRelations = relations(users, ({ many, one }) => ({
  ownedAccounts: many(accounts),
  createdCasts: many(scheduledCasts),
  styleProfile: one(userStyleProfiles, {
    fields: [users.id],
    references: [userStyleProfiles.userId],
  }),
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

/**
 * Analytics de casts publicados
 */
export const castAnalytics = sqliteTable(
  'cast_analytics',
  {
    id: text('id').primaryKey(),
    castHash: text('cast_hash').notNull(),
    accountId: text('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    // Contenido del cast (para mostrar en dashboard)
    content: text('content'),
    // Métricas
    likes: integer('likes').notNull().default(0),
    recasts: integer('recasts').notNull().default(0),
    replies: integer('replies').notNull().default(0),
    // Timestamps
    publishedAt: integer('published_at', { mode: 'timestamp' }).notNull(),
    lastUpdatedAt: integer('last_updated_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    castHashIdx: index('analytics_cast_hash_idx').on(table.castHash),
    accountIdx: index('analytics_account_idx').on(table.accountId),
    publishedIdx: index('analytics_published_idx').on(table.publishedAt),
  })
)

export const castAnalyticsRelations = relations(castAnalytics, ({ one }) => ({
  account: one(accounts, {
    fields: [castAnalytics.accountId],
    references: [accounts.id],
  }),
}))

/**
 * Perfiles de estilo de escritura (para IA personalizada)
 */
export const userStyleProfiles = sqliteTable(
  'user_style_profiles',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' })
      .unique(),
    fid: integer('fid').notNull(),
    // Análisis de estilo
    tone: text('tone', { enum: ['casual', 'formal', 'technical', 'humorous', 'mixed'] })
      .notNull()
      .default('casual'),
    avgLength: integer('avg_length').notNull().default(150),
    commonPhrases: text('common_phrases'), // JSON array
    topics: text('topics'), // JSON array
    emojiUsage: text('emoji_usage', { enum: ['none', 'light', 'heavy'] })
      .notNull()
      .default('light'),
    languagePreference: text('language_preference', { enum: ['en', 'es', 'mixed'] })
      .notNull()
      .default('en'),
    sampleCasts: text('sample_casts'), // JSON array de ejemplos
    engagementInsights: text('engagement_insights'), // JSON object for storing topic engagement scores
    // Timestamps
    analyzedAt: integer('analyzed_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    userIdIdx: index('style_profiles_user_idx').on(table.userId),
    fidIdx: index('style_profiles_fid_idx').on(table.fid),
  })
)

export const userStyleProfilesRelations = relations(userStyleProfiles, ({ one }) => ({
  user: one(users, {
    fields: [userStyleProfiles.userId],
    references: [users.id],
  }),
}))

/**
 * Tracks casts that were generated by the AI assistant to analyze their performance.
 */
export const aiGeneratedCasts = sqliteTable(
  'ai_generated_casts',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    castHash: text('cast_hash').notNull().unique(),
    status: text('status', { enum: ['pending_analysis', 'analyzed', 'error'] })
      .notNull()
      .default('pending_analysis'),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
    analyzedAt: integer('analyzed_at', { mode: 'timestamp' }),
  },
  (table) => ({
    userIdx: index('ai_casts_user_idx').on(table.userId),
    statusIdx: index('ai_casts_status_idx').on(table.status),
  })
)

export const aiGeneratedCastsRelations = relations(aiGeneratedCasts, ({ one }) => ({
  user: one(users, {
    fields: [aiGeneratedCasts.userId],
    references: [users.id],
  }),
}))


/**
 * Miembros de cuentas compartidas
 */
export const accountMembers = sqliteTable(
  'account_members',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: text('role', { enum: ['owner', 'admin', 'member'] })
      .notNull()
      .default('member'),
    canEditContext: integer('can_edit_context', { mode: 'boolean' })
      .notNull()
      .default(false),
    invitedById: text('invited_by_id')
      .references(() => users.id, { onDelete: 'set null' }),
    joinedAt: integer('joined_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    accountUserIdx: index('account_members_account_user_idx').on(table.accountId, table.userId),
    userIdx: index('account_members_user_idx').on(table.userId),
  })
)

export const accountMembersRelations = relations(accountMembers, ({ one }) => ({
  account: one(accounts, {
    fields: [accountMembers.accountId],
    references: [accounts.id],
  }),
  user: one(users, {
    fields: [accountMembers.userId],
    references: [users.id],
  }),
  invitedBy: one(users, {
    fields: [accountMembers.invitedById],
    references: [users.id],
  }),
}))

/**
 * Knowledge Base por cuenta (contexto para IA)
 */
export const accountKnowledgeBase = sqliteTable(
  'account_knowledge_base',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' })
      .unique(),
    // Voz de marca
    brandVoice: text('brand_voice'),
    bio: text('bio'),
    expertise: text('expertise'), // JSON array
    // Reglas de contenido
    alwaysDo: text('always_do'), // JSON array
    neverDo: text('never_do'), // JSON array
    hashtags: text('hashtags'), // JSON array
    defaultTone: text('default_tone', { enum: ['casual', 'professional', 'friendly', 'witty', 'controversial'] })
      .default('casual'),
    defaultLanguage: text('default_language', { enum: ['en', 'es', 'fr', 'de', 'pt'] })
      .default('en'),
    // Notas internas
    internalNotes: text('internal_notes'), // JSON array
    // Timestamps
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedById: text('updated_by_id')
      .references(() => users.id, { onDelete: 'set null' }),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    accountIdx: index('kb_account_idx').on(table.accountId),
  })
)

export const accountKnowledgeBaseRelations = relations(accountKnowledgeBase, ({ one }) => ({
  account: one(accounts, {
    fields: [accountKnowledgeBase.accountId],
    references: [accounts.id],
  }),
  updatedBy: one(users, {
    fields: [accountKnowledgeBase.updatedById],
    references: [users.id],
  }),
}))

/**
 * Documentos del Knowledge Base
 */
export const accountDocuments = sqliteTable(
  'account_documents',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    type: text('type', { enum: ['markdown', 'text', 'url', 'pdf'] })
      .notNull()
      .default('text'),
    content: text('content').notNull(),
    sourceUrl: text('source_url'),
    addedById: text('added_by_id')
      .references(() => users.id, { onDelete: 'set null' }),
    addedAt: integer('added_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    accountIdx: index('docs_account_idx').on(table.accountId),
  })
)

export const accountDocumentsRelations = relations(accountDocuments, ({ one }) => ({
  account: one(accounts, {
    fields: [accountDocuments.accountId],
    references: [accounts.id],
  }),
  addedBy: one(users, {
    fields: [accountDocuments.addedById],
    references: [users.id],
  }),
}))

/**
 * Integración Typefully por usuario
 */
export const typefullyConnections = sqliteTable(
  'typefully_connections',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' })
      .unique(),
    encryptedApiKey: text('encrypted_api_key').notNull(),
    apiKeyLabel: text('api_key_label'),
    typefullyUserId: integer('typefully_user_id'),
    typefullyUserName: text('typefully_user_name'),
    typefullyUserEmail: text('typefully_user_email'),
    lastValidatedAt: integer('last_validated_at', { mode: 'timestamp' }),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    userIdx: index('typefully_connections_user_idx').on(table.userId),
  })
)

export const typefullyConnectionsRelations = relations(typefullyConnections, ({ one }) => ({
  user: one(users, {
    fields: [typefullyConnections.userId],
    references: [users.id],
  }),
}))

/**
 * Social sets de Typefully sincronizados y vinculables a cuentas Castor
 */
export const typefullySocialSets = sqliteTable(
  'typefully_social_sets',
  {
    id: text('id').primaryKey(),
    connectionId: text('connection_id')
      .notNull()
      .references(() => typefullyConnections.id, { onDelete: 'cascade' }),
    socialSetId: integer('social_set_id').notNull(),
    username: text('username').notNull(),
    name: text('name').notNull(),
    profileImageUrl: text('profile_image_url').notNull(),
    teamId: text('team_id'),
    teamName: text('team_name'),
    linkedAccountId: text('linked_account_id').references(() => accounts.id, { onDelete: 'set null' }),
    lastSyncedAt: integer('last_synced_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    connectionIdx: index('typefully_social_sets_connection_idx').on(table.connectionId),
    socialSetIdx: index('typefully_social_sets_social_set_idx').on(table.socialSetId),
    linkedAccountIdx: index('typefully_social_sets_linked_account_idx').on(table.linkedAccountId),
    connectionSocialSetUnique: index('typefully_social_sets_connection_social_set_unique').on(
      table.connectionId,
      table.socialSetId
    ),
  })
)

export const typefullySocialSetsRelations = relations(typefullySocialSets, ({ one }) => ({
  connection: one(typefullyConnections, {
    fields: [typefullySocialSets.connectionId],
    references: [typefullyConnections.id],
  }),
  linkedAccount: one(accounts, {
    fields: [typefullySocialSets.linkedAccountId],
    references: [accounts.id],
  }),
}))

/**
 * Canales del usuario (favoritos y recientes)
 */
export const userChannels = sqliteTable(
  'user_channels',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    channelId: text('channel_id').notNull(),
    channelName: text('channel_name').notNull(),
    channelImageUrl: text('channel_image_url'),
    isFavorite: integer('is_favorite', { mode: 'boolean' })
      .notNull()
      .default(false),
    isTabPinned: integer('is_tab_pinned', { mode: 'boolean' })
      .notNull()
      .default(false),
    pinnedOrder: integer('pinned_order').notNull().default(0),
    useCount: integer('use_count').notNull().default(0),
    lastUsedAt: integer('last_used_at', { mode: 'timestamp' }),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    userIdx: index('user_channels_user_idx').on(table.userId),
    channelIdx: index('user_channels_channel_idx').on(table.channelId),
    userChannelUnique: index('user_channels_unique').on(table.userId, table.channelId),
  })
)

export const userChannelsRelations = relations(userChannels, ({ one }) => ({
  user: one(users, {
    fields: [userChannels.userId],
    references: [users.id],
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
export type CastAnalytics = typeof castAnalytics.$inferSelect
export type NewCastAnalytics = typeof castAnalytics.$inferInsert
export type UserStyleProfile = typeof userStyleProfiles.$inferSelect
export type NewUserStyleProfile = typeof userStyleProfiles.$inferInsert
export type AccountMember = typeof accountMembers.$inferSelect
export type NewAccountMember = typeof accountMembers.$inferInsert
export type AccountKnowledgeBase = typeof accountKnowledgeBase.$inferSelect
export type NewAccountKnowledgeBase = typeof accountKnowledgeBase.$inferInsert
export type AccountDocument = typeof accountDocuments.$inferSelect
export type NewAccountDocument = typeof accountDocuments.$inferInsert
export type TypefullyConnection = typeof typefullyConnections.$inferSelect
export type NewTypefullyConnection = typeof typefullyConnections.$inferInsert
export type TypefullySocialSet = typeof typefullySocialSets.$inferSelect
export type NewTypefullySocialSet = typeof typefullySocialSets.$inferInsert
export type UserChannel = typeof userChannels.$inferSelect
export type NewUserChannel = typeof userChannels.$inferInsert

/**
 * Cache de insights de analytics por cuenta
 */
export const analyticsInsightsCache = sqliteTable(
  'analytics_insights_cache',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    insights: text('insights').notNull(), // JSON stringified
    stats: text('stats').notNull(), // JSON stringified
    generatedAt: integer('generated_at', { mode: 'timestamp' }).notNull(),
    expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  },
  (table) => ({
    accountIdx: index('analytics_insights_cache_account_idx').on(table.accountId),
  })
)

export type AnalyticsInsightsCache = typeof analyticsInsightsCache.$inferSelect
export type NewAnalyticsInsightsCache = typeof analyticsInsightsCache.$inferInsert

/**
 * Notificaciones de usuarios
 */
export const notifications = sqliteTable(
  'notifications',
  {
    id: text('id').primaryKey(),
    recipientFid: integer('recipient_fid').notNull(),
    type: text('type', {
      enum: ['like', 'recast', 'reply', 'mention', 'follow']
    }).notNull(),
    castHash: text('cast_hash'),
    actorFid: integer('actor_fid'),
    actorUsername: text('actor_username'),
    actorDisplayName: text('actor_display_name'),
    actorPfpUrl: text('actor_pfp_url'),
    content: text('content'),
    read: integer('read', { mode: 'boolean' }).notNull().default(false),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    recipientIdx: index('notifications_recipient_idx').on(table.recipientFid),
    createdIdx: index('notifications_created_idx').on(table.createdAt),
    readIdx: index('notifications_read_idx').on(table.read),
  })
)

export const notificationsRelations = relations(notifications, ({ one }) => ({
  recipient: one(users, {
    fields: [notifications.recipientFid],
    references: [users.fid],
  }),
}))

export type Notification = typeof notifications.$inferSelect
export type NewNotification = typeof notifications.$inferInsert
