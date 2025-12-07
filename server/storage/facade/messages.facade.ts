import {
  MessageThreadStorage,
  MessageStorage,
  ProjectMessageThreadStorage,
  ProjectMessageStorage,
  ProjectMessageParticipantStorage,
  StaffMessageThreadStorage,
  StaffMessageStorage,
  StaffMessageParticipantStorage
} from '../messages/index.js';

export interface MessagesFacadeDeps {
  messageThreadStorage: MessageThreadStorage;
  messageStorage: MessageStorage;
  projectMessageThreadStorage: ProjectMessageThreadStorage;
  projectMessageStorage: ProjectMessageStorage;
  projectMessageParticipantStorage: ProjectMessageParticipantStorage;
  staffMessageThreadStorage: StaffMessageThreadStorage;
  staffMessageStorage: StaffMessageStorage;
  staffMessageParticipantStorage: StaffMessageParticipantStorage;
}

type Constructor<T = {}> = new (...args: any[]) => T;

export function applyMessagesFacade<TBase extends Constructor<MessagesFacadeDeps>>(Base: TBase) {
  return class extends Base {
    // ============================================================================
    // CLIENT MESSAGE THREAD OPERATIONS - MessageThreadStorage (9 methods)
    // ============================================================================

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

    // ============================================================================
    // CLIENT MESSAGE OPERATIONS - MessageStorage (9 methods)
    // ============================================================================

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

    // ============================================================================
    // PROJECT MESSAGE THREAD OPERATIONS - ProjectMessageThreadStorage (9 methods)
    // ============================================================================

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

    // ============================================================================
    // PROJECT MESSAGE OPERATIONS - ProjectMessageStorage (5 methods)
    // ============================================================================

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

    // ============================================================================
    // PROJECT MESSAGE PARTICIPANT OPERATIONS - ProjectMessageParticipantStorage (11 methods)
    // ============================================================================

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

    // ============================================================================
    // STAFF MESSAGE THREAD OPERATIONS - StaffMessageThreadStorage (9 methods)
    // ============================================================================

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

    async getUnreadStaffMessageCountForUser(userId: string): Promise<number> {
      return this.staffMessageThreadStorage.getUnreadStaffThreadCountForUser(userId);
    }

    // ============================================================================
    // STAFF MESSAGE OPERATIONS - StaffMessageStorage (5 methods)
    // ============================================================================

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

    // ============================================================================
    // STAFF MESSAGE PARTICIPANT OPERATIONS - StaffMessageParticipantStorage (7 methods)
    // ============================================================================

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
  };
}
