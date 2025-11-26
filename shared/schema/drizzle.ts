/**
 * Tables-Only Schema Export for Drizzle Initialization
 * 
 * This module exports ONLY tables and enums - NOT relations.
 * Use this for `drizzle()` constructor to avoid null prototype issues
 * with relation config objects.
 * 
 * For application code that needs relations, use the main barrel:
 * import { ... } from '@shared/schema'
 */

// Enums
export * from './enums';

// Users domain tables
export {
  users,
  userSessions,
  sessions,
  magicLinkTokens,
  loginAttempts,
  userOauthAccounts,
  userColumnPreferences,
  userProjectPreferences,
  dashboards,
  dashboardCache,
  companyViews,
  projectViews,
  userNotificationPreferences,
} from './users/tables';

// Clients domain tables
export {
  clients,
  companySettings,
  people,
  clientPeople,
  clientTags,
  clientTagAssignments,
  peopleTags,
  peopleTagAssignments,
  clientPortalUsers,
  clientPortalSessions,
  clientChronology,
  clientEmailAliases,
  clientDomainAllowlist,
} from './clients/tables';

// Services domain tables
export {
  services,
  clientServices,
  peopleServices,
  workRoles,
  serviceRoles,
  clientServiceRoleAssignments,
  chChangeRequests,
} from './services/tables';

// Projects domain tables
export { projectTypes } from './projects/base';
export {
  projects,
  projectChronology,
  kanbanStages,
  stageApprovals,
  stageApprovalFields,
  stageApprovalResponses,
  stageReasonMaps,
  reasonCustomFields,
  reasonFieldResponses,
  changeReasons,
  projectSchedulingHistory,
  schedulingRunLogs,
} from './projects/tables';

// Communications domain tables
export {
  communications,
  messageThreads,
  messages,
  userActivityTracking,
  userIntegrations,
  projectMessageThreads,
  projectMessages,
  projectMessageParticipants,
  staffMessageThreads,
  staffMessages,
  staffMessageParticipants,
} from './communications/tables';

// Documents domain tables
export {
  documentFolders,
  documents,
  signatureRequests,
  signatureRequestRecipients,
  signatureFields,
  signatures,
  signatureAuditLogs,
  signedDocuments,
} from './documents/tables';

// Email domain tables
export {
  emailMessages,
  mailboxMessageMap,
  emailThreads,
  unmatchedEmails,
  emailAttachments,
  emailMessageAttachments,
  graphWebhookSubscriptions,
  graphSyncState,
} from './email/tables';

// Tasks domain tables
export {
  taskTypes,
  taskInstances,
  taskInstanceResponses,
  internalTasks,
  taskTimeEntries,
  taskProgressNotes,
  taskDocuments,
  taskConnections,
} from './tasks/tables';

// Requests domain tables
export {
  clientRequestTemplateCategories,
  clientRequestTemplates,
  clientRequestTemplateSections,
  clientRequestTemplateQuestions,
  clientCustomRequests,
  clientCustomRequestSections,
  clientCustomRequestQuestions,
  riskAssessments,
  riskAssessmentResponses,
} from './requests/tables';

// Notifications domain tables
export {
  pushSubscriptions,
  pushNotificationTemplates,
  notificationIcons,
  projectTypeNotifications,
  scheduledNotifications,
  notificationHistory,
  clientRequestReminders,
} from './notifications/tables';
