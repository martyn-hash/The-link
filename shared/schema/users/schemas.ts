import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import {
  users,
  userSessions,
  loginAttempts,
  userNotificationPreferences,
  magicLinkTokens,
  userOauthAccounts,
  projectViews,
  companyViews,
  userColumnPreferences,
  dashboards,
  dashboardCache,
  userProjectPreferences,
} from './tables';

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastLoginAt: true,
});

export const insertUserSessionSchema = createInsertSchema(userSessions).omit({
  id: true,
  loginTime: true,
  lastActivity: true,
});

export const insertLoginAttemptSchema = createInsertSchema(loginAttempts).omit({
  id: true,
  timestamp: true,
});

export const insertMagicLinkTokenSchema = createInsertSchema(magicLinkTokens).omit({
  id: true,
  createdAt: true,
});

export const insertUserOauthAccountSchema = createInsertSchema(userOauthAccounts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const upsertUserSchema = createInsertSchema(users).omit({
  createdAt: true,
  updatedAt: true,
});

export const updateUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).partial();

export const insertUserNotificationPreferencesSchema = createInsertSchema(userNotificationPreferences).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateUserNotificationPreferencesSchema = insertUserNotificationPreferencesSchema.partial();

export const insertProjectViewSchema = createInsertSchema(projectViews).omit({
  id: true,
  createdAt: true,
});

export const insertCompanyViewSchema = createInsertSchema(companyViews).omit({
  id: true,
  createdAt: true,
});

export const insertUserColumnPreferencesSchema = createInsertSchema(userColumnPreferences).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateUserColumnPreferencesSchema = insertUserColumnPreferencesSchema.partial().omit({ userId: true });

export const insertDashboardSchema = createInsertSchema(dashboards).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateDashboardSchema = insertDashboardSchema.partial().omit({ userId: true });

export const insertDashboardCacheSchema = createInsertSchema(dashboardCache).omit({
  id: true,
  createdAt: true,
  lastUpdated: true,
});

export const updateDashboardCacheSchema = createInsertSchema(dashboardCache).omit({
  id: true,
  createdAt: true,
  userId: true,
}).partial();

export const insertUserProjectPreferencesSchema = createInsertSchema(userProjectPreferences).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  defaultViewType: z.enum(['list', 'kanban', 'calendar', 'dashboard']).nullable().optional(),
});

export const updateUserProjectPreferencesSchema = insertUserProjectPreferencesSchema.partial().omit({ userId: true });
