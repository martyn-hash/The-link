/**
 * Clients Domain Storage Module
 * 
 * This module handles all client-related storage operations including:
 * - Core client CRUD operations
 * - Client-person relationships
 * - Client chronology tracking
 * - Client tags and tag assignments
 * - Email aliases and domain allowlisting
 * - Companies House integration
 * - Super search functionality across domains
 */

export { ClientStorage } from './clientStorage.js';
export { CompaniesHouseStorage } from './companiesHouseStorage.js';
export { SearchStorage } from './searchStorage.js';