import { BaseStorage } from '../base/BaseStorage';
import { db } from '../../db';
import { clients } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { Client, InsertClient } from '../../db/schema';

/**
 * Storage class for Companies House integration operations.
 * Handles client data synchronization with UK Companies House.
 * 
 * Cross-domain dependencies:
 * - ClientStorage: Uses updateClient and createClient for upserts
 */
export class CompaniesHouseStorage extends BaseStorage {
  /**
   * Get a client by their Companies House company number.
   */
  async getClientByCompanyNumber(companyNumber: string): Promise<Client | undefined> {
    const [client] = await db
      .select()
      .from(clients)
      .where(eq(clients.companyNumber, companyNumber))
      .limit(1);
    return client;
  }

  /**
   * Upsert client from Companies House data.
   * Updates existing client if company number matches, otherwise creates new.
   * Requires helpers for client CRUD operations.
   */
  async upsertClientFromCH(clientData: Partial<InsertClient>): Promise<Client> {
    // Check if client with this company number already exists
    if (clientData.companyNumber) {
      const existingClient = await this.getClientByCompanyNumber(clientData.companyNumber);
      if (existingClient) {
        // Update existing client with CH data (exclude id from update)
        const updateData = { ...clientData };
        delete (updateData as any).id;
        
        // Use helper to update client
        const updateHelper = this.getHelper('updateClient');
        if (!updateHelper) {
          throw new Error('Client update helper not available');
        }
        return await updateHelper(existingClient.id, updateData);
      }
    }
    
    // Create new client using helper
    const createHelper = this.getHelper('createClient');
    if (!createHelper) {
      throw new Error('Client create helper not available');
    }
    return await createHelper(clientData as InsertClient);
  }
}