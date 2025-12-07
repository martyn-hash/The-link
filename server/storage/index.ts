// ============================================================================
// Modular Storage Facade - Complete
// ============================================================================
// This facade provides backward-compatible access to all storage methods
// by delegating to domain-focused storage modules.
// All 535+ methods are now delegated across 52 storage modules.

// Import the IStorage interface from the new location
import { IStorage as OriginalIStorage } from './base/IStorage.js';

// Import new domain storage classes
import { UserStorage } from './users/userStorage.js';
import { UserActivityStorage } from './users/userActivityStorage.js';
import { ClientStorage, CompaniesHouseStorage, SearchStorage } from './clients/index.js';
import { PeopleStorage, ClientPeopleStorage } from './people/index.js';
import { 
  ProjectStorage, 
  ProjectChronologyStorage, 
  ProjectTypesStorage, 
  ProjectStagesStorage, 
  ProjectApprovalsStorage,
  ProjectSchedulingStorage,
  getProjectTypeByName,
  validateStageReasonMapping,
  validateRequiredFields,
  getDefaultStage,
  validateProjectStatus,
} from './projects/index.js';
import { 
  ServiceStorage, 
  WorkRoleStorage, 
  ServiceAssignmentStorage 
} from './services/index.js';
import { TagStorage } from './tags/index.js';
import { CommunicationStorage } from './communications/index.js';
import { 
  IntegrationStorage, 
  PushNotificationStorage, 
  EmailStorage,
  initializeDefaultNotificationTemplates as modularInitTemplates
} from './integrations/index.js';
import { 
  DocumentStorage, 
  RiskAssessmentStorage, 
  PortalDocumentStorage,
  SignatureStorage
} from './documents/index.js';
import { PortalStorage } from './portal/index.js';
import {
  MessageThreadStorage,
  MessageStorage,
  ProjectMessageThreadStorage,
  ProjectMessageStorage,
  ProjectMessageParticipantStorage,
  StaffMessageThreadStorage,
  StaffMessageStorage,
  StaffMessageParticipantStorage
} from './messages/index.js';
import {
  ChChangeRequestStorage,
  RequestTemplateStorage,
  CustomRequestStorage
} from './requests/index.js';
import {
  TaskInstanceStorage,
  TaskInstanceResponseStorage,
  TaskTypeStorage,
  InternalTaskStorage,
  TaskTimeEntryStorage
} from './tasks/index.js';
import {
  ProjectTypeNotificationStorage,
  ClientReminderStorage,
  ScheduledNotificationStorage,
  NotificationHistoryStorage,
  StageChangeNotificationStorage
} from './notifications/index.js';
import {
  UserNotificationPreferencesStorage,
  ViewsStorage,
  ColumnPreferencesStorage,
  DashboardStorage,
  UserPreferencesStorage,
  CompanySettingsStorage
} from './settings/index.js';
import { WebhookStorage } from './webhooks/index.js';
import { QboStorage, QcStorage } from './qbo/index.js';
import { QueryStorage, QueryTokenStorage, ScheduledReminderStorage } from './queries/index.js';

// Import facade mixins
import { applyUsersFacade } from './facade/users.facade.js';
import { applyPeopleFacade } from './facade/people.facade.js';
import { applyClientsFacade } from './facade/clients.facade.js';
import { applyProjectsFacade } from './facade/projects.facade.js';
import { applyServicesFacade } from './facade/services.facade.js';
import { applyTagsCommsFacade } from './facade/tags-comms.facade.js';
import { applyIntegrationsFacade } from './facade/integrations.facade.js';

// Export shared types (new modular architecture)
export * from './base/types.js';

// Re-export the IStorage interface (critical for backward compatibility)
export type IStorage = OriginalIStorage;

// Re-export initialization function
export const initializeDefaultNotificationTemplates = modularInitTemplates;

// StorageBase class contains all storage instances and helper registration
class StorageBase {
  // Domain storage instances - protected so facade mixins can access them
  protected userStorage: UserStorage;
  protected userActivityStorage: UserActivityStorage;
  protected clientStorage: ClientStorage;
  protected companiesHouseStorage: CompaniesHouseStorage;
  protected searchStorage: SearchStorage;
  protected peopleStorage: PeopleStorage;
  protected clientPeopleStorage: ClientPeopleStorage;
  protected projectStorage: ProjectStorage;
  protected projectChronologyStorage: ProjectChronologyStorage;
  protected projectTypesStorage: ProjectTypesStorage;
  protected projectStagesStorage: ProjectStagesStorage;
  protected projectApprovalsStorage: ProjectApprovalsStorage;
  protected projectSchedulingStorage: ProjectSchedulingStorage;
  protected stageChangeNotificationStorage: StageChangeNotificationStorage;
  protected serviceStorage: ServiceStorage;
  protected workRoleStorage: WorkRoleStorage;
  protected serviceAssignmentStorage: ServiceAssignmentStorage;
  protected tagStorage: TagStorage;
  protected communicationStorage: CommunicationStorage;
  protected integrationStorage: IntegrationStorage;
  protected pushNotificationStorage: PushNotificationStorage;
  protected emailStorage: EmailStorage;
  private documentStorage: DocumentStorage;
  private riskAssessmentStorage: RiskAssessmentStorage;
  private portalDocumentStorage: PortalDocumentStorage;
  private signatureStorage: SignatureStorage;
  private portalStorage: PortalStorage;
  private messageThreadStorage: MessageThreadStorage;
  private messageStorage: MessageStorage;
  private projectMessageThreadStorage: ProjectMessageThreadStorage;
  private projectMessageStorage: ProjectMessageStorage;
  private projectMessageParticipantStorage: ProjectMessageParticipantStorage;
  private staffMessageThreadStorage: StaffMessageThreadStorage;
  private staffMessageStorage: StaffMessageStorage;
  private staffMessageParticipantStorage: StaffMessageParticipantStorage;
  private chChangeRequestStorage: ChChangeRequestStorage;
  private requestTemplateStorage: RequestTemplateStorage;
  private customRequestStorage: CustomRequestStorage;
  private taskInstanceStorage: TaskInstanceStorage;
  private taskInstanceResponseStorage: TaskInstanceResponseStorage;
  private taskTypeStorage: TaskTypeStorage;
  private internalTaskStorage: InternalTaskStorage;
  private taskTimeEntryStorage: TaskTimeEntryStorage;
  private projectTypeNotificationStorage: ProjectTypeNotificationStorage;
  private clientReminderStorage: ClientReminderStorage;
  private scheduledNotificationStorage: ScheduledNotificationStorage;
  private notificationHistoryStorage: NotificationHistoryStorage;
  private userNotificationPreferencesStorage: UserNotificationPreferencesStorage;
  private viewsStorage: ViewsStorage;
  private columnPreferencesStorage: ColumnPreferencesStorage;
  private dashboardStorage: DashboardStorage;
  private userPreferencesStorage: UserPreferencesStorage;
  private companySettingsStorage: CompanySettingsStorage;
  private webhookStorage: WebhookStorage;
  private qboStorage: QboStorage;
  private qcStorage: QcStorage;
  private queryStorage: QueryStorage;
  private queryTokenStorage: QueryTokenStorage;
  private scheduledReminderStorage: ScheduledReminderStorage;

  constructor() {
    // Initialize all storage instances
    this.userStorage = new UserStorage();
    this.userActivityStorage = new UserActivityStorage(); // Will set storage reference after facade is constructed
    
    // Initialize client domain storages
    this.clientStorage = new ClientStorage();
    this.companiesHouseStorage = new CompaniesHouseStorage();
    this.searchStorage = new SearchStorage();
    
    // Initialize people domain storages
    this.peopleStorage = new PeopleStorage();
    this.clientPeopleStorage = new ClientPeopleStorage();
    
    // Initialize projects domain storages
    this.projectStorage = new ProjectStorage();
    this.projectChronologyStorage = new ProjectChronologyStorage();
    this.projectTypesStorage = new ProjectTypesStorage();
    this.projectStagesStorage = new ProjectStagesStorage();
    this.projectApprovalsStorage = new ProjectApprovalsStorage();
    this.projectSchedulingStorage = new ProjectSchedulingStorage();
    
    // Initialize services domain storages
    this.serviceStorage = new ServiceStorage();
    this.workRoleStorage = new WorkRoleStorage();
    this.serviceAssignmentStorage = new ServiceAssignmentStorage();
    
    // Initialize tags domain storage (Stage 7)
    this.tagStorage = new TagStorage();
    
    // Initialize communications domain storage (Stage 7)
    this.communicationStorage = new CommunicationStorage();
    
    // Initialize integrations domain storage (Stage 8)
    this.integrationStorage = new IntegrationStorage();
    this.pushNotificationStorage = new PushNotificationStorage();
    this.emailStorage = new EmailStorage();
    
    // Initialize documents domain storage (Stage 9)
    this.documentStorage = new DocumentStorage();
    this.riskAssessmentStorage = new RiskAssessmentStorage();
    this.portalDocumentStorage = new PortalDocumentStorage();
    this.signatureStorage = new SignatureStorage();
    
    // Initialize portal domain storage (Stage 9)
    this.portalStorage = new PortalStorage();
    
    // Initialize messages domain storage (Stage 10)
    this.messageThreadStorage = new MessageThreadStorage();
    this.messageStorage = new MessageStorage();
    this.projectMessageThreadStorage = new ProjectMessageThreadStorage();
    this.projectMessageStorage = new ProjectMessageStorage();
    this.projectMessageParticipantStorage = new ProjectMessageParticipantStorage();
    this.staffMessageThreadStorage = new StaffMessageThreadStorage();
    this.staffMessageStorage = new StaffMessageStorage();
    this.staffMessageParticipantStorage = new StaffMessageParticipantStorage();
    
    // Initialize requests domain storage (Stage 11)
    this.chChangeRequestStorage = new ChChangeRequestStorage();
    this.requestTemplateStorage = new RequestTemplateStorage();
    this.customRequestStorage = new CustomRequestStorage();
    
    // Initialize tasks domain storage (Stage 12)
    this.taskInstanceStorage = new TaskInstanceStorage();
    this.taskInstanceResponseStorage = new TaskInstanceResponseStorage();
    this.taskTypeStorage = new TaskTypeStorage();
    this.internalTaskStorage = new InternalTaskStorage();
    this.taskTimeEntryStorage = new TaskTimeEntryStorage();
    
    // Initialize notifications domain storage (Stage 13)
    this.projectTypeNotificationStorage = new ProjectTypeNotificationStorage({
      getServiceByProjectTypeId: (projectTypeId: string) => this.serviceStorage.getServiceByProjectTypeId(projectTypeId),
      getStageById: (stageId: string) => this.projectStagesStorage.getStageById(stageId),
    });
    this.clientReminderStorage = new ClientReminderStorage();
    this.scheduledNotificationStorage = new ScheduledNotificationStorage();
    this.notificationHistoryStorage = new NotificationHistoryStorage();
    this.stageChangeNotificationStorage = new StageChangeNotificationStorage({
      getUser: (userId: string) => this.userStorage.getUser(userId),
      getProject: (projectId: string) => this.projectStorage.getProject(projectId),
      getWorkRoleById: (roleId: string) => this.workRoleStorage.getWorkRoleById(roleId),
      resolveRoleAssigneeForClient: (clientId: string, projectTypeId: string, roleName: string) => 
        this.serviceAssignmentStorage.resolveRoleAssigneeForClient(clientId, projectTypeId, roleName),
    });
    
    // Initialize settings domain storage (Stage 14)
    this.userNotificationPreferencesStorage = new UserNotificationPreferencesStorage();
    this.viewsStorage = new ViewsStorage();
    this.columnPreferencesStorage = new ColumnPreferencesStorage();
    this.dashboardStorage = new DashboardStorage();
    this.userPreferencesStorage = new UserPreferencesStorage();
    this.companySettingsStorage = new CompanySettingsStorage();
    
    // Initialize webhooks domain storage
    this.webhookStorage = new WebhookStorage();
    
    // Initialize QBO domain storage
    this.qboStorage = new QboStorage();
    this.qcStorage = new QcStorage();
    
    // Initialize queries domain storage
    this.queryStorage = new QueryStorage();
    this.queryTokenStorage = new QueryTokenStorage();
    this.scheduledReminderStorage = new ScheduledReminderStorage();
    
    // Register cross-domain helpers
    this.registerClientHelpers();
    this.registerPeopleHelpers();
    this.registerProjectHelpers();
    this.registerServiceHelpers();
    this.registerMessageHelpers();
    
    // Set storage reference for UserActivityStorage (needs facade for entity enrichment)
    this.userActivityStorage.setStorage(this);
  }

  /**
   * Register helpers for cross-domain dependencies in people storage
   */
  private registerPeopleHelpers() {
    // No cross-domain helpers needed for Stage 3
    // People domain operations are self-contained
  }

  /**
   * Register helpers for cross-domain dependencies in service storage
   */
  private registerServiceHelpers() {
    // ServiceStorage needs helpers for validation
    this.serviceStorage.registerHelpers({
      getServiceById: (serviceId: string) => this.serviceStorage.getServiceById(serviceId),
      getWorkRoleById: (roleId: string) => this.workRoleStorage.getWorkRoleById(roleId),
    });
    
    // ServiceAssignmentStorage needs helpers for role validation and project assignments
    this.serviceAssignmentStorage.registerHelpers({
      getServiceById: (serviceId: string) => this.serviceStorage.getServiceById(serviceId),
      getWorkRoleById: (roleId: string) => this.workRoleStorage.getWorkRoleById(roleId),
      getWorkRolesByServiceId: (serviceId: string) => this.workRoleStorage.getWorkRolesByServiceId(serviceId),
      getServiceByProjectTypeId: (projectTypeId: string) => this.serviceStorage.getServiceByProjectTypeId(projectTypeId),
      getUser: (userId: string) => this.userStorage.getUser(userId),
      getFallbackUser: () => this.userStorage.getFallbackUser(),
      getDefaultStage: getDefaultStage(this.projectStagesStorage),
    });
  }

  /**
   * Register helpers for cross-domain dependencies in project storage
   */
  private registerProjectHelpers() {
    // ProjectStorage needs helpers from configuration, services, notifications, and messaging domains
    this.projectStorage.registerProjectHelpers({
      // Stage 5 helpers - now from modular ProjectStagesStorage
      getDefaultStage: getDefaultStage(this.projectStagesStorage),
      validateProjectStatus: validateProjectStatus(this.projectStagesStorage),
      validateStageReasonMapping: validateStageReasonMapping(this.projectStagesStorage),
      validateRequiredFields: validateRequiredFields(this.projectStagesStorage),
      getProjectTypeByName: getProjectTypeByName(this.projectTypesStorage),
      
      // Services domain - now delegated to ServiceStorage and ServiceAssignmentStorage (Stage 6)
      getServiceByProjectTypeId: (projectTypeId: string) => this.serviceStorage.getServiceByProjectTypeId(projectTypeId),
      getClientServiceByClientAndProjectType: (clientId: string, projectTypeId: string) => 
        this.serviceAssignmentStorage.getClientServiceByClientAndProjectType(clientId, projectTypeId),
      resolveProjectAssignments: (clientId: string, projectTypeId: string) => 
        this.serviceAssignmentStorage.resolveProjectAssignments(clientId, projectTypeId),
      resolveServiceOwner: (clientId: string, projectTypeId: string) => 
        this.serviceAssignmentStorage.resolveServiceOwner(clientId, projectTypeId),
      resolveStageRoleAssignee: (project: any) => this.serviceAssignmentStorage.resolveStageRoleAssignee(project),
      resolveStageRoleAssigneesBatch: (projects: any[]) => this.serviceAssignmentStorage.resolveStageRoleAssigneesBatch(projects),
      getWorkRoleById: (workRoleId: string) => this.workRoleStorage.getWorkRoleById(workRoleId),
      resolveRoleAssigneeForClient: (clientId: string, projectTypeId: string, roleName: string) => 
        this.serviceAssignmentStorage.resolveRoleAssigneeForClient(clientId, projectTypeId, roleName),
      
      // Notifications domain - now delegated to NotificationStorage modules (Stage 13)
      sendStageChangeNotifications: (projectId: string, newStatus: string, oldStatus: string) => 
        this.stageChangeNotificationStorage.sendStageChangeNotifications(projectId, newStatus, oldStatus),
      cancelScheduledNotificationsForProject: (projectId: string, reason: string) => 
        this.scheduledNotificationStorage.cancelScheduledNotificationsForProject(projectId, reason),
      
      // Messaging domain - now delegated to modular messaging storage (Stage 10)
      createProjectMessageThread: (data: any) => this.projectMessageThreadStorage.createProjectMessageThread(data),
      createProjectMessageParticipant: (data: any) => this.projectMessageParticipantStorage.createProjectMessageParticipant(data),
      createProjectMessage: (data: any) => this.projectMessageStorage.createProjectMessage(data),
      
      // Auto-archive/unarchive message threads when project is completed/reopened
      autoArchiveMessageThreadsByProjectId: (projectId: string, archivedBy: string) => 
        this.messageThreadStorage.autoArchiveThreadsByProjectId(projectId, archivedBy),
      autoArchiveProjectMessageThreadsByProjectId: (projectId: string, archivedBy: string) => 
        this.projectMessageThreadStorage.autoArchiveThreadsByProjectId(projectId, archivedBy),
      unarchiveAutoArchivedMessageThreadsByProjectId: (projectId: string) => 
        this.messageThreadStorage.unarchiveAutoArchivedThreadsByProjectId(projectId),
      unarchiveAutoArchivedProjectMessageThreadsByProjectId: (projectId: string) => 
        this.projectMessageThreadStorage.unarchiveAutoArchivedThreadsByProjectId(projectId),
      
      // Client domain - delegate to ClientStorage
      getClientByName: (name: string) => this.clientStorage.getClientByName(name),
      // User domain - delegate to UserStorage
      getUserByEmail: (email: string) => this.userStorage.getUserByEmail(email),
    });
  }

  /**
   * Register helpers for cross-domain dependencies in client storage
   */
  private registerClientHelpers() {
    // ClientStorage needs helpers from projects and services domains
    this.clientStorage.registerHelpers({
      // Check if client has projects (for deletion)
      checkClientProjects: async (clientId: string) => {
        const projects = await this.projectStorage.getProjectsByClient(clientId);
        return projects && projects.length > 0;
      },
      // Delete client services and role assignments (for deletion cascade) - now delegated to ServiceAssignmentStorage
      deleteClientServices: async (clientId: string) => {
        const services = await this.serviceAssignmentStorage.getClientServicesByClientId(clientId);
        for (const service of services) {
          // Delete role assignments first
          const assignments = await this.serviceAssignmentStorage.getClientServiceRoleAssignments(service.id);
          for (const assignment of assignments) {
            await this.serviceAssignmentStorage.deleteClientServiceRoleAssignment(assignment.id);
          }
          // Delete the service
          await this.serviceAssignmentStorage.deleteClientService(service.id);
        }
      },
      // Get person by ID (for conversion operations) - now delegated to PeopleStorage
      getPersonById: (personId: string) => this.peopleStorage.getPersonById(personId),
    });
    
    // CompaniesHouseStorage needs helpers for client CRUD
    this.companiesHouseStorage.registerHelpers({
      createClient: (clientData: any) => this.clientStorage.createClient(clientData),
      updateClient: (id: string, clientData: any) => this.clientStorage.updateClient(id, clientData),
    });
  }

  /**
   * Register helpers for cross-domain dependencies in message storage
   */
  private registerMessageHelpers() {
    // ProjectMessageParticipantStorage needs helpers for user and project lookups
    // Use modular delegates instead of oldStorage to maintain domain isolation
    this.projectMessageParticipantStorage.registerHelpers({
      getUser: (userId: string) => this.userStorage.getUser(userId),
      getProject: (projectId: string) => this.projectStorage.getProject(projectId),
    });
  }
}

// Apply facade mixins to StorageBase
// User (33), People (20), Clients (27), Projects (68), Services (53), Tags/Comms (44), and Integrations (54) domain methods are now provided by mixins
const DatabaseStorageWithUsers = applyUsersFacade(StorageBase);
const DatabaseStorageWithPeople = applyPeopleFacade(DatabaseStorageWithUsers);
const DatabaseStorageWithClients = applyClientsFacade(DatabaseStorageWithPeople);
const DatabaseStorageWithProjects = applyProjectsFacade(DatabaseStorageWithClients);
const DatabaseStorageWithServices = applyServicesFacade(DatabaseStorageWithProjects);
const DatabaseStorageWithTagsComms = applyTagsCommsFacade(DatabaseStorageWithServices);
const DatabaseStorageWithIntegrations = applyIntegrationsFacade(DatabaseStorageWithTagsComms);

// DatabaseStorage extends the composed class and implements IStorage
export class DatabaseStorage extends DatabaseStorageWithIntegrations implements IStorage {
  constructor() {
    super();
  }

  // ============================================================================
  // DOCUMENTS & PORTAL DOMAIN - Delegated to Document & Portal Storage Modules (Stage 9)
  // ============================================================================

  // Document Folder Operations - DocumentStorage
  async createDocumentFolder(folder: any) {
    return this.documentStorage.createDocumentFolder(folder);
  }

  async getDocumentFolderById(id: string) {
    return this.documentStorage.getDocumentFolderById(id);
  }

  async getDocumentFoldersByClientId(clientId: string) {
    return this.documentStorage.getDocumentFoldersByClientId(clientId);
  }

  async deleteDocumentFolder(id: string) {
    return this.documentStorage.deleteDocumentFolder(id);
  }

  // Document Operations - DocumentStorage
  async createDocument(document: any) {
    return this.documentStorage.createDocument(document);
  }

  async getDocumentById(id: string) {
    return this.documentStorage.getDocumentById(id);
  }

  async getDocumentsByClientId(clientId: string) {
    return this.documentStorage.getDocumentsByClientId(clientId);
  }

  async getDocumentsByFolderId(folderId: string) {
    return this.documentStorage.getDocumentsByFolderId(folderId);
  }

  async deleteDocument(id: string) {
    return this.documentStorage.deleteDocument(id);
  }

  async getSignedUrl(objectPath: string) {
    return this.documentStorage.getSignedUrl(objectPath);
  }

  // Portal Document Operations - PortalDocumentStorage
  async listPortalDocuments(clientId: string, clientPortalUserId: string) {
    return this.portalDocumentStorage.listPortalDocuments(clientId, clientPortalUserId);
  }

  async createPortalDocument(document: any) {
    return this.portalDocumentStorage.createPortalDocument(document);
  }

  async deletePortalDocument(id: string, clientId: string, clientPortalUserId: string) {
    return this.portalDocumentStorage.deletePortalDocument(id, clientId, clientPortalUserId);
  }

  async getPortalDocumentById(id: string, clientId: string, clientPortalUserId: string) {
    return this.portalDocumentStorage.getPortalDocumentById(id, clientId, clientPortalUserId);
  }

  // Risk Assessment Operations - RiskAssessmentStorage
  async createRiskAssessment(assessment: any) {
    return this.riskAssessmentStorage.createRiskAssessment(assessment);
  }

  async getRiskAssessmentById(id: string) {
    return this.riskAssessmentStorage.getRiskAssessmentById(id);
  }

  async getRiskAssessmentsByClientId(clientId: string) {
    return this.riskAssessmentStorage.getRiskAssessmentsByClientId(clientId);
  }

  async updateRiskAssessment(id: string, assessment: any) {
    return this.riskAssessmentStorage.updateRiskAssessment(id, assessment);
  }

  async deleteRiskAssessment(id: string) {
    return this.riskAssessmentStorage.deleteRiskAssessment(id);
  }

  async saveRiskAssessmentResponses(assessmentId: string, responses: any[]) {
    return this.riskAssessmentStorage.saveRiskAssessmentResponses(assessmentId, responses);
  }

  async getRiskAssessmentResponses(assessmentId: string) {
    return this.riskAssessmentStorage.getRiskAssessmentResponses(assessmentId);
  }

  // Signature Request Operations - SignatureStorage
  async createSignatureRequest(request: any) {
    return this.signatureStorage.createSignatureRequest(request);
  }

  async getSignatureRequestById(id: string) {
    return this.signatureStorage.getSignatureRequestById(id);
  }

  async getSignatureRequestsByClientId(clientId: string) {
    return this.signatureStorage.getSignatureRequestsByClientId(clientId);
  }

  async getSignatureRequestByPublicToken(token: string) {
    return this.signatureStorage.getSignatureRequestByPublicToken(token);
  }

  async updateSignatureRequest(id: string, request: any) {
    return this.signatureStorage.updateSignatureRequest(id, request);
  }

  async deleteSignatureRequest(id: string) {
    return this.signatureStorage.deleteSignatureRequest(id);
  }

  async createSignatureRequestRecipient(recipient: any) {
    return this.signatureStorage.createSignatureRequestRecipient(recipient);
  }

  async getSignatureRequestRecipientsByRequestId(requestId: string) {
    return this.signatureStorage.getSignatureRequestRecipientsByRequestId(requestId);
  }

  async getSignatureRequestRecipientByToken(token: string) {
    return this.signatureStorage.getSignatureRequestRecipientByToken(token);
  }

  async updateSignatureRequestRecipient(id: string, recipient: any) {
    return this.signatureStorage.updateSignatureRequestRecipient(id, recipient);
  }

  async deleteSignatureRequestRecipient(id: string) {
    return this.signatureStorage.deleteSignatureRequestRecipient(id);
  }

  async createSignatureField(field: any) {
    return this.signatureStorage.createSignatureField(field);
  }

  async getSignatureFieldsByRequestId(requestId: string) {
    return this.signatureStorage.getSignatureFieldsByRequestId(requestId);
  }

  async getSignatureFieldsBySignerId(signerId: string) {
    return this.signatureStorage.getSignatureFieldsBySignerId(signerId);
  }

  async updateSignatureField(id: string, field: any) {
    return this.signatureStorage.updateSignatureField(id, field);
  }

  async deleteSignatureField(id: string) {
    return this.signatureStorage.deleteSignatureField(id);
  }

  async createSignatureAuditLog(log: any) {
    return this.signatureStorage.createSignatureAuditLog(log);
  }

  async getSignatureAuditLogsByRequestId(requestId: string) {
    return this.signatureStorage.getSignatureAuditLogsByRequestId(requestId);
  }

  // Client Portal User Operations - PortalStorage
  async createClientPortalUser(user: any) {
    return this.portalStorage.createClientPortalUser(user);
  }

  async getClientPortalUserById(id: string) {
    return this.portalStorage.getClientPortalUserById(id);
  }

  async getClientPortalUserByEmail(email: string) {
    return this.portalStorage.getClientPortalUserByEmail(email);
  }

  async getClientPortalUserByMagicLinkToken(token: string) {
    return this.portalStorage.getClientPortalUserByMagicLinkToken(token);
  }

  async getClientPortalUsersByClientId(clientId: string) {
    return this.portalStorage.getClientPortalUsersByClientId(clientId);
  }

  async getClientPortalUserByPersonId(personId: string) {
    return this.portalStorage.getClientPortalUserByPersonId(personId);
  }

  async updateClientPortalUser(id: string, user: any) {
    return this.portalStorage.updateClientPortalUser(id, user);
  }

  async deleteClientPortalUser(id: string) {
    return this.portalStorage.deleteClientPortalUser(id);
  }

  // Client Portal Session Operations - PortalStorage
  async createClientPortalSession(data: any) {
    return this.portalStorage.createClientPortalSession(data);
  }

  async getClientPortalSessionByToken(token: string) {
    return this.portalStorage.getClientPortalSessionByToken(token);
  }

  async deleteClientPortalSession(id: string) {
    return this.portalStorage.deleteClientPortalSession(id);
  }

  async cleanupExpiredSessions() {
    return this.portalStorage.cleanupExpiredSessions();
  }

  // ============================================================================
  // MESSAGES DOMAIN - Delegated to Message Storage Modules (Stage 10)
  // ============================================================================

  // Client Message Thread Operations - MessageThreadStorage (9 methods)
  async createMessageThread(thread: any) {
    return this.messageThreadStorage.createMessageThread(thread);
  }

  async getMessageThreadById(id: string) {
    return this.messageThreadStorage.getMessageThreadById(id);
  }

  async getMessageThreadsByClientId(clientId: string, filters?: { status?: string }) {
    return this.messageThreadStorage.getMessageThreadsByClientId(clientId, filters);
  }

  async getMessageThreadsWithUnreadCount(clientId: string, status?: string) {
    return this.messageThreadStorage.getMessageThreadsWithUnreadCount(clientId, status);
  }

  async getAllMessageThreads(filters?: { status?: string; clientId?: string }) {
    return this.messageThreadStorage.getAllMessageThreads(filters);
  }

  async getLastMessageForThread(threadId: string) {
    return this.messageThreadStorage.getLastMessageForThread(threadId);
  }

  async hasUnreadMessagesForStaff(threadId: string) {
    return this.messageThreadStorage.hasUnreadMessagesForStaff(threadId);
  }

  async updateMessageThread(id: string, thread: any) {
    return this.messageThreadStorage.updateMessageThread(id, thread);
  }

  async deleteMessageThread(id: string) {
    return this.messageThreadStorage.deleteMessageThread(id);
  }

  // Client Message Operations - MessageStorage (9 methods)
  async createMessage(message: any) {
    return this.messageStorage.createMessage(message);
  }

  async getMessageById(id: string) {
    return this.messageStorage.getMessageById(id);
  }

  async getMessagesByThreadId(threadId: string) {
    return this.messageStorage.getMessagesByThreadId(threadId);
  }

  async updateMessage(id: string, message: any) {
    return this.messageStorage.updateMessage(id, message);
  }

  async deleteMessage(id: string) {
    return this.messageStorage.deleteMessage(id);
  }

  async markMessagesAsReadByStaff(threadId: string) {
    return this.messageStorage.markMessagesAsReadByStaff(threadId);
  }

  async markMessagesAsReadByClient(threadId: string) {
    return this.messageStorage.markMessagesAsReadByClient(threadId);
  }

  async getUnreadMessageCountForClient(clientId: string) {
    return this.messageStorage.getUnreadMessageCountForClient(clientId);
  }

  async getUnreadMessageCountForStaff(userId: string, isAdmin?: boolean) {
    return this.messageStorage.getUnreadMessageCountForStaff(userId, isAdmin);
  }

  // Project Message Thread Operations - ProjectMessageThreadStorage (8 methods)
  async createProjectMessageThread(thread: any) {
    return this.projectMessageThreadStorage.createProjectMessageThread(thread);
  }

  async getProjectMessageThreadById(id: string) {
    return this.projectMessageThreadStorage.getProjectMessageThreadById(id);
  }

  async getProjectMessageThreadsByProjectId(projectId: string) {
    return this.projectMessageThreadStorage.getProjectMessageThreadsByProjectId(projectId);
  }

  async getProjectMessageThreadsForUser(userId: string, filters?: { includeArchived?: boolean }) {
    return this.projectMessageThreadStorage.getProjectMessageThreadsForUser(userId, filters);
  }

  async getUnreadProjectThreadCountForUser(userId: string): Promise<number> {
    return this.projectMessageThreadStorage.getUnreadProjectThreadCountForUser(userId);
  }

  async updateProjectMessageThread(id: string, thread: any) {
    return this.projectMessageThreadStorage.updateProjectMessageThread(id, thread);
  }

  async deleteProjectMessageThread(id: string) {
    return this.projectMessageThreadStorage.deleteProjectMessageThread(id);
  }

  async archiveProjectMessageThread(id: string, archivedBy: string) {
    return this.projectMessageThreadStorage.archiveProjectMessageThread(id, archivedBy);
  }

  async unarchiveProjectMessageThread(id: string) {
    return this.projectMessageThreadStorage.unarchiveProjectMessageThread(id);
  }

  // Project Message Operations - ProjectMessageStorage (5 methods)
  async createProjectMessage(message: any) {
    return this.projectMessageStorage.createProjectMessage(message);
  }

  async getProjectMessageById(id: string) {
    return this.projectMessageStorage.getProjectMessageById(id);
  }

  async getProjectMessagesByThreadId(threadId: string) {
    return this.projectMessageStorage.getProjectMessagesByThreadId(threadId);
  }

  async updateProjectMessage(id: string, message: any) {
    return this.projectMessageStorage.updateProjectMessage(id, message);
  }

  async deleteProjectMessage(id: string) {
    return this.projectMessageStorage.deleteProjectMessage(id);
  }

  // Project Message Participant Operations - ProjectMessageParticipantStorage (9 methods)
  async createProjectMessageParticipant(participant: any) {
    return this.projectMessageParticipantStorage.createProjectMessageParticipant(participant);
  }

  async getProjectMessageParticipantsByThreadId(threadId: string) {
    return this.projectMessageParticipantStorage.getProjectMessageParticipantsByThreadId(threadId);
  }

  async getProjectMessageParticipantsByUserId(userId: string) {
    return this.projectMessageParticipantStorage.getProjectMessageParticipantsByUserId(userId);
  }

  async updateProjectMessageParticipant(id: string, participant: any) {
    return this.projectMessageParticipantStorage.updateProjectMessageParticipant(id, participant);
  }

  async deleteProjectMessageParticipant(id: string) {
    return this.projectMessageParticipantStorage.deleteProjectMessageParticipant(id);
  }

  async markProjectMessagesAsRead(threadId: string, userId: string, lastReadMessageId: string) {
    return this.projectMessageParticipantStorage.markProjectMessagesAsRead(threadId, userId, lastReadMessageId);
  }

  async updateParticipantReminderSent(threadId: string, userId: string) {
    return this.projectMessageParticipantStorage.updateParticipantReminderSent(threadId, userId);
  }

  async getUnreadProjectMessagesForUser(userId: string) {
    return this.projectMessageParticipantStorage.getUnreadProjectMessagesForUser(userId);
  }

  // IStorage interface alias - returns count
  async getUnreadProjectMessageCountForUser(userId: string) {
    const unreadMessages = await this.projectMessageParticipantStorage.getUnreadProjectMessagesForUser(userId);
    return unreadMessages.reduce((total, m) => total + m.count, 0);
  }

  async getProjectMessageUnreadSummaries(olderThanMinutes: number) {
    return this.projectMessageParticipantStorage.getProjectMessageUnreadSummaries(olderThanMinutes);
  }

  async getProjectMessageParticipantsNeedingReminders(hoursThreshold: number) {
    return this.projectMessageParticipantStorage.getProjectMessageParticipantsNeedingReminders(hoursThreshold);
  }

  // Staff Message Thread Operations - StaffMessageThreadStorage (7 methods)
  async createStaffMessageThread(thread: any) {
    return this.staffMessageThreadStorage.createStaffMessageThread(thread);
  }

  async getStaffMessageThreadById(id: string) {
    return this.staffMessageThreadStorage.getStaffMessageThreadById(id);
  }

  async getStaffMessageThreadsForUser(userId: string, filters?: { includeArchived?: boolean }) {
    return this.staffMessageThreadStorage.getStaffMessageThreadsForUser(userId, filters);
  }

  async updateStaffMessageThread(id: string, thread: any) {
    return this.staffMessageThreadStorage.updateStaffMessageThread(id, thread);
  }

  async deleteStaffMessageThread(id: string) {
    return this.staffMessageThreadStorage.deleteStaffMessageThread(id);
  }

  async archiveStaffMessageThread(id: string, archivedBy: string) {
    return this.staffMessageThreadStorage.archiveStaffMessageThread(id, archivedBy);
  }

  async unarchiveStaffMessageThread(id: string) {
    return this.staffMessageThreadStorage.unarchiveStaffMessageThread(id);
  }

  async getUnreadStaffThreadCountForUser(userId: string): Promise<number> {
    return this.staffMessageThreadStorage.getUnreadStaffThreadCountForUser(userId);
  }

  // IStorage interface alias
  async getUnreadStaffMessageCountForUser(userId: string): Promise<number> {
    return this.staffMessageThreadStorage.getUnreadStaffThreadCountForUser(userId);
  }

  // Staff Message Operations - StaffMessageStorage (5 methods)
  async createStaffMessage(message: any) {
    return this.staffMessageStorage.createStaffMessage(message);
  }

  async getStaffMessageById(id: string) {
    return this.staffMessageStorage.getStaffMessageById(id);
  }

  async getStaffMessagesByThreadId(threadId: string) {
    return this.staffMessageStorage.getStaffMessagesByThreadId(threadId);
  }

  async updateStaffMessage(id: string, message: any) {
    return this.staffMessageStorage.updateStaffMessage(id, message);
  }

  async deleteStaffMessage(id: string) {
    return this.staffMessageStorage.deleteStaffMessage(id);
  }

  // Staff Message Participant Operations - StaffMessageParticipantStorage (7 methods)
  async createStaffMessageParticipant(participant: any) {
    return this.staffMessageParticipantStorage.createStaffMessageParticipant(participant);
  }

  async getStaffMessageParticipantsByThreadId(threadId: string) {
    return this.staffMessageParticipantStorage.getStaffMessageParticipantsByThreadId(threadId);
  }

  async getStaffMessageParticipantsByUserId(userId: string) {
    return this.staffMessageParticipantStorage.getStaffMessageParticipantsByUserId(userId);
  }

  async updateStaffMessageParticipant(id: string, participant: any) {
    return this.staffMessageParticipantStorage.updateStaffMessageParticipant(id, participant);
  }

  async deleteStaffMessageParticipant(id: string) {
    return this.staffMessageParticipantStorage.deleteStaffMessageParticipant(id);
  }

  async markStaffMessagesAsRead(threadId: string, userId: string, lastReadMessageId: string) {
    return this.staffMessageParticipantStorage.markStaffMessagesAsRead(threadId, userId, lastReadMessageId);
  }

  async getUnreadStaffMessagesForUser(userId: string) {
    return this.staffMessageParticipantStorage.getUnreadStaffMessagesForUser(userId);
  }

  // REQUESTS DOMAIN - Delegated to Request Storage Modules (Stage 11)
  // ================================================================

  // CH Change Requests (7 methods) - ChChangeRequestStorage
  async getAllChChangeRequests() {
    return this.chChangeRequestStorage.getAllChChangeRequests();
  }

  async getPendingChChangeRequests() {
    return this.chChangeRequestStorage.getPendingChChangeRequests();
  }

  async createChChangeRequest(request: any) {
    return this.chChangeRequestStorage.createChChangeRequest(request);
  }

  async getChChangeRequestById(id: string) {
    return this.chChangeRequestStorage.getChChangeRequestById(id);
  }

  async getChChangeRequestsByClientId(clientId: string) {
    return this.chChangeRequestStorage.getChChangeRequestsByClientId(clientId);
  }

  async updateChChangeRequest(id: string, request: any) {
    return this.chChangeRequestStorage.updateChChangeRequest(id, request);
  }

  async deleteChChangeRequest(id: string) {
    return this.chChangeRequestStorage.deleteChChangeRequest(id);
  }

  async approveChChangeRequest(id: string, approvedBy: string, notes?: string) {
    return this.chChangeRequestStorage.approveChChangeRequest(id, approvedBy, notes);
  }

  async rejectChChangeRequest(id: string, approvedBy: string, notes?: string) {
    return this.chChangeRequestStorage.rejectChChangeRequest(id, approvedBy, notes);
  }

  async detectChDataChanges(clientId: string, newChData: any) {
    return this.chChangeRequestStorage.detectChDataChanges(clientId, newChData);
  }

  async applyChChangeRequests(requestIds: string[]) {
    return this.chChangeRequestStorage.applyChChangeRequests(requestIds);
  }

  // Request Template Categories (5 methods) - RequestTemplateStorage
  async createClientRequestTemplateCategory(category: any) {
    return this.requestTemplateStorage.createClientRequestTemplateCategory(category);
  }

  async getClientRequestTemplateCategoryById(id: string) {
    return this.requestTemplateStorage.getClientRequestTemplateCategoryById(id);
  }

  async getAllClientRequestTemplateCategories() {
    return this.requestTemplateStorage.getAllClientRequestTemplateCategories();
  }

  async updateClientRequestTemplateCategory(id: string, category: any) {
    return this.requestTemplateStorage.updateClientRequestTemplateCategory(id, category);
  }

  async deleteClientRequestTemplateCategory(id: string) {
    return this.requestTemplateStorage.deleteClientRequestTemplateCategory(id);
  }

  // Request Templates (7 methods) - RequestTemplateStorage
  async createClientRequestTemplate(template: any) {
    return this.requestTemplateStorage.createClientRequestTemplate(template);
  }

  async getClientRequestTemplateById(id: string) {
    return this.requestTemplateStorage.getClientRequestTemplateById(id);
  }

  async getAllClientRequestTemplates(includeInactive?: boolean) {
    return this.requestTemplateStorage.getAllClientRequestTemplates(includeInactive);
  }

  async getClientRequestTemplatesByCategory(categoryId: string) {
    return this.requestTemplateStorage.getClientRequestTemplatesByCategory(categoryId);
  }

  // IStorage interface alias
  async getClientRequestTemplatesByCategoryId(categoryId: string) {
    return this.requestTemplateStorage.getClientRequestTemplatesByCategory(categoryId);
  }

  async getActiveClientRequestTemplates() {
    return this.requestTemplateStorage.getActiveClientRequestTemplates();
  }

  async updateClientRequestTemplate(id: string, template: any) {
    return this.requestTemplateStorage.updateClientRequestTemplate(id, template);
  }

  async deleteClientRequestTemplate(id: string) {
    return this.requestTemplateStorage.deleteClientRequestTemplate(id);
  }

  // Request Template Sections (5 methods) - RequestTemplateStorage
  async createClientRequestTemplateSection(section: any) {
    return this.requestTemplateStorage.createClientRequestTemplateSection(section);
  }

  async getClientRequestTemplateSectionById(id: string) {
    return this.requestTemplateStorage.getClientRequestTemplateSectionById(id);
  }

  async getClientRequestTemplateSectionsByTemplateId(templateId: string) {
    return this.requestTemplateStorage.getClientRequestTemplateSectionsByTemplateId(templateId);
  }

  async updateClientRequestTemplateSection(id: string, section: any) {
    return this.requestTemplateStorage.updateClientRequestTemplateSection(id, section);
  }

  async deleteClientRequestTemplateSection(id: string) {
    return this.requestTemplateStorage.deleteClientRequestTemplateSection(id);
  }

  // Request Template Questions (7 methods) - RequestTemplateStorage
  async createClientRequestTemplateQuestion(question: any) {
    return this.requestTemplateStorage.createClientRequestTemplateQuestion(question);
  }

  async getClientRequestTemplateQuestionById(id: string) {
    return this.requestTemplateStorage.getClientRequestTemplateQuestionById(id);
  }

  async getClientRequestTemplateQuestionsBySectionId(sectionId: string) {
    return this.requestTemplateStorage.getClientRequestTemplateQuestionsBySectionId(sectionId);
  }

  async getAllClientRequestTemplateQuestionsByTemplateId(templateId: string) {
    return this.requestTemplateStorage.getAllClientRequestTemplateQuestionsByTemplateId(templateId);
  }

  async updateClientRequestTemplateQuestion(id: string, question: any) {
    return this.requestTemplateStorage.updateClientRequestTemplateQuestion(id, question);
  }

  async deleteClientRequestTemplateQuestion(id: string) {
    return this.requestTemplateStorage.deleteClientRequestTemplateQuestion(id);
  }

  async updateQuestionOrders(updates: { id: string; order: number }[]) {
    return this.requestTemplateStorage.updateQuestionOrders(updates);
  }

  async updateSectionOrders(updates: { id: string; order: number }[]) {
    return this.requestTemplateStorage.updateSectionOrders(updates);
  }

  // Custom Requests (5 methods) - CustomRequestStorage
  async createClientCustomRequest(request: any) {
    return this.customRequestStorage.createClientCustomRequest(request);
  }

  async getClientCustomRequestById(id: string) {
    return this.customRequestStorage.getClientCustomRequestById(id);
  }

  async getClientCustomRequestsByClientId(clientId: string) {
    return this.customRequestStorage.getClientCustomRequestsByClientId(clientId);
  }

  async getAllClientCustomRequests(filters?: { clientId?: string; status?: string }) {
    return this.customRequestStorage.getAllClientCustomRequests(filters);
  }

  async updateClientCustomRequest(id: string, request: any) {
    return this.customRequestStorage.updateClientCustomRequest(id, request);
  }

  async deleteClientCustomRequest(id: string) {
    return this.customRequestStorage.deleteClientCustomRequest(id);
  }

  // Custom Request Sections (6 methods) - CustomRequestStorage
  async createClientCustomRequestSection(section: any) {
    return this.customRequestStorage.createClientCustomRequestSection(section);
  }

  async getClientCustomRequestSectionById(id: string) {
    return this.customRequestStorage.getClientCustomRequestSectionById(id);
  }

  async getClientCustomRequestSectionsByRequestId(requestId: string) {
    return this.customRequestStorage.getClientCustomRequestSectionsByRequestId(requestId);
  }

  async updateClientCustomRequestSection(id: string, section: any) {
    return this.customRequestStorage.updateClientCustomRequestSection(id, section);
  }

  async deleteClientCustomRequestSection(id: string) {
    return this.customRequestStorage.deleteClientCustomRequestSection(id);
  }

  async updateCustomRequestSectionOrders(updates: { id: string; order: number }[]) {
    return this.customRequestStorage.updateCustomRequestSectionOrders(updates);
  }

  // Custom Request Questions (7 methods) - CustomRequestStorage
  async createClientCustomRequestQuestion(question: any) {
    return this.customRequestStorage.createClientCustomRequestQuestion(question);
  }

  async getClientCustomRequestQuestionById(id: string) {
    return this.customRequestStorage.getClientCustomRequestQuestionById(id);
  }

  async getClientCustomRequestQuestionsBySectionId(sectionId: string) {
    return this.customRequestStorage.getClientCustomRequestQuestionsBySectionId(sectionId);
  }

  async getAllClientCustomRequestQuestionsByRequestId(requestId: string) {
    return this.customRequestStorage.getAllClientCustomRequestQuestionsByRequestId(requestId);
  }

  async updateClientCustomRequestQuestion(id: string, question: any) {
    return this.customRequestStorage.updateClientCustomRequestQuestion(id, question);
  }

  async deleteClientCustomRequestQuestion(id: string) {
    return this.customRequestStorage.deleteClientCustomRequestQuestion(id);
  }

  async updateCustomRequestQuestionOrders(updates: { id: string; order: number }[]) {
    return this.customRequestStorage.updateCustomRequestQuestionOrders(updates);
  }

  // ============================================================================
  // STAGE 12: Tasks Domain - 54 methods delegated
  // ============================================================================

  // Task Instance operations (11 methods) - TaskInstanceStorage
  async createTaskInstance(instance: any) {
    return this.taskInstanceStorage.createTaskInstance(instance);
  }

  async getTaskInstanceById(id: string) {
    return this.taskInstanceStorage.getTaskInstanceById(id);
  }

  async getTaskInstancesByProjectId(projectId: string) {
    return this.taskInstanceStorage.getTaskInstancesByProjectId(projectId);
  }

  async getTaskInstancesByClientId(clientId: string) {
    return this.taskInstanceStorage.getTaskInstancesByClientId(clientId);
  }

  async getTaskInstancesByClientPortalUserId(clientPortalUserId: string) {
    return this.taskInstanceStorage.getTaskInstancesByClientPortalUserId(clientPortalUserId);
  }

  async getTaskInstancesByPersonId(personId: string) {
    return this.taskInstanceStorage.getTaskInstancesByPersonId(personId);
  }

  async getTaskInstancesByPersonIdAndClientId(personId: string, clientId: string) {
    return this.taskInstanceStorage.getTaskInstancesByPersonIdAndClientId(personId, clientId);
  }

  async getTaskInstancesByStatus(status: string) {
    return this.taskInstanceStorage.getTaskInstancesByStatus(status);
  }

  async getAllTaskInstances(filters?: { status?: string; clientId?: string }) {
    return this.taskInstanceStorage.getAllTaskInstances(filters);
  }

  async updateTaskInstance(id: string, instance: any) {
    return this.taskInstanceStorage.updateTaskInstance(id, instance);
  }

  async deleteTaskInstance(id: string) {
    return this.taskInstanceStorage.deleteTaskInstance(id);
  }

  async getTaskInstanceWithFullData(id: string) {
    return this.taskInstanceStorage.getTaskInstanceWithFullData(id);
  }

  // Task Instance Response operations (6 methods) - TaskInstanceResponseStorage
  async saveTaskInstanceResponse(response: any) {
    return this.taskInstanceResponseStorage.saveTaskInstanceResponse(response);
  }

  async createTaskInstanceResponse(response: any) {
    return this.taskInstanceResponseStorage.createTaskInstanceResponse(response);
  }

  async getTaskInstanceResponseById(id: string) {
    return this.taskInstanceResponseStorage.getTaskInstanceResponseById(id);
  }

  async getTaskInstanceResponsesByTaskInstanceId(taskInstanceId: string) {
    return this.taskInstanceResponseStorage.getTaskInstanceResponsesByTaskInstanceId(taskInstanceId);
  }

  // IStorage interface alias
  async getTaskInstanceResponsesByInstanceId(instanceId: string) {
    return this.taskInstanceResponseStorage.getTaskInstanceResponsesByTaskInstanceId(instanceId);
  }

  async updateTaskInstanceResponse(id: string, response: any) {
    return this.taskInstanceResponseStorage.updateTaskInstanceResponse(id, response);
  }

  async deleteTaskInstanceResponse(id: string) {
    return this.taskInstanceResponseStorage.deleteTaskInstanceResponse(id);
  }

  async bulkSaveTaskInstanceResponses(taskInstanceId: string, responses: any[]) {
    return this.taskInstanceResponseStorage.bulkSaveTaskInstanceResponses(taskInstanceId, responses);
  }

  // Task Type operations (6 methods) - TaskTypeStorage
  async createTaskType(taskType: any) {
    return this.taskTypeStorage.createTaskType(taskType);
  }

  async getTaskTypeById(id: string) {
    return this.taskTypeStorage.getTaskTypeById(id);
  }

  async getAllTaskTypes(includeInactive = false) {
    return this.taskTypeStorage.getAllTaskTypes(includeInactive);
  }

  async getActiveTaskTypes() {
    return this.taskTypeStorage.getActiveTaskTypes();
  }

  async updateTaskType(id: string, taskType: any) {
    return this.taskTypeStorage.updateTaskType(id, taskType);
  }

  async deleteTaskType(id: string) {
    return this.taskTypeStorage.deleteTaskType(id);
  }

  // Internal Task operations (14 methods) - InternalTaskStorage
  async createInternalTask(task: any) {
    return this.internalTaskStorage.createInternalTask(task);
  }

  async getInternalTaskById(id: string) {
    return this.internalTaskStorage.getInternalTaskById(id);
  }

  async getInternalTasksByAssignee(assigneeId: string, filters?: { status?: string; priority?: string }) {
    return this.internalTaskStorage.getInternalTasksByAssignee(assigneeId, filters);
  }

  async getInternalTasksByCreator(creatorId: string, filters?: { status?: string; priority?: string }) {
    return this.internalTaskStorage.getInternalTasksByCreator(creatorId, filters);
  }

  async getAllInternalTasks(filters?: { status?: string; priority?: string; assigneeId?: string; creatorId?: string }) {
    return this.internalTaskStorage.getAllInternalTasks(filters);
  }

  async getInternalTasksByClient(clientId: string) {
    return this.internalTaskStorage.getInternalTasksByClient(clientId);
  }

  async getInternalTasksByProject(projectId: string) {
    return this.internalTaskStorage.getInternalTasksByProject(projectId);
  }

  async updateInternalTask(id: string, task: any) {
    return this.internalTaskStorage.updateInternalTask(id, task);
  }

  async closeInternalTask(id: string, closeData: any, userId: string) {
    return this.internalTaskStorage.closeInternalTask(id, closeData, userId);
  }

  async deleteInternalTask(id: string) {
    return this.internalTaskStorage.deleteInternalTask(id);
  }

  async archiveInternalTask(id: string, userId: string) {
    return this.internalTaskStorage.archiveInternalTask(id, userId);
  }

  async unarchiveInternalTask(id: string) {
    return this.internalTaskStorage.unarchiveInternalTask(id);
  }

  async bulkReassignTasks(taskIds: string[], assignedTo: string) {
    return this.internalTaskStorage.bulkReassignTasks(taskIds, assignedTo);
  }

  async bulkUpdateTaskStatus(taskIds: string[], status: string) {
    return this.internalTaskStorage.bulkUpdateTaskStatus(taskIds, status);
  }

  // Task Connection operations (3 methods) - InternalTaskStorage
  async createTaskConnection(connection: any) {
    return this.internalTaskStorage.createTaskConnection(connection);
  }

  async getTaskConnectionsByTaskId(taskId: string) {
    return this.internalTaskStorage.getTaskConnectionsByTaskId(taskId);
  }

  async deleteTaskConnection(id: string) {
    return this.internalTaskStorage.deleteTaskConnection(id);
  }

  // Task Progress Notes operations (3 methods) - InternalTaskStorage
  async createTaskProgressNote(note: any) {
    return this.internalTaskStorage.createTaskProgressNote(note);
  }

  async getTaskProgressNotesByTaskId(taskId: string) {
    return this.internalTaskStorage.getTaskProgressNotesByTaskId(taskId);
  }

  async deleteTaskProgressNote(id: string) {
    return this.internalTaskStorage.deleteTaskProgressNote(id);
  }

  // Task Document operations (4 methods) - InternalTaskStorage
  async createTaskDocument(document: any) {
    return this.internalTaskStorage.createTaskDocument(document);
  }

  async getTaskDocument(id: string) {
    return this.internalTaskStorage.getTaskDocument(id);
  }

  async getTaskDocuments(taskId: string) {
    return this.internalTaskStorage.getTaskDocuments(taskId);
  }

  // IStorage interface alias
  async getTaskDocumentsByTaskId(taskId: string) {
    return this.internalTaskStorage.getTaskDocuments(taskId);
  }

  async deleteTaskDocument(id: string) {
    return this.internalTaskStorage.deleteTaskDocument(id);
  }

  // Task Time Entry operations (5 methods) - TaskTimeEntryStorage
  async createTaskTimeEntry(entry: any) {
    return this.taskTimeEntryStorage.createTaskTimeEntry(entry);
  }

  async getTaskTimeEntriesByTaskId(taskId: string) {
    return this.taskTimeEntryStorage.getTaskTimeEntriesByTaskId(taskId);
  }

  async getActiveTaskTimeEntry(taskId: string, userId: string) {
    return this.taskTimeEntryStorage.getActiveTaskTimeEntry(taskId, userId);
  }

  async stopTaskTimeEntry(id: string, stopData: any) {
    return this.taskTimeEntryStorage.stopTaskTimeEntry(id, stopData);
  }

  async deleteTaskTimeEntry(id: string) {
    return this.taskTimeEntryStorage.deleteTaskTimeEntry(id);
  }

  // ============================================================================
  // STAGE 13: Notifications Domain - 21 methods delegated
  // ============================================================================

  // Project Type Notification operations (6 methods) - ProjectTypeNotificationStorage
  async getProjectTypeNotificationsByProjectTypeId(projectTypeId: string) {
    return this.projectTypeNotificationStorage.getProjectTypeNotificationsByProjectTypeId(projectTypeId);
  }

  async getProjectTypeNotificationById(id: string) {
    return this.projectTypeNotificationStorage.getProjectTypeNotificationById(id);
  }

  async createProjectTypeNotification(notification: any) {
    return this.projectTypeNotificationStorage.createProjectTypeNotification(notification);
  }

  async updateProjectTypeNotification(id: string, notification: any) {
    return this.projectTypeNotificationStorage.updateProjectTypeNotification(id, notification);
  }

  async deleteProjectTypeNotification(id: string) {
    return this.projectTypeNotificationStorage.deleteProjectTypeNotification(id);
  }

  async getPreviewCandidates(projectTypeId: string, notification: any) {
    return this.projectTypeNotificationStorage.getPreviewCandidates(projectTypeId, notification);
  }

  // Client Request Reminder operations (5 methods) - ClientReminderStorage
  async getClientRequestRemindersByNotificationId(notificationId: string) {
    return this.clientReminderStorage.getClientRequestRemindersByNotificationId(notificationId);
  }

  async getClientRequestReminderById(id: string) {
    return this.clientReminderStorage.getClientRequestReminderById(id);
  }

  async createClientRequestReminder(reminder: any) {
    return this.clientReminderStorage.createClientRequestReminder(reminder);
  }

  async updateClientRequestReminder(id: string, reminder: any) {
    return this.clientReminderStorage.updateClientRequestReminder(id, reminder);
  }

  async deleteClientRequestReminder(id: string) {
    return this.clientReminderStorage.deleteClientRequestReminder(id);
  }

  // Scheduled Notification operations (5 methods) - ScheduledNotificationStorage
  async getAllScheduledNotifications() {
    return this.scheduledNotificationStorage.getAllScheduledNotifications();
  }

  async getScheduledNotificationById(id: string) {
    return this.scheduledNotificationStorage.getScheduledNotificationById(id);
  }

  async getScheduledNotificationsForClient(clientId: string, filters?: any) {
    return this.scheduledNotificationStorage.getScheduledNotificationsForClient(clientId, filters);
  }

  async updateScheduledNotification(id: string, notification: any) {
    return this.scheduledNotificationStorage.updateScheduledNotification(id, notification);
  }

  async cancelScheduledNotificationsForProject(projectId: string, reason: string) {
    return this.scheduledNotificationStorage.cancelScheduledNotificationsForProject(projectId, reason);
  }

  // Notification History operations (2 methods) - NotificationHistoryStorage
  async getNotificationHistoryByClientId(clientId: string) {
    return this.notificationHistoryStorage.getNotificationHistoryByClientId(clientId);
  }

  async getNotificationHistoryByProjectId(projectId: string) {
    return this.notificationHistoryStorage.getNotificationHistoryByProjectId(projectId);
  }

  // Stage Change Notification operations (4 methods) - StageChangeNotificationStorage
  async prepareStageChangeNotification(projectId: string, newStageName: string, oldStageName?: string) {
    return this.stageChangeNotificationStorage.prepareStageChangeNotification(projectId, newStageName, oldStageName);
  }

  async sendStageChangeNotifications(projectId: string, newStageName: string, oldStageName?: string) {
    return this.stageChangeNotificationStorage.sendStageChangeNotifications(projectId, newStageName, oldStageName);
  }

  async prepareClientValueNotification(projectId: string, newStageName: string, sendingUserId: string, oldStageName?: string) {
    return this.stageChangeNotificationStorage.prepareClientValueNotification(projectId, newStageName, sendingUserId, oldStageName);
  }

  // ============================================================================
  // STAGE 14: Settings Domain (27 methods)
  // ============================================================================

  // User Notification Preferences operations (4 methods) - UserNotificationPreferencesStorage
  async getUserNotificationPreferences(userId: string) {
    return this.userNotificationPreferencesStorage.getUserNotificationPreferences(userId);
  }

  async createUserNotificationPreferences(preferences: any) {
    return this.userNotificationPreferencesStorage.createUserNotificationPreferences(preferences);
  }

  async updateUserNotificationPreferences(userId: string, preferences: any) {
    return this.userNotificationPreferencesStorage.updateUserNotificationPreferences(userId, preferences);
  }

  async getOrCreateDefaultNotificationPreferences(userId: string) {
    return this.userNotificationPreferencesStorage.getOrCreateDefaultNotificationPreferences(userId);
  }

  async getUsersWithSchedulingNotifications() {
    return this.userNotificationPreferencesStorage.getUsersWithSchedulingNotifications();
  }

  // Project/Company Views operations (6 methods) - ViewsStorage
  async createProjectView(view: any) {
    return this.viewsStorage.createProjectView(view);
  }

  async getProjectViewsByUserId(userId: string) {
    return this.viewsStorage.getProjectViewsByUserId(userId);
  }

  async updateProjectView(id: string, updates: any) {
    return this.viewsStorage.updateProjectView(id, updates);
  }

  async deleteProjectView(id: string) {
    return this.viewsStorage.deleteProjectView(id);
  }

  async createCompanyView(view: any) {
    return this.viewsStorage.createCompanyView(view);
  }

  async getCompanyViewsByUserId(userId: string) {
    return this.viewsStorage.getCompanyViewsByUserId(userId);
  }

  async deleteCompanyView(id: string) {
    return this.viewsStorage.deleteCompanyView(id);
  }

  // Service Assignment Views operations - ServiceAssignmentStorage
  async createServiceAssignmentView(view: any) {
    return this.serviceAssignmentStorage.createServiceAssignmentView(view);
  }

  async getServiceAssignmentViewsByUserId(userId: string) {
    return this.serviceAssignmentStorage.getServiceAssignmentViewsByUserId(userId);
  }

  async getServiceAssignmentViewById(id: string) {
    return this.serviceAssignmentStorage.getServiceAssignmentViewById(id);
  }

  async deleteServiceAssignmentView(id: string) {
    return this.serviceAssignmentStorage.deleteServiceAssignmentView(id);
  }

  async getServiceAssignmentsWithFilters(filters: any) {
    return this.serviceAssignmentStorage.getServiceAssignmentsWithFilters(filters);
  }

  async getPersonalServiceAssignmentsWithFilters(filters: any) {
    return this.serviceAssignmentStorage.getPersonalServiceAssignmentsWithFilters(filters);
  }

  async bulkReassignRole(params: any) {
    return this.serviceAssignmentStorage.bulkReassignRole(params);
  }

  async bulkUpdateServiceDates(params: any) {
    return this.serviceAssignmentStorage.bulkUpdateServiceDates(params);
  }

  // Column Preferences operations (3 methods) - ColumnPreferencesStorage
  async getUserColumnPreferences(userId: string, viewType?: string) {
    return this.columnPreferencesStorage.getUserColumnPreferences(userId, viewType);
  }

  async upsertUserColumnPreferences(preferences: any) {
    return this.columnPreferencesStorage.upsertUserColumnPreferences(preferences);
  }

  async updateUserColumnPreferences(userId: string, viewType: string, preferences: any) {
    return this.columnPreferencesStorage.updateUserColumnPreferences(userId, viewType, preferences);
  }

  // Dashboard operations (8 methods) - DashboardStorage
  async createDashboard(dashboard: any) {
    return this.dashboardStorage.createDashboard(dashboard);
  }

  async getDashboardsByUserId(userId: string) {
    return this.dashboardStorage.getDashboardsByUserId(userId);
  }

  async getSharedDashboards() {
    return this.dashboardStorage.getSharedDashboards();
  }

  async getDashboardById(id: string) {
    return this.dashboardStorage.getDashboardById(id);
  }

  async updateDashboard(id: string, dashboard: any) {
    return this.dashboardStorage.updateDashboard(id, dashboard);
  }

  async deleteDashboard(id: string) {
    return this.dashboardStorage.deleteDashboard(id);
  }

  async getHomescreenDashboard(userId: string) {
    return this.dashboardStorage.getHomescreenDashboard(userId);
  }

  async clearHomescreenDashboards(userId: string) {
    return this.dashboardStorage.clearHomescreenDashboards(userId);
  }

  // User Project Preferences operations (2 methods) - UserPreferencesStorage
  async getUserProjectPreferences(userId: string) {
    return this.userPreferencesStorage.getUserProjectPreferences(userId);
  }

  async upsertUserProjectPreferences(preferences: any) {
    return this.userPreferencesStorage.upsertUserProjectPreferences(preferences);
  }

  // Company Settings operations (2 methods) - CompanySettingsStorage
  async getCompanySettings() {
    return this.companySettingsStorage.getCompanySettings();
  }

  async updateCompanySettings(settings: any) {
    return this.companySettingsStorage.updateCompanySettings(settings);
  }

  // ✅ Stage 14 COMPLETE: All 27 settings domain methods extracted and delegated:
  // - UserNotificationPreferencesStorage: 4 methods (notification preferences CRUD)
  // - ViewsStorage: 6 methods (project and company views CRUD)
  // - ColumnPreferencesStorage: 3 methods (column preferences upsert/update)
  // - DashboardStorage: 8 methods (dashboard CRUD, homescreen management)
  // - UserPreferencesStorage: 4 methods (user project preferences)
  // - CompanySettingsStorage: 2 methods (company settings get/update)

  // ✅ Stage 13 COMPLETE: All 21 notifications domain methods extracted and delegated:
  // - ProjectTypeNotificationStorage: 6 methods (project type notification CRUD, preview candidates)
  // - ClientReminderStorage: 5 methods (client request reminder CRUD)
  // - ScheduledNotificationStorage: 5 methods (scheduled notification management)
  // - NotificationHistoryStorage: 2 methods (history queries by client/project)
  // - StageChangeNotificationStorage: 3 methods (stage change emails, push notifications, bulk assignments)

  // ✅ Stage 12 COMPLETE: All 54 tasks domain methods extracted and delegated:
  // - TaskInstanceStorage: 11 methods (task instances CRUD, queries)
  // - TaskInstanceResponseStorage: 6 methods (responses CRUD, bulk save)
  // - TaskTypeStorage: 6 methods (task types CRUD)
  // - InternalTaskStorage: 24 methods (internal tasks, connections, progress notes, documents)
  // - TaskTimeEntryStorage: 5 methods (time entries CRUD)

  // ✅ Stage 11 COMPLETE: All 53 requests domain methods extracted and delegated:
  // - ChChangeRequestStorage: 11 methods (CH change requests)
  // - RequestTemplateStorage: 24 methods (template categories, templates, sections, questions)
  // - CustomRequestStorage: 18 methods (custom requests, sections, questions)

  // ✅ Stage 10 COMPLETE: All 59 messages domain methods extracted and delegated:
  // - MessageThreadStorage: 9 methods (client message threads)
  // - MessageStorage: 9 methods (client messages)
  // - ProjectMessageThreadStorage: 8 methods (project message threads)
  // - ProjectMessageStorage: 5 methods (project messages)
  // - ProjectMessageParticipantStorage: 9 methods (project participants, unread summaries)
  // - StaffMessageThreadStorage: 7 methods (staff message threads)
  // - StaffMessageStorage: 5 methods (staff messages)
  // - StaffMessageParticipantStorage: 7 methods (staff participants, unread counts)

  // ✅ Stage 9 COMPLETE: All 32 documents & portal domain methods extracted and delegated:
  // - DocumentStorage: 11 methods (folders, documents, signed URLs)
  // - RiskAssessmentStorage: 7 methods (risk assessments, responses)
  // - PortalDocumentStorage: 4 methods (portal documents)
  // - PortalStorage: 12 methods (portal users, sessions)

  // ✅ Stage 8 COMPLETE: All 54 integration domain methods extracted and delegated:
  // - IntegrationStorage: 9 methods (user integrations, OAuth accounts)
  // - PushNotificationStorage: 14 methods (subscriptions, templates, icons)
  // - EmailStorage: 31 methods (Graph webhooks, email messages, threads, attachments, client email ops)

  // ✅ Stage 7 COMPLETE: All 28 supporting domain methods extracted and delegated:
  // - TagStorage: 13 methods (client tags, people tags, tag assignments)
  // - CommunicationStorage: 8 methods (communications query and CRUD)
  // - ProjectSchedulingStorage: 5 methods (scheduling history, run logs)

  // ✅ STAGE 6 SUMMARY (for reference):
  // - ServiceStorage: 13 methods (services CRUD, scheduled services, service owner resolution)
  // - WorkRoleStorage: 10 methods (work roles CRUD, service-role mappings)
  // - ServiceAssignmentStorage: 30 methods (client services, role assignments, people services, validation)

  // ============================================================================
  // WEBHOOKS DOMAIN - Delegated to WebhookStorage
  // ============================================================================

  async getAllWebhookConfigs() {
    return this.webhookStorage.getAllWebhookConfigs();
  }

  async getEnabledWebhookConfigs() {
    return this.webhookStorage.getEnabledWebhookConfigs();
  }

  async getWebhookConfigById(id: string) {
    return this.webhookStorage.getWebhookConfigById(id);
  }

  async createWebhookConfig(config: Parameters<typeof this.webhookStorage.createWebhookConfig>[0]) {
    return this.webhookStorage.createWebhookConfig(config);
  }

  async updateWebhookConfig(id: string, config: Parameters<typeof this.webhookStorage.updateWebhookConfig>[1]) {
    return this.webhookStorage.updateWebhookConfig(id, config);
  }

  async deleteWebhookConfig(id: string) {
    return this.webhookStorage.deleteWebhookConfig(id);
  }

  async createWebhookLog(log: Parameters<typeof this.webhookStorage.createWebhookLog>[0]) {
    return this.webhookStorage.createWebhookLog(log);
  }

  async updateWebhookLogStatus(
    id: string,
    status: 'pending' | 'success' | 'failed',
    responseCode?: string,
    responseBody?: string,
    errorMessage?: string
  ) {
    return this.webhookStorage.updateWebhookLogStatus(id, status, responseCode, responseBody, errorMessage);
  }

  async getWebhookLogsByClientId(clientId: string, limit?: number) {
    return this.webhookStorage.getWebhookLogsByClientId(clientId, limit);
  }

  async getWebhookLogsByWebhookId(webhookConfigId: string, limit?: number) {
    return this.webhookStorage.getWebhookLogsByWebhookId(webhookConfigId, limit);
  }

  async getRecentWebhookLogs(limit?: number) {
    return this.webhookStorage.getRecentWebhookLogs(limit);
  }

  async hasSuccessfulWebhookForClient(clientId: string, webhookConfigId: string) {
    return this.webhookStorage.hasSuccessfulWebhookForClient(clientId, webhookConfigId);
  }

  // ============================================================================
  // QBO (QUICKBOOKS ONLINE) DOMAIN - Delegated to QboStorage
  // ============================================================================

  async createQboConnection(data: Parameters<typeof this.qboStorage.createQboConnection>[0]) {
    return this.qboStorage.createQboConnection(data);
  }

  async getQboConnectionById(id: string) {
    return this.qboStorage.getQboConnectionById(id);
  }

  async getQboConnectionByClientId(clientId: string) {
    return this.qboStorage.getQboConnectionByClientId(clientId);
  }

  async getQboConnectionByRealmId(realmId: string) {
    return this.qboStorage.getQboConnectionByRealmId(realmId);
  }

  async getAllQboConnections() {
    return this.qboStorage.getAllQboConnections();
  }

  async getActiveQboConnections() {
    return this.qboStorage.getActiveQboConnections();
  }

  async updateQboConnection(id: string, data: Parameters<typeof this.qboStorage.updateQboConnection>[1]) {
    return this.qboStorage.updateQboConnection(id, data);
  }

  async deactivateQboConnection(id: string) {
    return this.qboStorage.deactivateQboConnection(id);
  }

  async deleteQboConnection(id: string) {
    return this.qboStorage.deleteQboConnection(id);
  }

  async updateQboConnectionTokens(
    id: string,
    accessTokenEncrypted: string,
    refreshTokenEncrypted: string,
    accessTokenExpiresAt: Date,
    refreshTokenExpiresAt: Date
  ) {
    return this.qboStorage.updateQboConnectionTokens(id, accessTokenEncrypted, refreshTokenEncrypted, accessTokenExpiresAt, refreshTokenExpiresAt);
  }

  async updateQboConnectionError(id: string, errorMessage: string) {
    return this.qboStorage.updateQboConnectionError(id, errorMessage);
  }

  async updateQboConnectionLastSync(id: string) {
    return this.qboStorage.updateQboConnectionLastSync(id);
  }

  async createQboOAuthState(data: Parameters<typeof this.qboStorage.createQboOAuthState>[0]) {
    return this.qboStorage.createQboOAuthState(data);
  }

  async getQboOAuthStateByState(state: string) {
    return this.qboStorage.getQboOAuthStateByState(state);
  }

  async markQboOAuthStateAsUsed(id: string) {
    return this.qboStorage.markQboOAuthStateAsUsed(id);
  }

  async cleanupExpiredQboOAuthStates() {
    return this.qboStorage.cleanupExpiredQboOAuthStates();
  }

  async getQboConnectionsWithClients() {
    return this.qboStorage.getQboConnectionsWithClients();
  }

  // QC Storage Methods
  async createQcRun(data: Parameters<typeof this.qcStorage.createQcRun>[0]) {
    return this.qcStorage.createQcRun(data);
  }

  async getQcRunById(id: string) {
    return this.qcStorage.getQcRunById(id);
  }

  async updateQcRun(id: string, data: Parameters<typeof this.qcStorage.updateQcRun>[1]) {
    return this.qcStorage.updateQcRun(id, data);
  }

  async getQcRunsByClientId(clientId: string, limit?: number) {
    return this.qcStorage.getQcRunsByClientId(clientId, limit);
  }

  async getLatestQcRunByClientId(clientId: string) {
    return this.qcStorage.getLatestQcRunByClientId(clientId);
  }

  async getQcRunWithDetails(runId: string) {
    return this.qcStorage.getQcRunWithDetails(runId);
  }

  async createQcResult(data: Parameters<typeof this.qcStorage.createQcResult>[0]) {
    return this.qcStorage.createQcResult(data);
  }

  async createQcResults(data: Parameters<typeof this.qcStorage.createQcResults>[0]) {
    return this.qcStorage.createQcResults(data);
  }

  async getQcResultsByRunId(runId: string) {
    return this.qcStorage.getQcResultsByRunId(runId);
  }

  async createQcResultItem(data: Parameters<typeof this.qcStorage.createQcResultItem>[0]) {
    return this.qcStorage.createQcResultItem(data);
  }

  async createQcResultItems(data: Parameters<typeof this.qcStorage.createQcResultItems>[0]) {
    return this.qcStorage.createQcResultItems(data);
  }

  async getQcResultItemsByResultId(resultId: string) {
    return this.qcStorage.getQcResultItemsByResultId(resultId);
  }

  async updateQcResultItem(id: string, data: Parameters<typeof this.qcStorage.updateQcResultItem>[1]) {
    return this.qcStorage.updateQcResultItem(id, data);
  }

  async getQcResultItemById(id: string) {
    return this.qcStorage.getQcResultItemById(id);
  }

  async approveQcResultItem(itemId: string, userId: string, note: string | null) {
    return this.qcStorage.approveQcResultItem(itemId, userId, note);
  }

  async escalateQcResultItem(itemId: string, userId: string, note: string | null) {
    return this.qcStorage.escalateQcResultItem(itemId, userId, note);
  }

  async resolveQcResultItem(itemId: string, userId: string, note: string | null) {
    return this.qcStorage.resolveQcResultItem(itemId, userId, note);
  }

  async createApprovalHistory(data: Parameters<typeof this.qcStorage.createApprovalHistory>[0]) {
    return this.qcStorage.createApprovalHistory(data);
  }

  async getApprovalHistoryByItemId(itemId: string) {
    return this.qcStorage.getApprovalHistoryByItemId(itemId);
  }

  async getPendingApprovalsByClientId(clientId: string) {
    return this.qcStorage.getPendingApprovalsByClientId(clientId);
  }

  async getQcRunSummary(runId: string) {
    return this.qcStorage.getQcRunSummary(runId);
  }

  async getLatestQcRunSummary(clientId: string) {
    return this.qcStorage.getLatestQcRunSummary(clientId);
  }

  // ============================================================================
  // QUERIES DOMAIN - Delegated to QueryStorage
  // ============================================================================

  async createQuery(query: any) {
    return this.queryStorage.createQuery(query);
  }

  async createQueries(queries: any[]) {
    return this.queryStorage.createQueries(queries);
  }

  async getQueryById(id: string) {
    return this.queryStorage.getQueryById(id);
  }

  async getQueriesByProjectId(projectId: string) {
    return this.queryStorage.getQueriesByProjectId(projectId);
  }

  async getQueryCountByProjectId(projectId: string) {
    return this.queryStorage.getQueryCountByProjectId(projectId);
  }

  async getOpenQueryCountByProjectId(projectId: string) {
    return this.queryStorage.getOpenQueryCountByProjectId(projectId);
  }

  async getOpenQueryCountsBatch(projectIds: string[]) {
    return this.queryStorage.getOpenQueryCountsBatch(projectIds);
  }

  async updateQuery(id: string, query: any, userId?: string) {
    return this.queryStorage.updateQuery(id, query, userId);
  }

  async deleteQuery(id: string) {
    return this.queryStorage.deleteQuery(id);
  }

  async deleteQueriesByProjectId(projectId: string) {
    return this.queryStorage.deleteQueriesByProjectId(projectId);
  }

  async bulkUpdateQueryStatus(ids: string[], status: any, updatedById: string) {
    return this.queryStorage.bulkUpdateQueryStatus(ids, status, updatedById);
  }

  async markQueriesAsSentToClient(ids: string[]) {
    return this.queryStorage.markQueriesAsSentToClient(ids);
  }

  async getQueriesByStatus(projectId: string, status: any) {
    return this.queryStorage.getQueriesByStatus(projectId, status);
  }

  async getQueryStatsByProjectId(projectId: string) {
    return this.queryStorage.getQueryStatsByProjectId(projectId);
  }

  // QUERY TOKEN DOMAIN - Delegated to QueryTokenStorage
  async createQueryResponseToken(data: any) {
    return this.queryTokenStorage.createToken(data);
  }

  async getQueryResponseTokenByValue(token: string) {
    return this.queryTokenStorage.getTokenByValue(token);
  }

  async getQueryResponseTokenById(id: string) {
    return this.queryTokenStorage.getTokenById(id);
  }

  async getQueryResponseTokensByProjectId(projectId: string) {
    return this.queryTokenStorage.getTokensByProjectId(projectId);
  }

  async markQueryTokenAccessed(tokenId: string) {
    return this.queryTokenStorage.markTokenAccessed(tokenId);
  }

  async markQueryTokenCompleted(tokenId: string) {
    return this.queryTokenStorage.markTokenCompleted(tokenId);
  }

  async updateQueryResponseToken(tokenId: string, updates: { recipientEmail?: string; recipientName?: string | null }) {
    return this.queryTokenStorage.updateToken(tokenId, updates);
  }

  async validateQueryResponseToken(token: string) {
    return this.queryTokenStorage.validateToken(token);
  }

  async getQueriesForToken(token: string) {
    return this.queryTokenStorage.getQueriesForToken(token);
  }

  async cleanupExpiredQueryTokens() {
    return this.queryTokenStorage.cleanupExpiredTokens();
  }

  async extendQueryResponseTokenExpiry(tokenId: string, additionalDays: number) {
    return this.queryTokenStorage.extendTokenExpiry(tokenId, additionalDays);
  }

  async getActiveQueryResponseTokensByProjectId(projectId: string) {
    return this.queryTokenStorage.getActiveTokensByProjectId(projectId);
  }

  // SCHEDULED QUERY REMINDERS DOMAIN - Delegated to ScheduledReminderStorage
  async createScheduledQueryReminder(data: any) {
    return this.scheduledReminderStorage.create(data);
  }

  async createScheduledQueryReminders(data: any[]) {
    return this.scheduledReminderStorage.createMany(data);
  }

  async getScheduledQueryReminderById(id: string) {
    return this.scheduledReminderStorage.getById(id);
  }

  async getScheduledQueryRemindersByTokenId(tokenId: string) {
    return this.scheduledReminderStorage.getByTokenId(tokenId);
  }

  async getScheduledQueryRemindersByProjectId(projectId: string) {
    return this.scheduledReminderStorage.getByProjectId(projectId);
  }

  async getDueQueryReminders() {
    return this.scheduledReminderStorage.getDueReminders();
  }

  async updateScheduledQueryReminderStatus(id: string, status: any, extras?: any) {
    return this.scheduledReminderStorage.updateStatus(id, status, extras);
  }

  async cancelScheduledQueryReminder(id: string, cancelledById: string) {
    return this.scheduledReminderStorage.cancel(id, cancelledById);
  }

  async cancelAllQueryRemindersForToken(tokenId: string, cancelledById: string) {
    return this.scheduledReminderStorage.cancelAllForToken(tokenId, cancelledById);
  }

  async skipRemainingQueryRemindersForToken(tokenId: string, reason?: string) {
    return this.scheduledReminderStorage.skipRemainingForToken(tokenId, reason);
  }

  async getPendingQueryReminderCountForToken(tokenId: string) {
    return this.scheduledReminderStorage.getPendingCountForToken(tokenId);
  }

  async deleteScheduledQueryReminder(id: string) {
    return this.scheduledReminderStorage.delete(id);
  }

  async deleteAllQueryRemindersForToken(tokenId: string) {
    return this.scheduledReminderStorage.deleteAllForToken(tokenId);
  }

}

// Export storage instance for backward compatibility
export const storage = new DatabaseStorage();

// ============================================================================
// EVOLUTION TRACKING:
// ============================================================================
// Stage 0: ✅ Foundation complete - facade with wildcard re-export
// Stage 1: ✅ Users domain extracted - 31 methods delegated  
// Stage 2: ✅ Clients domain extracted - 31 methods delegated
//          - ClientStorage: 27 methods (CRUD, relationships, chronology, tags, aliases, domains)
//          - CompaniesHouseStorage: 2 methods (CH integration)
//          - SearchStorage: 1 method (super search)
// Stage 3: ✅ People domain extracted - 15 methods delegated
//          - PeopleStorage: 10 methods (CRUD, portal status, CH sync, duplicate detection)
//          - ClientPeopleStorage: 5 methods (relationship CRUD)
//          Note: linkPersonToClient, unlinkPersonFromClient already in ClientStorage from Stage 2
// Stage 4: ✅ Projects domain extracted - 17 methods delegated (Part 1 + Part 2 COMPLETE)
//          - ProjectStorage: 13 methods total
//            * Part 1 (5 methods): createProject, getProject, updateProject, getActiveProjectsByClientAndType, getUniqueDueDatesForService
//            * Part 2 (8 methods): getAllProjects, getProjectsByUser, getProjectsByClient, getProjectsByClientServiceId, updateProjectStatus, getProjectAnalytics, sendBulkProjectAssignmentNotifications, createProjectsFromCSV
//          - ProjectChronologyStorage: 4 methods (createChronologyEntry, getProjectChronology, getMostRecentStageChange, getProjectProgressMetrics)
//          - Note: Client chronology methods (createClientChronologyEntry, getClientChronology) already in Stage 2 Clients domain
//          - Helper injection: 18 cross-domain helpers registered for configuration, services, notifications, and messaging dependencies
// Stage 5: ✅ Project configuration domain extracted - 51 methods delegated (COMPLETE)
//          - ProjectTypesStorage: 9 methods (project type CRUD, dependencies, force delete)
//          - ProjectStagesStorage: 28 methods (kanban stages, validation, change reasons, mappings, custom fields)
//          - ProjectApprovalsStorage: 14 methods (stage approvals, fields, responses, validation)
// Stage 6: ✅ Services domain extracted - 53 methods delegated (COMPLETE)
//          - ServiceStorage: 13 methods (services CRUD, scheduled services, service owner resolution)
//          - WorkRoleStorage: 10 methods (work roles CRUD, service-role mappings)
//          - ServiceAssignmentStorage: 30 methods (client services, role assignments, people services, validation)
//          - Helper updates: registerClientHelpers updated to use serviceAssignmentStorage instead of oldStorage
// Stage 7: ✅ Tags, Communications, & Scheduling extracted - 28 methods delegated (COMPLETE)
//          - TagStorage: 13 methods (client tags, people tags, tag assignments)
//          - CommunicationStorage: 8 methods (communications query and CRUD)
//          - ProjectSchedulingStorage: 5 methods (scheduling history, run logs)
//          - Self-contained domains: No cross-domain helpers needed
// Stage 8: ✅ Integrations domain extracted - 54 methods delegated (COMPLETE)
//          - IntegrationStorage: 9 methods (user integrations, OAuth accounts)
//          - PushNotificationStorage: 14 methods (push subscriptions, templates, notification icons)
//          - EmailStorage: 31 methods (Graph webhooks, sync state, email messages, threads, mailbox maps, 
//            unmatched emails, client email aliases, domain allowlist, attachments)
//          - Bug fixes: Corrected schema field mismatches in old storage.ts (isRead, isDraft, importance, 
//            threadId→canonicalConversationId, sentAt→sentDateTime, matchConfidence→clientMatchConfidence,
//            conversationId→canonicalConversationId, email→emailLowercase)
//          - Self-contained domain: No cross-domain helpers needed
// Stage 12: ✅ Tasks domain extracted - 54 methods delegated (COMPLETE)
//          - TaskInstanceStorage: 11 methods (task instances CRUD, queries)
//          - TaskInstanceResponseStorage: 6 methods (responses CRUD, bulk save)
//          - TaskTypeStorage: 6 methods (task types CRUD)
//          - InternalTaskStorage: 24 methods (internal tasks, connections, progress notes, documents)
//          - TaskTimeEntryStorage: 5 methods (time entries CRUD)
// Stage 13: ✅ Notifications domain extracted - 21 methods delegated (COMPLETE)
//          - ProjectTypeNotificationStorage: 6 methods (project type notification CRUD, preview candidates)
//          - ClientReminderStorage: 5 methods (client request reminder CRUD)
//          - ScheduledNotificationStorage: 5 methods (scheduled notification management)
//          - NotificationHistoryStorage: 2 methods (history queries by client/project)
//          - StageChangeNotificationStorage: 3 methods (stage change emails, push notifications, bulk assignments)
//          - Cross-domain helpers: Notification helpers updated in registerProjectHelpers
//          - Note: Push notification templates (9 methods) already extracted in Stage 8 Integrations
// Stage 14: ✅ Settings domain extracted - 27 methods delegated (COMPLETE)
//          - UserNotificationPreferencesStorage: 4 methods (notification preferences CRUD)
//          - ViewsStorage: 6 methods (project and company views CRUD)
//          - ColumnPreferencesStorage: 3 methods (column preferences upsert/update)
//          - DashboardStorage: 8 methods (dashboard CRUD, homescreen management)
//          - UserPreferencesStorage: 4 methods (user project preferences)
//          - CompanySettingsStorage: 2 methods (company settings get/update)
// Stage 15: ✅ Final cleanup COMPLETE - deleted 13,630-line old storage.ts file
// ============================================================================