import { ClientStorage, CompaniesHouseStorage, SearchStorage } from '../clients/index.js';

export interface ClientsFacadeDeps {
  clientStorage: ClientStorage;
  companiesHouseStorage: CompaniesHouseStorage;
  searchStorage: SearchStorage;
}

type Constructor<T = {}> = new (...args: any[]) => T;

export function applyClientsFacade<TBase extends Constructor<ClientsFacadeDeps>>(Base: TBase) {
  return class extends Base {
    async createClient(clientData: any) {
      return this.clientStorage.createClient(clientData);
    }

    async getClientById(id: string) {
      return this.clientStorage.getClientById(id);
    }

    async getClientByName(name: string) {
      return this.clientStorage.getClientByName(name);
    }

    async getAllClients(search?: string) {
      return this.clientStorage.getAllClients(search);
    }

    async updateClient(id: string, clientData: any) {
      return this.clientStorage.updateClient(id, clientData);
    }

    async deleteClient(id: string) {
      return this.clientStorage.deleteClient(id);
    }

    async unlinkPersonFromClient(clientId: string, personId: string) {
      return this.clientStorage.unlinkPersonFromClient(clientId, personId);
    }

    async convertIndividualToCompanyClient(personId: string, companyData: any, oldIndividualClientId?: string) {
      return this.clientStorage.convertIndividualToCompanyClient(personId, companyData, oldIndividualClientId);
    }

    async linkPersonToClient(clientId: string, personId: string, officerRole?: string, isPrimaryContact?: boolean) {
      return this.clientStorage.linkPersonToClient(clientId, personId, officerRole, isPrimaryContact);
    }

    async getClientWithPeople(clientId: string) {
      return this.clientStorage.getClientWithPeople(clientId);
    }

    async createClientChronologyEntry(entry: any) {
      return this.clientStorage.createClientChronologyEntry(entry);
    }

    async getClientChronology(clientId: string) {
      return this.clientStorage.getClientChronology(clientId);
    }

    async getClientChronologyByClientId(clientId: string) {
      return this.clientStorage.getClientChronology(clientId);
    }

    async getAllClientEmailAliases() {
      return this.clientStorage.getAllClientEmailAliases();
    }

    async createClientEmailAlias(alias: any) {
      return this.clientStorage.createClientEmailAlias(alias);
    }

    async getClientEmailAliasesByClientId(clientId: string) {
      return this.clientStorage.getClientEmailAliasesByClientId(clientId);
    }

    async getClientEmailAliases(clientId: string) {
      return this.clientStorage.getClientEmailAliasesByClientId(clientId);
    }

    async getClientByEmailAlias(email: string) {
      return this.clientStorage.getClientByEmailAlias(email);
    }

    async deleteClientEmailAlias(id: string) {
      return this.clientStorage.deleteClientEmailAlias(id);
    }

    async createClientDomainAllowlist(domain: any) {
      return this.clientStorage.createClientDomainAllowlist(domain);
    }

    async getClientDomainAllowlist() {
      return this.clientStorage.getClientDomainAllowlist();
    }

    async getClientByDomain(domain: string) {
      return this.clientStorage.getClientByDomain(domain);
    }

    async deleteClientDomainAllowlist(id: string) {
      return this.clientStorage.deleteClientDomainAllowlist(id);
    }

    async getClientByCompanyNumber(companyNumber: string) {
      return this.companiesHouseStorage.getClientByCompanyNumber(companyNumber);
    }

    async upsertClientFromCH(clientData: any) {
      return this.companiesHouseStorage.upsertClientFromCH(clientData);
    }

    async superSearch(query: string, limit?: number) {
      return this.searchStorage.superSearch(query, limit);
    }
  };
}
