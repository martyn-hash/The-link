import { DocumentStorage, RiskAssessmentStorage, PortalDocumentStorage, SignatureStorage } from '../documents/index.js';
import { PortalStorage } from '../portal/index.js';

export interface DocumentsFacadeDeps {
  documentStorage: DocumentStorage;
  riskAssessmentStorage: RiskAssessmentStorage;
  portalDocumentStorage: PortalDocumentStorage;
  signatureStorage: SignatureStorage;
  portalStorage: PortalStorage;
}

type Constructor<T = {}> = new (...args: any[]) => T;

export function applyDocumentsFacade<TBase extends Constructor<DocumentsFacadeDeps>>(Base: TBase) {
  return class extends Base {
    // ============================================================================
    // DOCUMENT FOLDER OPERATIONS - DocumentStorage (4 methods)
    // ============================================================================

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

    // ============================================================================
    // DOCUMENT OPERATIONS - DocumentStorage (6 methods)
    // ============================================================================

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

    // ============================================================================
    // PORTAL DOCUMENT OPERATIONS - PortalDocumentStorage (4 methods)
    // ============================================================================

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

    // ============================================================================
    // RISK ASSESSMENT OPERATIONS - RiskAssessmentStorage (7 methods)
    // ============================================================================

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

    // ============================================================================
    // SIGNATURE REQUEST OPERATIONS - SignatureStorage (17 methods)
    // ============================================================================

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

    // ============================================================================
    // CLIENT PORTAL USER OPERATIONS - PortalStorage (8 methods)
    // ============================================================================

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

    // ============================================================================
    // CLIENT PORTAL SESSION OPERATIONS - PortalStorage (4 methods)
    // ============================================================================

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
  };
}
