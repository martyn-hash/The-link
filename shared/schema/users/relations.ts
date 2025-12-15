import { relations } from 'drizzle-orm';
import {
  users,
  userSessions,
  userNotificationPreferences,
  magicLinkTokens,
  userOauthAccounts,
  projectViews,
  companyViews,
  userColumnPreferences,
  dashboards,
  dashboardCache,
  userProjectPreferences,
  userCalendarAccess,
} from './tables';

export const usersRelations = relations(users, ({ one, many }) => ({
  sessions: many(userSessions),
  notificationPreferences: one(userNotificationPreferences),
  magicLinkTokens: many(magicLinkTokens),
  oauthAccounts: many(userOauthAccounts),
  projectViews: many(projectViews),
  companyViews: many(companyViews),
  columnPreferences: many(userColumnPreferences),
  dashboards: many(dashboards),
  dashboardCache: one(dashboardCache),
  projectPreferences: one(userProjectPreferences),
}));

export const userSessionsRelations = relations(userSessions, ({ one }) => ({
  user: one(users, {
    fields: [userSessions.userId],
    references: [users.id],
  }),
}));

export const userNotificationPreferencesRelations = relations(userNotificationPreferences, ({ one }) => ({
  user: one(users, {
    fields: [userNotificationPreferences.userId],
    references: [users.id],
  }),
}));

export const magicLinkTokensRelations = relations(magicLinkTokens, ({ one }) => ({
  user: one(users, {
    fields: [magicLinkTokens.userId],
    references: [users.id],
  }),
}));

export const userOauthAccountsRelations = relations(userOauthAccounts, ({ one }) => ({
  user: one(users, {
    fields: [userOauthAccounts.userId],
    references: [users.id],
  }),
}));

export const projectViewsRelations = relations(projectViews, ({ one }) => ({
  user: one(users, {
    fields: [projectViews.userId],
    references: [users.id],
  }),
}));

export const companyViewsRelations = relations(companyViews, ({ one }) => ({
  user: one(users, {
    fields: [companyViews.userId],
    references: [users.id],
  }),
}));

export const userColumnPreferencesRelations = relations(userColumnPreferences, ({ one }) => ({
  user: one(users, {
    fields: [userColumnPreferences.userId],
    references: [users.id],
  }),
}));

export const dashboardsRelations = relations(dashboards, ({ one }) => ({
  user: one(users, {
    fields: [dashboards.userId],
    references: [users.id],
  }),
}));

export const dashboardCacheRelations = relations(dashboardCache, ({ one }) => ({
  user: one(users, {
    fields: [dashboardCache.userId],
    references: [users.id],
  }),
}));

export const userProjectPreferencesRelations = relations(userProjectPreferences, ({ one }) => ({
  user: one(users, {
    fields: [userProjectPreferences.userId],
    references: [users.id],
  }),
}));

export const userCalendarAccessRelations = relations(userCalendarAccess, ({ one }) => ({
  user: one(users, {
    fields: [userCalendarAccess.userId],
    references: [users.id],
    relationName: "calendarAccessOwner",
  }),
  canAccessUser: one(users, {
    fields: [userCalendarAccess.canAccessUserId],
    references: [users.id],
    relationName: "calendarAccessTarget",
  }),
  grantedByUser: one(users, {
    fields: [userCalendarAccess.grantedBy],
    references: [users.id],
    relationName: "calendarAccessGranter",
  }),
}));
