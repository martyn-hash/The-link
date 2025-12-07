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

// Import facade mixins and their dependency interfaces
import { applyUsersFacade, type UsersFacadeDeps } from './facade/users.facade.js';
import { applyPeopleFacade, type PeopleFacadeDeps } from './facade/people.facade.js';
import { applyClientsFacade, type ClientsFacadeDeps } from './facade/clients.facade.js';
import { applyProjectsFacade, type ProjectsFacadeDeps } from './facade/projects.facade.js';
import { applyServicesFacade, type ServicesFacadeDeps } from './facade/services.facade.js';
import { applyTagsCommsFacade, type TagsCommsFacadeDeps } from './facade/tags-comms.facade.js';
import { applyIntegrationsFacade, type IntegrationsFacadeDeps } from './facade/integrations.facade.js';
import { applyDocumentsFacade, type DocumentsFacadeDeps } from './facade/documents.facade.js';
import { applyMessagesFacade, type MessagesFacadeDeps } from './facade/messages.facade.js';
import { applyRequestsFacade, type RequestsFacadeDeps } from './facade/requests.facade.js';
import { applyTasksFacade, type TasksFacadeDeps } from './facade/tasks.facade.js';
import { applyNotificationsFacade, type NotificationsFacadeDeps } from './facade/notifications.facade.js';
import { applySettingsFacade, type SettingsFacadeDeps } from './facade/settings.facade.js';
import { applyMiscFacade, type MiscFacadeDeps } from './facade/misc.facade.js';

// Combined type that includes all facade dependencies
// This allows TypeScript to properly type the mixin chain
type AllStorageDeps = UsersFacadeDeps & 
  PeopleFacadeDeps & 
  ClientsFacadeDeps & 
  ProjectsFacadeDeps & 
  ServicesFacadeDeps & 
  TagsCommsFacadeDeps & 
  IntegrationsFacadeDeps & 
  DocumentsFacadeDeps & 
  MessagesFacadeDeps & 
  RequestsFacadeDeps & 
  TasksFacadeDeps & 
  NotificationsFacadeDeps & 
  SettingsFacadeDeps & 
  MiscFacadeDeps;

// Export shared types (new modular architecture)
export * from './base/types.js';

// Re-export the IStorage interface (critical for backward compatibility)
export type IStorage = OriginalIStorage;

// Re-export initialization function
export const initializeDefaultNotificationTemplates = modularInitTemplates;

// StorageBase class contains all storage instances and helper registration
class StorageBase {
  // Domain storage instances - public for facade mixin access
  public readonly userStorage: UserStorage;
  public readonly userActivityStorage: UserActivityStorage;
  public readonly clientStorage: ClientStorage;
  public readonly companiesHouseStorage: CompaniesHouseStorage;
  public readonly searchStorage: SearchStorage;
  public readonly peopleStorage: PeopleStorage;
  public readonly clientPeopleStorage: ClientPeopleStorage;
  public readonly projectStorage: ProjectStorage;
  public readonly projectChronologyStorage: ProjectChronologyStorage;
  public readonly projectTypesStorage: ProjectTypesStorage;
  public readonly projectStagesStorage: ProjectStagesStorage;
  public readonly projectApprovalsStorage: ProjectApprovalsStorage;
  public readonly projectSchedulingStorage: ProjectSchedulingStorage;
  public readonly stageChangeNotificationStorage: StageChangeNotificationStorage;
  public readonly serviceStorage: ServiceStorage;
  public readonly workRoleStorage: WorkRoleStorage;
  public readonly serviceAssignmentStorage: ServiceAssignmentStorage;
  public readonly tagStorage: TagStorage;
  public readonly communicationStorage: CommunicationStorage;
  public readonly integrationStorage: IntegrationStorage;
  public readonly pushNotificationStorage: PushNotificationStorage;
  public readonly emailStorage: EmailStorage;
  public readonly documentStorage: DocumentStorage;
  public readonly riskAssessmentStorage: RiskAssessmentStorage;
  public readonly portalDocumentStorage: PortalDocumentStorage;
  public readonly signatureStorage: SignatureStorage;
  public readonly portalStorage: PortalStorage;
  public readonly messageThreadStorage: MessageThreadStorage;
  public readonly messageStorage: MessageStorage;
  public readonly projectMessageThreadStorage: ProjectMessageThreadStorage;
  public readonly projectMessageStorage: ProjectMessageStorage;
  public readonly projectMessageParticipantStorage: ProjectMessageParticipantStorage;
  public readonly staffMessageThreadStorage: StaffMessageThreadStorage;
  public readonly staffMessageStorage: StaffMessageStorage;
  public readonly staffMessageParticipantStorage: StaffMessageParticipantStorage;
  public readonly chChangeRequestStorage: ChChangeRequestStorage;
  public readonly requestTemplateStorage: RequestTemplateStorage;
  public readonly customRequestStorage: CustomRequestStorage;
  public readonly taskInstanceStorage: TaskInstanceStorage;
  public readonly taskInstanceResponseStorage: TaskInstanceResponseStorage;
  public readonly taskTypeStorage: TaskTypeStorage;
  public readonly internalTaskStorage: InternalTaskStorage;
  public readonly taskTimeEntryStorage: TaskTimeEntryStorage;
  public readonly projectTypeNotificationStorage: ProjectTypeNotificationStorage;
  public readonly clientReminderStorage: ClientReminderStorage;
  public readonly scheduledNotificationStorage: ScheduledNotificationStorage;
  public readonly notificationHistoryStorage: NotificationHistoryStorage;
  public readonly userNotificationPreferencesStorage: UserNotificationPreferencesStorage;
  public readonly viewsStorage: ViewsStorage;
  public readonly columnPreferencesStorage: ColumnPreferencesStorage;
  public readonly dashboardStorage: DashboardStorage;
  public readonly userPreferencesStorage: UserPreferencesStorage;
  public readonly companySettingsStorage: CompanySettingsStorage;
  public readonly webhookStorage: WebhookStorage;
  public readonly qboStorage: QboStorage;
  public readonly qcStorage: QcStorage;
  public readonly queryStorage: QueryStorage;
  public readonly queryTokenStorage: QueryTokenStorage;
  public readonly scheduledReminderStorage: ScheduledReminderStorage;

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

// Type helper for mixin composition
type Constructor<T = {}> = new (...args: any[]) => T;

// Apply facade mixins to StorageBase - All 535+ methods provided by 14 facades
// Cast StorageBase as Constructor<AllStorageDeps> since it implements all required properties
const StorageBaseAsAllDeps = StorageBase as unknown as Constructor<AllStorageDeps>;
const DatabaseStorageWithUsers = applyUsersFacade(StorageBaseAsAllDeps);
const DatabaseStorageWithPeople = applyPeopleFacade(DatabaseStorageWithUsers);
const DatabaseStorageWithClients = applyClientsFacade(DatabaseStorageWithPeople);
const DatabaseStorageWithProjects = applyProjectsFacade(DatabaseStorageWithClients);
const DatabaseStorageWithServices = applyServicesFacade(DatabaseStorageWithProjects);
const DatabaseStorageWithTagsComms = applyTagsCommsFacade(DatabaseStorageWithServices);
const DatabaseStorageWithIntegrations = applyIntegrationsFacade(DatabaseStorageWithTagsComms);
const DatabaseStorageWithDocuments = applyDocumentsFacade(DatabaseStorageWithIntegrations);
const DatabaseStorageWithMessages = applyMessagesFacade(DatabaseStorageWithDocuments);
const DatabaseStorageWithRequests = applyRequestsFacade(DatabaseStorageWithMessages);
const DatabaseStorageWithTasks = applyTasksFacade(DatabaseStorageWithRequests);
const DatabaseStorageWithNotifications = applyNotificationsFacade(DatabaseStorageWithTasks);
const DatabaseStorageWithSettings = applySettingsFacade(DatabaseStorageWithNotifications);
const DatabaseStorageWithMisc = applyMiscFacade(DatabaseStorageWithSettings);

// DatabaseStorage extends the composed class and implements IStorage
export class DatabaseStorage extends DatabaseStorageWithMisc implements IStorage {
  constructor() {
    super();
  }
}

// Export storage instance for backward compatibility
export const storage = new DatabaseStorage();

// Modular Storage Architecture Complete - 535+ methods across 15 facade mixins
// See refactor-plans/03-storage-index-refactor.md for full documentation