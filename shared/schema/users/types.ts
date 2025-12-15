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
  userCalendarAccess,
} from './tables';
import {
  insertUserSchema,
  insertUserSessionSchema,
  insertLoginAttemptSchema,
  insertMagicLinkTokenSchema,
  insertUserOauthAccountSchema,
  upsertUserSchema,
  updateUserSchema,
  insertUserNotificationPreferencesSchema,
  updateUserNotificationPreferencesSchema,
  insertProjectViewSchema,
  insertCompanyViewSchema,
  insertUserColumnPreferencesSchema,
  updateUserColumnPreferencesSchema,
  insertDashboardSchema,
  updateDashboardSchema,
  insertDashboardCacheSchema,
  updateDashboardCacheSchema,
  insertUserProjectPreferencesSchema,
  updateUserProjectPreferencesSchema,
  insertUserCalendarAccessSchema,
} from './schemas';

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type UpsertUser = z.infer<typeof upsertUserSchema>;
export type UpdateUser = z.infer<typeof updateUserSchema>;

// Extended user type for authenticated users (includes computed properties from API)
export type AuthenticatedUser = User & {
  hasPassword?: boolean;  // Computed from passwordHash existence
};

export type UserSession = typeof userSessions.$inferSelect;
export type InsertUserSession = z.infer<typeof insertUserSessionSchema>;

export type LoginAttempt = typeof loginAttempts.$inferSelect;
export type InsertLoginAttempt = z.infer<typeof insertLoginAttemptSchema>;

export type UserNotificationPreference = typeof userNotificationPreferences.$inferSelect;
export type InsertUserNotificationPreference = z.infer<typeof insertUserNotificationPreferencesSchema>;
export type UpdateUserNotificationPreference = z.infer<typeof updateUserNotificationPreferencesSchema>;

export type MagicLinkToken = typeof magicLinkTokens.$inferSelect;
export type InsertMagicLinkToken = z.infer<typeof insertMagicLinkTokenSchema>;

export type UserOauthAccount = typeof userOauthAccounts.$inferSelect;
export type InsertUserOauthAccount = z.infer<typeof insertUserOauthAccountSchema>;

export type ProjectView = typeof projectViews.$inferSelect;
export type InsertProjectView = z.infer<typeof insertProjectViewSchema>;

export type CompanyView = typeof companyViews.$inferSelect;
export type InsertCompanyView = z.infer<typeof insertCompanyViewSchema>;

export type UserColumnPreference = typeof userColumnPreferences.$inferSelect;
export type InsertUserColumnPreference = z.infer<typeof insertUserColumnPreferencesSchema>;
export type UpdateUserColumnPreference = z.infer<typeof updateUserColumnPreferencesSchema>;

export type Dashboard = typeof dashboards.$inferSelect;
export type InsertDashboard = z.infer<typeof insertDashboardSchema>;
export type UpdateDashboard = z.infer<typeof updateDashboardSchema>;

export type DashboardCache = typeof dashboardCache.$inferSelect;
export type InsertDashboardCache = z.infer<typeof insertDashboardCacheSchema>;
export type UpdateDashboardCache = z.infer<typeof updateDashboardCacheSchema>;

export type UserProjectPreference = typeof userProjectPreferences.$inferSelect;
export type InsertUserProjectPreference = z.infer<typeof insertUserProjectPreferencesSchema>;
export type UpdateUserProjectPreference = z.infer<typeof updateUserProjectPreferencesSchema>;

export type UserCalendarAccess = typeof userCalendarAccess.$inferSelect;
export type InsertUserCalendarAccess = z.infer<typeof insertUserCalendarAccessSchema>;

// Backward compatibility aliases (legacy used plural names)
export type UserNotificationPreferences = UserNotificationPreference;
export type InsertUserNotificationPreferences = InsertUserNotificationPreference;
export type UpdateUserNotificationPreferences = UpdateUserNotificationPreference;
export type UserColumnPreferences = UserColumnPreference;
export type InsertUserColumnPreferences = InsertUserColumnPreference;
export type UpdateUserColumnPreferences = UpdateUserColumnPreference;
export type UserProjectPreferences = UserProjectPreference;
export type InsertUserProjectPreferences = InsertUserProjectPreference;
export type UpdateUserProjectPreferences = UpdateUserProjectPreference;
