import {
  type User,
  type UpsertUser,
  type InsertUser,
  type UpdateUser,
  type UserSession,
  type InsertUserSession,
  type LoginAttempt,
  type InsertLoginAttempt,
  type Client,
  type InsertClient,
  type Person,
  type InsertPerson,
  type ClientPerson,
  type InsertClientPerson,
  type Project,
  type InsertProject,
  type ProjectChronology,
  type InsertProjectChronology,
  type SelectClientChronology,
  type InsertClientChronology,
  type KanbanStage,
  type InsertKanbanStage,
  type ChangeReason,
  type InsertChangeReason,
  type ProjectType,
  type InsertProjectType,
  type StageReasonMap,
  type InsertStageReasonMap,
  type ReasonCustomField,
  type InsertReasonCustomField,
  type ReasonFieldResponse,
  type InsertReasonFieldResponse,
  type StageApproval,
  type InsertStageApproval,
  type StageApprovalField,
  type InsertStageApprovalField,
  type StageApprovalResponse,
  type InsertStageApprovalResponse,
  type MagicLinkToken,
  type InsertMagicLinkToken,
  type UserNotificationPreferences,
  type InsertUserNotificationPreferences,
  type UpdateUserNotificationPreferences,
  type ProjectView,
  type InsertProjectView,
  type CompanyView,
  type InsertCompanyView,
  type UserColumnPreferences,
  type InsertUserColumnPreferences,
  type UpdateUserColumnPreferences,
  type Dashboard,
  type InsertDashboard,
  type UpdateDashboard,
  type UserProjectPreferences,
  type InsertUserProjectPreferences,
  type UpdateUserProjectPreferences,
  type Service,
  type InsertService,
  type WorkRole,
  type InsertWorkRole,
  type ServiceRole,
  type InsertServiceRole,
  type ClientService,
  type InsertClientService,
  type PeopleService,
  type InsertPeopleService,
  type ClientServiceRoleAssignment,
  type InsertClientServiceRoleAssignment,
  type ChChangeRequest,
  type InsertChChangeRequest,
  type UpdateChChangeRequest,
  type ClientTag,
  type InsertClientTag,
  type PeopleTag,
  type InsertPeopleTag,
  type ClientTagAssignment,
  type InsertClientTagAssignment,
  type PeopleTagAssignment,
  type InsertPeopleTagAssignment,
  type ProjectSchedulingHistory,
  type InsertProjectSchedulingHistory,
  type SchedulingRunLogs,
  type InsertSchedulingRunLogs,
  type ProjectWithRelations,
  type UpdateProjectStatus,
  type UpdateProjectType,
  type Communication,
  type InsertCommunication,
  type UserIntegration,
  type InsertUserIntegration,
  type UserActivityTracking,
  type InsertUserActivityTracking,
  type PushSubscription,
  type InsertPushSubscription,
  type PushNotificationTemplate,
  type InsertPushNotificationTemplate,
  type NotificationIcon,
  type InsertNotificationIcon,
  type DocumentFolder,
  type InsertDocumentFolder,
  type Document,
  type InsertDocument,
  type RiskAssessment,
  type InsertRiskAssessment,
  type RiskAssessmentResponse,
  type InsertRiskAssessmentResponse,
  type ClientPortalUser,
  type InsertClientPortalUser,
  type MessageThread,
  type InsertMessageThread,
  type Message,
  type InsertMessage,
  type ProjectMessageThread,
  type InsertProjectMessageThread,
  type ProjectMessage,
  type InsertProjectMessage,
  type ProjectMessageParticipant,
  type InsertProjectMessageParticipant,
  type StaffMessageThread,
  type InsertStaffMessageThread,
  type StaffMessage,
  type InsertStaffMessage,
  type StaffMessageParticipant,
  type InsertStaffMessageParticipant,
  type ClientRequestTemplateCategory,
  type InsertClientRequestTemplateCategory,
  type UpdateClientRequestTemplateCategory,
  type ClientRequestTemplate,
  type InsertClientRequestTemplate,
  type UpdateClientRequestTemplate,
  type ClientRequestTemplateSection,
  type InsertClientRequestTemplateSection,
  type UpdateClientRequestTemplateSection,
  type ClientRequestTemplateQuestion,
  type InsertClientRequestTemplateQuestion,
  type UpdateClientRequestTemplateQuestion,
  type ClientCustomRequest,
  type InsertClientCustomRequest,
  type UpdateClientCustomRequest,
  type ClientCustomRequestSection,
  type InsertClientCustomRequestSection,
  type UpdateClientCustomRequestSection,
  type ClientCustomRequestQuestion,
  type InsertClientCustomRequestQuestion,
  type UpdateClientCustomRequestQuestion,
  type TaskInstance,
  type InsertTaskInstance,
  type UpdateTaskInstance,
  type TaskInstanceResponse,
  type InsertTaskInstanceResponse,
  type TaskType,
  type InsertTaskType,
  type UpdateTaskType,
  type InternalTask,
  type InsertInternalTask,
  type UpdateInternalTask,
  type TaskConnection,
  type InsertTaskConnection,
  type TaskProgressNote,
  type InsertTaskProgressNote,
  type TaskTimeEntry,
  type InsertTaskTimeEntry,
  type StopTaskTimeEntry,
  type TaskDocument,
  type InsertTaskDocument,
  type ProjectTypeNotification,
  type InsertProjectTypeNotification,
  type UpdateProjectTypeNotification,
  type ClientRequestReminder,
  type InsertClientRequestReminder,
  type UpdateClientRequestReminder,
  type ScheduledNotification,
  type UpdateScheduledNotification,
  type NotificationHistory,
  type EmailThread,
  type InsertEmailThread,
  type EmailMessage,
  type InsertEmailMessage,
  type MailboxMessageMap,
  type InsertMailboxMessageMap,
  type UnmatchedEmail,
  type InsertUnmatchedEmail,
  type ClientEmailAlias,
  type InsertClientEmailAlias,
  type ClientDomainAllowlist,
  type InsertClientDomainAllowlist,
  type EmailAttachment,
  type InsertEmailAttachment,
  type EmailMessageAttachment,
  type InsertEmailMessageAttachment,
  type SignatureRequest,
  type InsertSignatureRequest,
  type SignatureRequestRecipient,
  type InsertSignatureRequestRecipient,
  type SignatureField,
  type InsertSignatureField,
  type SignatureAuditLog,
  type InsertSignatureAuditLog,
  type CompanySettings,
  type UpdateCompanySettings,
  userOauthAccounts,
} from "@shared/schema";

type UserOauthAccount = typeof userOauthAccounts.$inferSelect;
type InsertUserOauthAccount = typeof userOauthAccounts.$inferInsert;

export interface ScheduledServiceView {
  id: string;
  serviceId: string;
  serviceName: string;
  clientOrPersonName: string;
  clientOrPersonType: 'client' | 'person';
  nextStartDate: string | null;
  nextDueDate: string | null;
  currentProjectStartDate: string | null;
  currentProjectDueDate: string | null;
  projectTypeName: string | null;
  hasActiveProject: boolean;
  frequency: string;
  isActive: boolean;
  serviceOwnerId?: string;
  serviceOwnerName?: string;
}

export interface SearchResult {
  id: string;
  type: 'client' | 'person' | 'project' | 'communication';
  title: string;
  subtitle?: string;
  description?: string;
  metadata?: Record<string, any>;
}

export interface SuperSearchResults {
  clients: SearchResult[];
  people: SearchResult[];
  projects: SearchResult[];
  communications: SearchResult[];
  total: number;
}

export interface StageChangeNotificationPreview {
  project: Project;
  client: Client;
  currentAssignee: User | undefined;
  recipients: Array<{
    id: string;
    type: 'staff' | 'portal';
    email: string;
    name: string;
    role: string;
  }>;
  newStage: string;
  oldStage?: string;
}

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, userData: UpdateUser): Promise<User>;
  deleteUser(id: string): Promise<void>;
  getAllUsers(): Promise<User[]>;
  
  createAdminIfNone(user: InsertUser): Promise<{ success: boolean; user?: User; error?: string }>;
  
  startImpersonation(adminUserId: string, targetUserId: string): Promise<void>;
  stopImpersonation(adminUserId: string): Promise<void>;
  getImpersonationState(adminUserId: string): Promise<{ isImpersonating: boolean; originalUserId?: string; impersonatedUserId?: string }>;
  getEffectiveUser(adminUserId: string): Promise<User | undefined>;
  
  trackUserActivity(userId: string, entityType: string, entityId: string): Promise<void>;
  getRecentlyViewedByUser(userId: string, limit?: number): Promise<{ entityType: string; entityId: string; viewedAt: Date; entityData?: any }[]>;
  getUserActivityTracking(options?: { userId?: string; entityType?: string; dateFrom?: string; dateTo?: string; limit?: number }): Promise<(UserActivityTracking & { user: User; entityName: string | null })[]>;
  
  createUserSession(session: InsertUserSession): Promise<UserSession>;
  updateUserSessionActivity(userId: string): Promise<void>;
  getUserSessions(userId?: string, options?: { limit?: number; onlyActive?: boolean }): Promise<(UserSession & { user: User })[]>;
  markSessionAsLoggedOut(sessionId: string): Promise<void>;
  
  createLoginAttempt(attempt: InsertLoginAttempt): Promise<LoginAttempt>;
  getLoginAttempts(options?: { email?: string; limit?: number }): Promise<LoginAttempt[]>;
  
  cleanupOldSessions(daysToKeep: number): Promise<number>;
  cleanupOldLoginAttempts(daysToKeep: number): Promise<number>;
  markInactiveSessions(): Promise<number>;
  
  createClient(client: InsertClient): Promise<Client>;
  getClientById(id: string): Promise<Client | undefined>;
  getClientByName(name: string): Promise<Client | undefined>;
  getAllClients(search?: string): Promise<Client[]>;
  updateClient(id: string, client: Partial<InsertClient>): Promise<Client>;
  deleteClient(id: string): Promise<void>;
  
  superSearch(query: string, limit?: number): Promise<SuperSearchResults>;
  
  unlinkPersonFromClient(clientId: string, personId: string): Promise<void>;
  convertIndividualToCompanyClient(personId: string, companyData: Partial<InsertClient>, oldIndividualClientId?: string): Promise<{ newCompanyClient: Client; clientPerson: ClientPerson }>;
  
  getClientByCompanyNumber(companyNumber: string): Promise<Client | undefined>;
  upsertClientFromCH(clientData: Partial<InsertClient>): Promise<Client>;
  
  createPerson(person: InsertPerson): Promise<Person>;
  getPersonById(id: string): Promise<Person | undefined>;
  getPersonByPersonNumber(personNumber: string): Promise<Person | undefined>;
  getAllPeople(): Promise<Person[]>;
  getAllPeopleWithPortalStatus(): Promise<(Person & { portalUser?: ClientPortalUser; relatedCompanies: Client[] })[]>;
  getPersonWithDetails(id: string): Promise<(Person & { portalUser?: ClientPortalUser; relatedCompanies: (ClientPerson & { client: Client })[]; personalServices: (PeopleService & { service: Service })[] }) | undefined>;
  updatePerson(id: string, person: Partial<InsertPerson>): Promise<Person>;
  deletePerson(id: string): Promise<void>;
  
  createClientPerson(data: InsertClientPerson): Promise<ClientPerson>;
  getClientPersonsByClientId(clientId: string): Promise<(ClientPerson & { person: Person })[]>;
  getClientPersonsByPersonId(personId: string): Promise<(ClientPerson & { client: Client })[]>;
  updateClientPerson(clientId: string, personId: string, data: Partial<InsertClientPerson>): Promise<ClientPerson>;
  deleteClientPerson(clientId: string, personId: string): Promise<void>;
  
  createProject(project: InsertProject): Promise<Project>;
  getProjectById(id: string): Promise<ProjectWithRelations | undefined>;
  getProjectByIdLean(id: string): Promise<Project | undefined>;
  getProjectsByClientId(clientId: string): Promise<ProjectWithRelations[]>;
  getAllProjects(filters?: { month?: string; archived?: boolean; showArchived?: boolean; inactive?: boolean; serviceId?: string; assigneeId?: string; serviceOwnerId?: string; userId?: string; dynamicDateFilter?: string; dateFrom?: string; dateTo?: string; dueDate?: string }): Promise<ProjectWithRelations[]>;
  updateProject(id: string, project: Partial<InsertProject>): Promise<Project>;
  updateProjectStatus(id: string, data: UpdateProjectStatus): Promise<Project>;
  deleteProject(id: string): Promise<void>;
  
  getProjectChronologyByProjectId(projectId: string): Promise<ProjectChronology[]>;
  createProjectChronologyEntry(entry: InsertProjectChronology): Promise<ProjectChronology>;
  
  getClientChronologyByClientId(clientId: string): Promise<SelectClientChronology[]>;
  createClientChronologyEntry(entry: InsertClientChronology): Promise<SelectClientChronology>;
  
  getAllKanbanStages(): Promise<KanbanStage[]>;
  getKanbanStagesByProjectTypeId(projectTypeId: string): Promise<KanbanStage[]>;
  createKanbanStage(stage: InsertKanbanStage): Promise<KanbanStage>;
  updateKanbanStage(id: string, stage: Partial<InsertKanbanStage>): Promise<KanbanStage>;
  deleteKanbanStage(id: string): Promise<void>;
  reorderKanbanStages(stages: { id: string; order: number }[]): Promise<void>;
  
  getAllChangeReasons(): Promise<ChangeReason[]>;
  getChangeReasonById(id: string): Promise<ChangeReason | undefined>;
  createChangeReason(reason: InsertChangeReason): Promise<ChangeReason>;
  updateChangeReason(id: string, reason: Partial<InsertChangeReason>): Promise<ChangeReason>;
  deleteChangeReason(id: string): Promise<void>;
  
  getAllProjectTypes(): Promise<ProjectType[]>;
  getProjectTypeById(id: string): Promise<ProjectType | undefined>;
  createProjectType(projectType: InsertProjectType): Promise<ProjectType>;
  updateProjectType(id: string, projectType: UpdateProjectType): Promise<ProjectType>;
  deleteProjectType(id: string): Promise<void>;
  
  getStageReasonMapsByStageId(stageId: string): Promise<StageReasonMap[]>;
  createStageReasonMap(map: InsertStageReasonMap): Promise<StageReasonMap>;
  deleteStageReasonMap(id: string): Promise<void>;
  deleteStageReasonMapsByStageId(stageId: string): Promise<void>;
  
  getReasonCustomFieldsByReasonId(reasonId: string): Promise<ReasonCustomField[]>;
  createReasonCustomField(field: InsertReasonCustomField): Promise<ReasonCustomField>;
  updateReasonCustomField(id: string, field: Partial<InsertReasonCustomField>): Promise<ReasonCustomField>;
  deleteReasonCustomField(id: string): Promise<void>;
  
  createReasonFieldResponse(response: InsertReasonFieldResponse): Promise<ReasonFieldResponse>;
  getReasonFieldResponsesByChronologyId(chronologyId: string): Promise<ReasonFieldResponse[]>;
  
  getStageApprovalsByStageId(stageId: string): Promise<StageApproval[]>;
  getStageApprovalById(id: string): Promise<StageApproval | undefined>;
  createStageApproval(approval: InsertStageApproval): Promise<StageApproval>;
  updateStageApproval(id: string, approval: Partial<InsertStageApproval>): Promise<StageApproval>;
  deleteStageApproval(id: string): Promise<void>;
  
  getStageApprovalFieldsByApprovalId(approvalId: string): Promise<StageApprovalField[]>;
  createStageApprovalField(field: InsertStageApprovalField): Promise<StageApprovalField>;
  updateStageApprovalField(id: string, field: Partial<InsertStageApprovalField>): Promise<StageApprovalField>;
  deleteStageApprovalField(id: string): Promise<void>;
  
  createStageApprovalResponse(response: InsertStageApprovalResponse): Promise<StageApprovalResponse>;
  upsertStageApprovalResponse(response: InsertStageApprovalResponse): Promise<StageApprovalResponse>;
  getStageApprovalResponsesByProjectId(projectId: string): Promise<StageApprovalResponse[]>;
  
  validateStageApprovalResponses(approvalId: string, responses: InsertStageApprovalResponse[]): Promise<{ isValid: boolean; reason?: string; failedFields?: string[] }>;
  
  createMagicLinkToken(token: InsertMagicLinkToken): Promise<MagicLinkToken>;
  getMagicLinkTokenByToken(token: string): Promise<MagicLinkToken | undefined>;
  getMagicLinkTokenByCodeAndEmail(code: string, email: string): Promise<MagicLinkToken | undefined>;
  markMagicLinkTokenAsUsed(id: string): Promise<void>;
  cleanupExpiredMagicLinkTokens(): Promise<void>;
  getValidMagicLinkTokensForUser(userId: string): Promise<MagicLinkToken[]>;
  
  getUserNotificationPreferences(userId: string): Promise<UserNotificationPreferences | undefined>;
  createUserNotificationPreferences(preferences: InsertUserNotificationPreferences): Promise<UserNotificationPreferences>;
  updateUserNotificationPreferences(userId: string, preferences: UpdateUserNotificationPreferences): Promise<UserNotificationPreferences>;
  getOrCreateDefaultNotificationPreferences(userId: string): Promise<UserNotificationPreferences>;
  getUsersWithSchedulingNotifications(): Promise<User[]>;
  
  createProjectView(view: InsertProjectView): Promise<ProjectView>;
  getProjectViewsByUserId(userId: string): Promise<ProjectView[]>;
  deleteProjectView(id: string): Promise<void>;
  
  createCompanyView(view: InsertCompanyView): Promise<CompanyView>;
  getCompanyViewsByUserId(userId: string): Promise<CompanyView[]>;
  deleteCompanyView(id: string): Promise<void>;
  
  getUserColumnPreferences(userId: string, viewType?: string): Promise<UserColumnPreferences | undefined>;
  upsertUserColumnPreferences(preferences: InsertUserColumnPreferences): Promise<UserColumnPreferences>;
  updateUserColumnPreferences(userId: string, viewType: string, preferences: UpdateUserColumnPreferences): Promise<UserColumnPreferences>;
  
  createDashboard(dashboard: InsertDashboard): Promise<Dashboard>;
  getDashboardsByUserId(userId: string): Promise<Dashboard[]>;
  getSharedDashboards(): Promise<Dashboard[]>;
  getDashboardById(id: string): Promise<Dashboard | undefined>;
  updateDashboard(id: string, dashboard: UpdateDashboard): Promise<Dashboard>;
  deleteDashboard(id: string): Promise<void>;
  getHomescreenDashboard(userId: string): Promise<Dashboard | undefined>;
  clearHomescreenDashboards(userId: string): Promise<void>;
  
  getUserProjectPreferences(userId: string): Promise<UserProjectPreferences | undefined>;
  upsertUserProjectPreferences(preferences: InsertUserProjectPreferences): Promise<UserProjectPreferences>;
  deleteUserProjectPreferences(userId: string): Promise<void>;
  clearDefaultView(userId: string): Promise<void>;
  
  getProjectAnalytics(filters: any, groupBy: string, metric?: string): Promise<{ label: string; value: number }[]>;
  
  sendBulkProjectAssignmentNotifications(createdProjects: Project[]): Promise<void>;
  
  getUsersByRole(role: string): Promise<User[]>;
  
  prepareStageChangeNotification(projectId: string, newStageName: string, oldStageName?: string): Promise<StageChangeNotificationPreview | null>;
  sendStageChangeNotifications(projectId: string, newStageName: string, oldStageName?: string): Promise<void>;
  
  getAllServices(): Promise<(Service & { projectType: ProjectType; roles: WorkRole[] })[]>;
  getActiveServices(): Promise<(Service & { projectType: ProjectType; roles: WorkRole[] })[]>;
  getServicesWithActiveClients(): Promise<Service[]>;
  getClientAssignableServices(): Promise<(Service & { projectType: ProjectType; roles: WorkRole[] })[]>;
  getProjectTypeAssignableServices(): Promise<(Service & { projectType: ProjectType; roles: WorkRole[] })[]>;
  getServiceById(id: string): Promise<Service | undefined>;
  getServiceByName(name: string): Promise<Service | undefined>;
  getScheduledServices(): Promise<ScheduledServiceView[]>;
  createService(service: InsertService): Promise<Service>;
  updateService(id: string, service: Partial<InsertService>): Promise<Service>;
  deleteService(id: string): Promise<void>;
  getServiceByProjectTypeId(projectTypeId: string): Promise<Service | undefined>;

  getAllWorkRoles(): Promise<WorkRole[]>;
  getWorkRoleById(id: string): Promise<WorkRole | undefined>;
  getWorkRoleByName(name: string): Promise<WorkRole | undefined>;
  createWorkRole(role: InsertWorkRole): Promise<WorkRole>;
  updateWorkRole(id: string, role: Partial<InsertWorkRole>): Promise<WorkRole>;
  deleteWorkRole(id: string): Promise<void>;

  getServiceRolesByServiceId(serviceId: string): Promise<ServiceRole[]>;
  getWorkRolesByServiceId(serviceId: string): Promise<WorkRole[]>;
  addRoleToService(serviceId: string, roleId: string): Promise<ServiceRole>;
  removeRoleFromService(serviceId: string, roleId: string): Promise<void>;

  getAllClientServices(): Promise<(ClientService & { client: Client; service: Service & { projectType: ProjectType } })[]>;
  getClientServiceById(id: string): Promise<(ClientService & { 
    client: Client; 
    service: Service & { projectType: ProjectType }; 
    serviceOwner?: User;
    roleAssignments: (ClientServiceRoleAssignment & { workRole: WorkRole; user: User })[];
  }) | undefined>;
  getClientServicesByClientId(clientId: string): Promise<(ClientService & { 
    service: Service & { projectType: ProjectType }; 
    serviceOwner?: User; 
    roleAssignments: (ClientServiceRoleAssignment & { workRole: WorkRole; user: User })[];
  })[]>;
  getClientServicesByServiceId(serviceId: string): Promise<(ClientService & { client: Client })[]>;
  createClientService(clientService: InsertClientService): Promise<ClientService>;
  updateClientService(id: string, clientService: Partial<InsertClientService>): Promise<ClientService>;
  deleteClientService(id: string): Promise<void>;
  
  getAllPeopleServices(): Promise<(PeopleService & { person: Person; service: Service & { projectType: ProjectType } })[]>;
  getPeopleServiceById(id: string): Promise<(PeopleService & { 
    person: Person; 
    service: Service & { projectType: ProjectType }; 
    serviceOwner?: User;
  }) | undefined>;
  getPeopleServicesByPersonId(personId: string): Promise<(PeopleService & { 
    service: Service & { projectType: ProjectType }; 
    serviceOwner?: User; 
  })[]>;
  getPeopleServicesByServiceId(serviceId: string): Promise<(PeopleService & { person: Person })[]>;
  createPeopleService(peopleService: InsertPeopleService): Promise<PeopleService>;
  updatePeopleService(id: string, peopleService: Partial<InsertPeopleService>): Promise<PeopleService>;
  deletePeopleService(id: string): Promise<void>;
  
  getClientServiceRoleAssignments(clientServiceId: string): Promise<(ClientServiceRoleAssignment & { workRole: WorkRole; user: User })[]>;
  createClientServiceRoleAssignment(assignment: InsertClientServiceRoleAssignment): Promise<ClientServiceRoleAssignment>;
  updateClientServiceRoleAssignment(id: string, assignment: Partial<InsertClientServiceRoleAssignment>): Promise<ClientServiceRoleAssignment>;
  deleteClientServiceRoleAssignment(id: string): Promise<void>;
  
  getChChangeRequestsByClientId(clientId: string): Promise<ChChangeRequest[]>;
  getChChangeRequestById(id: string): Promise<ChChangeRequest | undefined>;
  createChChangeRequest(request: InsertChChangeRequest): Promise<ChChangeRequest>;
  updateChChangeRequest(id: string, request: UpdateChChangeRequest): Promise<ChChangeRequest>;
  deleteChChangeRequest(id: string): Promise<void>;
  getPendingChChangeRequests(): Promise<ChChangeRequest[]>;
  
  getAllClientTags(): Promise<ClientTag[]>;
  getClientTagById(id: string): Promise<ClientTag | undefined>;
  createClientTag(tag: InsertClientTag): Promise<ClientTag>;
  updateClientTag(id: string, tag: Partial<InsertClientTag>): Promise<ClientTag>;
  deleteClientTag(id: string): Promise<void>;
  
  getAllPeopleTags(): Promise<PeopleTag[]>;
  getPeopleTagById(id: string): Promise<PeopleTag | undefined>;
  createPeopleTag(tag: InsertPeopleTag): Promise<PeopleTag>;
  updatePeopleTag(id: string, tag: Partial<InsertPeopleTag>): Promise<PeopleTag>;
  deletePeopleTag(id: string): Promise<void>;
  
  getClientTagAssignmentsByClientId(clientId: string): Promise<(ClientTagAssignment & { tag: ClientTag })[]>;
  createClientTagAssignment(assignment: InsertClientTagAssignment): Promise<ClientTagAssignment>;
  deleteClientTagAssignment(clientId: string, tagId: string): Promise<void>;
  
  getPeopleTagAssignmentsByPersonId(personId: string): Promise<(PeopleTagAssignment & { tag: PeopleTag })[]>;
  createPeopleTagAssignment(assignment: InsertPeopleTagAssignment): Promise<PeopleTagAssignment>;
  deletePeopleTagAssignment(personId: string, tagId: string): Promise<void>;
  
  createProjectSchedulingHistory(history: InsertProjectSchedulingHistory): Promise<ProjectSchedulingHistory>;
  getProjectSchedulingHistoryByProjectId(projectId: string): Promise<ProjectSchedulingHistory[]>;
  getProjectSchedulingHistory(options?: { serviceId?: string; clientId?: string; personId?: string; limit?: number }): Promise<ProjectSchedulingHistory[]>;
  
  createSchedulingRunLog(log: InsertSchedulingRunLogs): Promise<SchedulingRunLogs>;
  getLatestSchedulingRuns(limit?: number): Promise<SchedulingRunLogs[]>;
  
  getAllCommunications(): Promise<Communication[]>;
  getCommunicationsByClientId(clientId: string): Promise<Communication[]>;
  getCommunicationById(id: string): Promise<Communication | undefined>;
  createCommunication(communication: InsertCommunication): Promise<Communication>;
  updateCommunication(id: string, communication: Partial<InsertCommunication>): Promise<Communication>;
  deleteCommunication(id: string): Promise<void>;
  
  getUserIntegrations(userId: string): Promise<UserIntegration[]>;
  getUserIntegration(userId: string, provider: string): Promise<UserIntegration | undefined>;
  createUserIntegration(integration: InsertUserIntegration): Promise<UserIntegration>;
  updateUserIntegration(id: string, integration: Partial<InsertUserIntegration>): Promise<UserIntegration>;
  deleteUserIntegration(userId: string, provider: string): Promise<void>;
  
  getUserOauthAccount(userId: string, provider: string): Promise<UserOauthAccount | undefined>;
  createUserOauthAccount(account: InsertUserOauthAccount): Promise<UserOauthAccount>;
  updateUserOauthAccount(userId: string, provider: string, account: Partial<InsertUserOauthAccount>): Promise<UserOauthAccount>;
  deleteUserOauthAccount(userId: string, provider: string): Promise<void>;
  
  getPushSubscriptionsByUserId(userId: string): Promise<PushSubscription[]>;
  createPushSubscription(subscription: InsertPushSubscription): Promise<PushSubscription>;
  deletePushSubscription(id: string): Promise<void>;
  deletePushSubscriptionByEndpoint(endpoint: string): Promise<void>;
  
  getAllPushNotificationTemplates(): Promise<PushNotificationTemplate[]>;
  getPushNotificationTemplateById(id: string): Promise<PushNotificationTemplate | undefined>;
  getPushNotificationTemplateByType(templateType: string): Promise<PushNotificationTemplate | undefined>;
  createPushNotificationTemplate(template: InsertPushNotificationTemplate): Promise<PushNotificationTemplate>;
  updatePushNotificationTemplate(id: string, template: Partial<InsertPushNotificationTemplate>): Promise<PushNotificationTemplate>;
  deletePushNotificationTemplate(id: string): Promise<void>;
  
  getAllNotificationIcons(): Promise<NotificationIcon[]>;
  getNotificationIconById(id: string): Promise<NotificationIcon | undefined>;
  createNotificationIcon(icon: InsertNotificationIcon): Promise<NotificationIcon>;
  updateNotificationIcon(id: string, icon: Partial<InsertNotificationIcon>): Promise<NotificationIcon>;
  deleteNotificationIcon(id: string): Promise<void>;
  
  createEmailThread(thread: InsertEmailThread): Promise<EmailThread>;
  getEmailThreadByConversationId(conversationId: string): Promise<EmailThread | undefined>;
  getEmailThreadById(id: string): Promise<EmailThread | undefined>;
  getEmailThreadsByClientId(clientId: string): Promise<EmailThread[]>;
  updateEmailThread(id: string, thread: Partial<InsertEmailThread>): Promise<EmailThread>;
  
  createEmailMessage(message: InsertEmailMessage): Promise<EmailMessage>;
  getEmailMessageByInternetMessageId(internetMessageId: string): Promise<EmailMessage | undefined>;
  getEmailMessageById(id: string): Promise<EmailMessage | undefined>;
  getEmailMessagesByThreadId(threadId: string): Promise<EmailMessage[]>;
  updateEmailMessage(id: string, message: Partial<InsertEmailMessage>): Promise<EmailMessage>;
  
  createMailboxMessageMap(map: InsertMailboxMessageMap): Promise<MailboxMessageMap>;
  getMailboxMessageMapsByUserId(userId: string): Promise<MailboxMessageMap[]>;
  getMailboxMessageMapByGraphId(userId: string, graphMessageId: string): Promise<MailboxMessageMap | undefined>;
  deleteMailboxMessageMapsByUserId(userId: string): Promise<void>;
  
  getUnmatchedEmails(): Promise<UnmatchedEmail[]>;
  createUnmatchedEmail(email: InsertUnmatchedEmail): Promise<UnmatchedEmail>;
  updateUnmatchedEmail(id: string, email: Partial<InsertUnmatchedEmail>): Promise<UnmatchedEmail>;
  deleteUnmatchedEmail(id: string): Promise<void>;
  
  getClientEmailAliases(clientId: string): Promise<ClientEmailAlias[]>;
  getAllClientEmailAliases(): Promise<ClientEmailAlias[]>;
  createClientEmailAlias(alias: InsertClientEmailAlias): Promise<ClientEmailAlias>;
  deleteClientEmailAlias(id: string): Promise<void>;
  getClientByEmailAlias(email: string): Promise<{ clientId: string } | undefined>;
  
  createClientDomainAllowlist(domain: InsertClientDomainAllowlist): Promise<ClientDomainAllowlist>;
  getClientDomainAllowlist(): Promise<ClientDomainAllowlist[]>;
  getClientByDomain(domain: string): Promise<{ clientId: string } | undefined>;
  deleteClientDomainAllowlist(id: string): Promise<void>;

  createEmailAttachment(attachment: InsertEmailAttachment): Promise<EmailAttachment>;
  getEmailAttachmentByHash(contentHash: string): Promise<EmailAttachment | undefined>;
  getEmailAttachmentById(id: string): Promise<EmailAttachment | undefined>;
  createEmailMessageAttachment(mapping: InsertEmailMessageAttachment): Promise<EmailMessageAttachment>;
  getAttachmentsByMessageId(internetMessageId: string): Promise<EmailAttachment[]>;
  checkEmailMessageAttachmentExists(internetMessageId: string, attachmentId: string): Promise<boolean>;
  getSignedUrl(objectPath: string): Promise<string>;

  createDocumentFolder(folder: InsertDocumentFolder): Promise<DocumentFolder>;
  getDocumentFolderById(id: string): Promise<DocumentFolder | undefined>;
  getDocumentFoldersByClientId(clientId: string): Promise<any[]>;
  deleteDocumentFolder(id: string): Promise<void>;
  
  createDocument(document: InsertDocument): Promise<Document>;
  getDocumentById(id: string): Promise<Document | undefined>;
  getDocumentsByClientId(clientId: string): Promise<Document[]>;
  getDocumentsByFolderId(folderId: string): Promise<any[]>;
  deleteDocument(id: string): Promise<void>;
  
  listPortalDocuments(clientId: string, clientPortalUserId: string): Promise<Document[]>;
  createPortalDocument(document: InsertDocument): Promise<Document>;
  deletePortalDocument(id: string, clientId: string, clientPortalUserId: string): Promise<void>;
  getPortalDocumentById(id: string, clientId: string, clientPortalUserId: string): Promise<Document | undefined>;
  
  createRiskAssessment(assessment: InsertRiskAssessment): Promise<RiskAssessment>;
  getRiskAssessmentById(id: string): Promise<RiskAssessment | undefined>;
  getRiskAssessmentsByClientId(clientId: string): Promise<RiskAssessment[]>;
  updateRiskAssessment(id: string, assessment: Partial<InsertRiskAssessment>): Promise<RiskAssessment>;
  deleteRiskAssessment(id: string): Promise<void>;
  
  saveRiskAssessmentResponses(assessmentId: string, responses: InsertRiskAssessmentResponse[]): Promise<void>;
  getRiskAssessmentResponses(assessmentId: string): Promise<RiskAssessmentResponse[]>;
  
  createClientPortalUser(user: InsertClientPortalUser): Promise<ClientPortalUser>;
  getClientPortalUserById(id: string): Promise<ClientPortalUser | undefined>;
  getClientPortalUserByEmail(email: string): Promise<ClientPortalUser | undefined>;
  getClientPortalUserByMagicLinkToken(token: string): Promise<ClientPortalUser | undefined>;
  getClientPortalUsersByClientId(clientId: string): Promise<ClientPortalUser[]>;
  getClientPortalUserByPersonId(personId: string): Promise<ClientPortalUser | undefined>;
  updateClientPortalUser(id: string, user: Partial<InsertClientPortalUser>): Promise<ClientPortalUser>;
  deleteClientPortalUser(id: string): Promise<void>;
  
  createMessageThread(thread: InsertMessageThread): Promise<MessageThread>;
  getMessageThreadById(id: string): Promise<MessageThread | undefined>;
  getMessageThreadsByClientId(clientId: string, filters?: { status?: string }): Promise<MessageThread[]>;
  getMessageThreadsWithUnreadCount(clientId: string, status?: string): Promise<(MessageThread & { unreadCount: number })[]>;
  getAllMessageThreads(filters?: { status?: string; clientId?: string }): Promise<MessageThread[]>;
  updateMessageThread(id: string, thread: Partial<InsertMessageThread>): Promise<MessageThread>;
  deleteMessageThread(id: string): Promise<void>;
  
  createMessage(message: InsertMessage): Promise<Message>;
  getMessageById(id: string): Promise<Message | undefined>;
  getMessagesByThreadId(threadId: string): Promise<Message[]>;
  updateMessage(id: string, message: Partial<InsertMessage>): Promise<Message>;
  deleteMessage(id: string): Promise<void>;
  markMessagesAsReadByStaff(threadId: string): Promise<void>;
  markMessagesAsReadByClient(threadId: string): Promise<void>;
  getUnreadMessageCountForClient(clientId: string): Promise<number>;
  getUnreadMessageCountForStaff(userId: string, isAdmin?: boolean): Promise<number>;
  
  createProjectMessageThread(thread: InsertProjectMessageThread): Promise<ProjectMessageThread>;
  getProjectMessageThreadById(id: string): Promise<ProjectMessageThread | undefined>;
  getProjectMessageThreadsByProjectId(projectId: string): Promise<ProjectMessageThread[]>;
  getProjectMessageThreadsForUser(userId: string, filters?: { includeArchived?: boolean }): Promise<Array<ProjectMessageThread & {
    project: { id: string; description: string; clientId: string };
    client: { id: string; name: string };
    unreadCount: number;
    lastMessage: { content: string; createdAt: Date; userId: string | null } | null;
    participants: Array<{ id: string; email: string; firstName: string | null; lastName: string | null }>;
  }>>;
  updateProjectMessageThread(id: string, thread: Partial<InsertProjectMessageThread>): Promise<ProjectMessageThread>;
  deleteProjectMessageThread(id: string): Promise<void>;
  archiveProjectMessageThread(id: string, archivedBy: string): Promise<ProjectMessageThread>;
  unarchiveProjectMessageThread(id: string): Promise<ProjectMessageThread>;
  
  createProjectMessage(message: InsertProjectMessage): Promise<ProjectMessage>;
  getProjectMessageById(id: string): Promise<ProjectMessage | undefined>;
  getProjectMessagesByThreadId(threadId: string): Promise<ProjectMessage[]>;
  updateProjectMessage(id: string, message: Partial<InsertProjectMessage>): Promise<ProjectMessage>;
  deleteProjectMessage(id: string): Promise<void>;
  
  createProjectMessageParticipant(participant: InsertProjectMessageParticipant): Promise<ProjectMessageParticipant>;
  getProjectMessageParticipantsByThreadId(threadId: string): Promise<ProjectMessageParticipant[]>;
  getProjectMessageParticipantsByUserId(userId: string): Promise<ProjectMessageParticipant[]>;
  updateProjectMessageParticipant(id: string, participant: Partial<InsertProjectMessageParticipant>): Promise<ProjectMessageParticipant>;
  deleteProjectMessageParticipant(id: string): Promise<void>;
  markProjectMessagesAsRead(threadId: string, userId: string, lastReadMessageId: string): Promise<void>;
  updateParticipantReminderSent(threadId: string, userId: string): Promise<void>;
  getUnreadProjectMessageCountForUser(userId: string): Promise<number>;
  getProjectMessageParticipantsNeedingReminders(hoursThreshold: number): Promise<Array<{
    threadId: string;
    userId: string;
    userEmail: string;
    userName: string;
    projectDescription: string;
    clientName: string;
    unreadCount: number;
  }>>;
  
  createStaffMessageThread(thread: InsertStaffMessageThread): Promise<StaffMessageThread>;
  getStaffMessageThreadById(id: string): Promise<StaffMessageThread | undefined>;
  getStaffMessageThreadsForUser(userId: string): Promise<Array<StaffMessageThread & {
    unreadCount: number;
    lastMessage: { content: string; createdAt: Date; userId: string | null } | null;
    participants: Array<{ id: string; email: string; firstName: string | null; lastName: string | null }>;
  }>>;
  updateStaffMessageThread(id: string, thread: Partial<InsertStaffMessageThread>): Promise<StaffMessageThread>;
  deleteStaffMessageThread(id: string): Promise<void>;
  archiveStaffMessageThread(id: string, archivedBy: string): Promise<StaffMessageThread>;
  
  createStaffMessage(message: InsertStaffMessage): Promise<StaffMessage>;
  getStaffMessageById(id: string): Promise<StaffMessage | undefined>;
  getStaffMessagesByThreadId(threadId: string): Promise<StaffMessage[]>;
  updateStaffMessage(id: string, message: Partial<InsertStaffMessage>): Promise<StaffMessage>;
  deleteStaffMessage(id: string): Promise<void>;
  
  createStaffMessageParticipant(participant: InsertStaffMessageParticipant): Promise<StaffMessageParticipant>;
  getStaffMessageParticipantsByThreadId(threadId: string): Promise<StaffMessageParticipant[]>;
  updateStaffMessageParticipant(id: string, participant: Partial<InsertStaffMessageParticipant>): Promise<StaffMessageParticipant>;
  deleteStaffMessageParticipant(id: string): Promise<void>;
  markStaffMessagesAsRead(threadId: string, participantId: string, lastReadMessageId: string): Promise<void>;
  getUnreadStaffMessageCountForUser(userId: string): Promise<number>;
  
  getAllClientRequestTemplateCategories(): Promise<ClientRequestTemplateCategory[]>;
  getClientRequestTemplateCategoryById(id: string): Promise<ClientRequestTemplateCategory | undefined>;
  createClientRequestTemplateCategory(category: InsertClientRequestTemplateCategory): Promise<ClientRequestTemplateCategory>;
  updateClientRequestTemplateCategory(id: string, category: UpdateClientRequestTemplateCategory): Promise<ClientRequestTemplateCategory>;
  deleteClientRequestTemplateCategory(id: string): Promise<void>;
  
  getAllClientRequestTemplates(): Promise<(ClientRequestTemplate & { category: ClientRequestTemplateCategory | null })[]>;
  getClientRequestTemplateById(id: string): Promise<(ClientRequestTemplate & { 
    category: ClientRequestTemplateCategory | null;
    sections: (ClientRequestTemplateSection & { questions: ClientRequestTemplateQuestion[] })[];
  }) | undefined>;
  getClientRequestTemplatesByCategoryId(categoryId: string): Promise<ClientRequestTemplate[]>;
  createClientRequestTemplate(template: InsertClientRequestTemplate): Promise<ClientRequestTemplate>;
  updateClientRequestTemplate(id: string, template: UpdateClientRequestTemplate): Promise<ClientRequestTemplate>;
  deleteClientRequestTemplate(id: string): Promise<void>;
  
  getClientRequestTemplateSectionsByTemplateId(templateId: string): Promise<ClientRequestTemplateSection[]>;
  createClientRequestTemplateSection(section: InsertClientRequestTemplateSection): Promise<ClientRequestTemplateSection>;
  updateClientRequestTemplateSection(id: string, section: UpdateClientRequestTemplateSection): Promise<ClientRequestTemplateSection>;
  deleteClientRequestTemplateSection(id: string): Promise<void>;
  updateSectionOrders(sections: { id: string; sortOrder: number }[]): Promise<void>;
  
  getClientRequestTemplateQuestionsBySectionId(sectionId: string): Promise<ClientRequestTemplateQuestion[]>;
  createClientRequestTemplateQuestion(question: InsertClientRequestTemplateQuestion): Promise<ClientRequestTemplateQuestion>;
  updateClientRequestTemplateQuestion(id: string, question: UpdateClientRequestTemplateQuestion): Promise<ClientRequestTemplateQuestion>;
  deleteClientRequestTemplateQuestion(id: string): Promise<void>;
  
  getAllClientCustomRequests(filters?: { clientId?: string; status?: string }): Promise<(ClientCustomRequest & { 
    client: Client;
    template: ClientRequestTemplate | null;
    project: Project | null;
    sections: (ClientCustomRequestSection & { questions: ClientCustomRequestQuestion[] })[];
  })[]>;
  getClientCustomRequestById(id: string): Promise<(ClientCustomRequest & { 
    client: Client;
    template: ClientRequestTemplate | null;
    project: Project | null;
    sections: (ClientCustomRequestSection & { questions: ClientCustomRequestQuestion[] })[];
  }) | undefined>;
  getClientCustomRequestsByClientId(clientId: string): Promise<(ClientCustomRequest & { 
    template: ClientRequestTemplate | null;
    project: Project | null;
    sections: (ClientCustomRequestSection & { questions: ClientCustomRequestQuestion[] })[];
  })[]>;
  createClientCustomRequest(request: InsertClientCustomRequest): Promise<ClientCustomRequest>;
  updateClientCustomRequest(id: string, request: UpdateClientCustomRequest): Promise<ClientCustomRequest>;
  deleteClientCustomRequest(id: string): Promise<void>;
  
  getClientCustomRequestSectionsByRequestId(requestId: string): Promise<ClientCustomRequestSection[]>;
  createClientCustomRequestSection(section: InsertClientCustomRequestSection): Promise<ClientCustomRequestSection>;
  updateClientCustomRequestSection(id: string, section: UpdateClientCustomRequestSection): Promise<ClientCustomRequestSection>;
  deleteClientCustomRequestSection(id: string): Promise<void>;
  
  getClientCustomRequestQuestionsBySectionId(sectionId: string): Promise<ClientCustomRequestQuestion[]>;
  createClientCustomRequestQuestion(question: InsertClientCustomRequestQuestion): Promise<ClientCustomRequestQuestion>;
  updateClientCustomRequestQuestion(id: string, question: UpdateClientCustomRequestQuestion): Promise<ClientCustomRequestQuestion>;
  deleteClientCustomRequestQuestion(id: string): Promise<void>;
  
  getAllTaskInstances(filters?: { clientId?: string; projectId?: string; status?: string; assigneeId?: string }): Promise<(TaskInstance & {
    client: Client | null;
    project: Project | null;
    assignee: User | null;
    taskType: TaskType | null;
    responses: TaskInstanceResponse[];
  })[]>;
  getTaskInstanceById(id: string): Promise<(TaskInstance & {
    client: Client | null;
    project: Project | null;
    assignee: User | null;
    taskType: TaskType | null;
    responses: TaskInstanceResponse[];
  }) | undefined>;
  getTaskInstancesByProjectId(projectId: string): Promise<TaskInstance[]>;
  createTaskInstance(instance: InsertTaskInstance): Promise<TaskInstance>;
  updateTaskInstance(id: string, instance: UpdateTaskInstance): Promise<TaskInstance>;
  deleteTaskInstance(id: string): Promise<void>;
  
  getTaskInstanceResponsesByInstanceId(instanceId: string): Promise<TaskInstanceResponse[]>;
  createTaskInstanceResponse(response: InsertTaskInstanceResponse): Promise<TaskInstanceResponse>;
  
  getAllTaskTypes(): Promise<TaskType[]>;
  getTaskTypeById(id: string): Promise<TaskType | undefined>;
  createTaskType(taskType: InsertTaskType): Promise<TaskType>;
  updateTaskType(id: string, taskType: UpdateTaskType): Promise<TaskType>;
  deleteTaskType(id: string): Promise<void>;
  
  getAllInternalTasks(filters?: { status?: string; assigneeId?: string; creatorId?: string; parentId?: string; includeChildren?: boolean }): Promise<(InternalTask & {
    assignee: User | null;
    creator: User;
    parent: InternalTask | null;
    children: InternalTask[];
    connections: (TaskConnection & { relatedTask: InternalTask })[];
    progressNotes: (TaskProgressNote & { user: User })[];
    documents: TaskDocument[];
  })[]>;
  getInternalTaskById(id: string): Promise<(InternalTask & {
    assignee: User | null;
    creator: User;
    parent: InternalTask | null;
    children: InternalTask[];
    connections: (TaskConnection & { relatedTask: InternalTask })[];
    progressNotes: (TaskProgressNote & { user: User })[];
    documents: TaskDocument[];
  }) | undefined>;
  createInternalTask(task: InsertInternalTask): Promise<InternalTask>;
  updateInternalTask(id: string, task: UpdateInternalTask): Promise<InternalTask>;
  deleteInternalTask(id: string): Promise<void>;
  
  createTaskConnection(connection: InsertTaskConnection): Promise<TaskConnection>;
  deleteTaskConnection(id: string): Promise<void>;
  
  createTaskProgressNote(note: InsertTaskProgressNote): Promise<TaskProgressNote>;
  getTaskProgressNotesByTaskId(taskId: string): Promise<(TaskProgressNote & { user: User })[]>;
  deleteTaskProgressNote(id: string): Promise<void>;
  
  createTaskTimeEntry(entry: InsertTaskTimeEntry): Promise<TaskTimeEntry>;
  getTaskTimeEntriesByTaskId(taskId: string): Promise<(TaskTimeEntry & { user: User })[]>;
  getActiveTaskTimeEntry(taskId: string, userId: string): Promise<TaskTimeEntry | undefined>;
  stopTaskTimeEntry(id: string, stopData: StopTaskTimeEntry): Promise<TaskTimeEntry>;
  deleteTaskTimeEntry(id: string): Promise<void>;
  
  getProjectTypeNotificationsByProjectTypeId(projectTypeId: string): Promise<ProjectTypeNotification[]>;
  getProjectTypeNotificationById(id: string): Promise<ProjectTypeNotification | undefined>;
  createProjectTypeNotification(notification: InsertProjectTypeNotification): Promise<ProjectTypeNotification>;
  updateProjectTypeNotification(id: string, notification: UpdateProjectTypeNotification): Promise<ProjectTypeNotification>;
  deleteProjectTypeNotification(id: string): Promise<void>;
  getPreviewCandidates(projectTypeId: string, notification: ProjectTypeNotification): Promise<import("@shared/schema").PreviewCandidatesResponse>;
  
  getClientRequestRemindersByNotificationId(notificationId: string): Promise<ClientRequestReminder[]>;
  getClientRequestReminderById(id: string): Promise<ClientRequestReminder | undefined>;
  createClientRequestReminder(reminder: InsertClientRequestReminder): Promise<ClientRequestReminder>;
  updateClientRequestReminder(id: string, reminder: UpdateClientRequestReminder): Promise<ClientRequestReminder>;
  deleteClientRequestReminder(id: string): Promise<void>;
  
  getAllScheduledNotifications(): Promise<ScheduledNotification[]>;
  getScheduledNotificationById(id: string): Promise<ScheduledNotification | undefined>;
  getScheduledNotificationsForClient(clientId: string, filters?: {
    category?: string;
    type?: string;
    recipientId?: string;
    dateFrom?: string;
    dateTo?: string;
    status?: string;
  }): Promise<any[]>;
  updateScheduledNotification(id: string, notification: UpdateScheduledNotification): Promise<ScheduledNotification>;
  cancelScheduledNotificationsForProject(projectId: string, reason: string): Promise<void>;
  
  getNotificationHistoryByClientId(clientId: string): Promise<NotificationHistory[]>;
  getNotificationHistoryByProjectId(projectId: string): Promise<NotificationHistory[]>;
  
  getCompanySettings(): Promise<CompanySettings | undefined>;
  updateCompanySettings(settings: UpdateCompanySettings): Promise<CompanySettings>;

  createSignatureRequest(request: InsertSignatureRequest): Promise<SignatureRequest>;
  getSignatureRequestById(id: string): Promise<SignatureRequest | undefined>;
  getSignatureRequestsByClientId(clientId: string): Promise<SignatureRequest[]>;
  getSignatureRequestByPublicToken(token: string): Promise<SignatureRequest | undefined>;
  updateSignatureRequest(id: string, request: Partial<InsertSignatureRequest>): Promise<SignatureRequest>;
  deleteSignatureRequest(id: string): Promise<void>;
  
  createSignatureRequestRecipient(recipient: InsertSignatureRequestRecipient): Promise<SignatureRequestRecipient>;
  getSignatureRequestRecipientsByRequestId(requestId: string): Promise<SignatureRequestRecipient[]>;
  getSignatureRequestRecipientByToken(token: string): Promise<SignatureRequestRecipient | undefined>;
  updateSignatureRequestRecipient(id: string, recipient: Partial<InsertSignatureRequestRecipient>): Promise<SignatureRequestRecipient>;
  deleteSignatureRequestRecipient(id: string): Promise<void>;
  
  createSignatureField(field: InsertSignatureField): Promise<SignatureField>;
  getSignatureFieldsByRequestId(requestId: string): Promise<SignatureField[]>;
  getSignatureFieldsBySignerId(signerId: string): Promise<SignatureField[]>;
  updateSignatureField(id: string, field: Partial<InsertSignatureField>): Promise<SignatureField>;
  deleteSignatureField(id: string): Promise<void>;
  
  createSignatureAuditLog(log: InsertSignatureAuditLog): Promise<SignatureAuditLog>;
  getSignatureAuditLogsByRequestId(requestId: string): Promise<SignatureAuditLog[]>;

  createTaskDocument(document: InsertTaskDocument): Promise<TaskDocument>;
  getTaskDocumentsByTaskId(taskId: string): Promise<TaskDocument[]>;
  deleteTaskDocument(id: string): Promise<void>;

  setFallbackUser(userId: string): Promise<void>;
  logTaskActivityToProject(task: any, type: 'create' | 'complete' | 'reopen', userId: string): Promise<void>;
}
