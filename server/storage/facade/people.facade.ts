import { PeopleStorage } from '../people/index.js';
import { ClientPeopleStorage } from '../people/index.js';

export interface PeopleFacadeDeps {
  peopleStorage: PeopleStorage;
  clientPeopleStorage: ClientPeopleStorage;
}

type Constructor<T = {}> = new (...args: any[]) => T;

export function applyPeopleFacade<TBase extends Constructor<PeopleFacadeDeps>>(Base: TBase) {
  return class extends Base {
    async createPerson(personData: any) {
      console.log('[FACADE] createPerson called - delegating to peopleStorage');
      const result = await this.peopleStorage.createPerson(personData);
      console.log('[FACADE] createPerson result ID:', result.id);
      return result;
    }

    async getPersonById(id: string) {
      return this.peopleStorage.getPersonById(id);
    }

    async getPersonByPersonNumber(personNumber: string) {
      return this.peopleStorage.getPersonByPersonNumber(personNumber);
    }

    async getPersonByEmail(email: string) {
      return this.peopleStorage.getPersonByEmail(email);
    }

    async getPersonByFullName(fullName: string) {
      return this.peopleStorage.getPersonByFullName(fullName);
    }

    async getAllPeople() {
      return this.peopleStorage.getAllPeople();
    }

    async getAllPeopleWithPortalStatus() {
      return this.peopleStorage.getAllPeopleWithPortalStatus();
    }

    async getPersonWithDetails(id: string) {
      return this.peopleStorage.getPersonWithDetails(id);
    }

    async updatePerson(id: string, personData: any) {
      return this.peopleStorage.updatePerson(id, personData);
    }

    async deletePerson(id: string) {
      return this.peopleStorage.deletePerson(id);
    }

    async upsertPersonFromCH(personData: any) {
      return this.peopleStorage.upsertPersonFromCH(personData);
    }

    async findPeopleByNameAndBirthDate(firstName: string, lastName: string, year: number, month: number) {
      return this.peopleStorage.findPeopleByNameAndBirthDate(firstName, lastName, year, month);
    }

    async createClientPerson(relationship: any) {
      return this.clientPeopleStorage.createClientPerson(relationship);
    }

    async getClientPerson(clientId: string, personId: string) {
      return this.clientPeopleStorage.getClientPerson(clientId, personId);
    }

    async getClientPeopleByClientId(clientId: string) {
      return this.clientPeopleStorage.getClientPeopleByClientId(clientId);
    }

    async getClientPeopleByPersonId(personId: string) {
      return this.clientPeopleStorage.getClientPeopleByPersonId(personId);
    }

    async getClientPersonsByClientId(clientId: string) {
      return this.clientPeopleStorage.getClientPeopleByClientId(clientId);
    }

    async getClientPersonsByPersonId(personId: string) {
      return this.clientPeopleStorage.getClientPeopleByPersonId(personId);
    }

    async updateClientPerson(id: string, relationship: any) {
      return this.clientPeopleStorage.updateClientPerson(id, relationship);
    }

    async deleteClientPerson(id: string) {
      return this.clientPeopleStorage.deleteClientPerson(id);
    }
  };
}
