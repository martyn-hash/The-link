# Client - People - Service Roles: Schema Documentation

## Overview

This document outlines the data schema and relationships between Clients, People, and Service Roles in our system. These three core entities work together to create a comprehensive client management system that integrates with the Companies House API to provide rich organizational data.

## Core Entity Schemas

### 1. Clients Table

The `clients` table serves as the central entity for client organizations. It's designed primarily around UK companies that are registered with Companies House.

#### Key Fields and Rationale:

**Basic Client Information:**
- `id`: UUID primary key for unique identification
- `name`: Client's working name (may differ from official Companies House name)
- `email`: Primary contact email
- `clientType`: Classification (company, individual, etc.) - allows for non-company clients

**Companies House Integration Fields:**
- `companyNumber`: Unique Companies House identifier - serves as the lookup key
- `companiesHouseName`: Official registered name from Companies House
- `companyStatus`: Current status (active, dissolved, etc.) - critical for knowing if we can legally work with them
- `companyType`: Legal structure (ltd, plc, etc.) - affects compliance requirements
- `dateOfCreation`: When company was incorporated
- `jurisdiction`: Legal jurisdiction (england-wales, scotland, etc.)
- `sicCodes`: Array of Standard Industrial Classification codes - tells us what business they're in

**Registered Office Address:**
- Complete address fields (`registeredAddress1` through `registeredPostcode`)
- This is the official legal address, different from trading addresses

**Accounts Filing Information:**
- `accountingReferenceDay/Month`: When their financial year ends
- `lastAccountsMadeUpTo`: Date of last filed accounts
- `lastAccountsType`: Type of accounts filed (full, small, medium) - indicates company size
- `nextAccountsDue`: Deadline for next filing - critical for compliance tracking
- `accountsOverdue`: Boolean flag for overdue status

**Confirmation Statement Information:**
- Similar structure to accounts but for annual confirmation statements
- `confirmationStatementOverdue`: Boolean flag for compliance tracking

**Metadata:**
- `companiesHouseData`: Full JSON response preserved for audit trail and future data mining

#### Design Rationale:

The client schema is heavily influenced by Companies House data structure because:
1. It provides authoritative, government-verified data
2. Ensures we have comprehensive compliance information
3. Automatically populates complex organizational data
4. Provides audit trail through preserved JSON

The unique constraint on `companyNumber` prevents duplicate client records and enables efficient lookups.

### 2. People Table

The `people` table stores individual persons who may be associated with multiple clients in various capacities.

#### Key Fields and Rationale:

**Basic Information:**
- `firstName`, `lastName`: Decomposed name fields for flexible display
- `fullName`: Complete name as it appears in Companies House records
- Contact details (telephone, email, address fields)

**Companies House Specific Fields:**
- `personNumber`: Companies House person identifier - enables tracking across multiple companies
- `nationality`, `countryOfResidence`: Required by Companies House
- `occupation`: Professional role
- `dateOfBirthMonth/Year`: Privacy-preserving birth date (day omitted intentionally)

**Address Information:**
- Two address sets: correspondence and registered
- Correspondence address for day-to-day contact
- Registered address from Companies House (often different, may be accountant's office)

**Metadata:**
- `isFromCompaniesHouse`: Distinguishes between Companies House officers and manually added contacts
- `companiesHouseData`: Preserved API response for audit

#### Design Rationale:

The people schema accommodates both Companies House officers and manually added contacts. The dual address system recognizes that officers often have different correspondence and registered addresses. The privacy-preserving date of birth (month/year only) follows Companies House privacy standards while still providing useful demographic data.

### 3. Service Roles Architecture

The service roles system uses a multi-table approach to create flexible service delivery:

#### Services Table:
- `name`: Service name (e.g., "Bookkeeping", "Tax Preparation")
- `description`: Detailed service description
- `projectTypeId`: 1:1 relationship with project types
- `udfDefinitions`: JSON array of custom field definitions for service-specific data

#### Work Roles Table:
- `name`: Role name (e.g., "bookkeeper", "client_manager", "tax_advisor")
- `description`: Role responsibilities

#### Service Roles Table (Junction):
- Links services to the work roles required to deliver them
- Enables many-to-many relationships (one service can need multiple roles, one role can serve multiple services)

## Relationship Architecture

### Client-People Relationships

The `clientPeople` junction table creates the vital link between clients and people:

**Key Fields:**
- `clientId`, `personId`: Foreign keys to primary entities
- `officerRole`: Companies House role (director, secretary, etc.)
- `appointedOn`, `resignedOn`: Official appointment dates from Companies House
- `relationshipType`: Broader categorization (officer, contact, shareholder, etc.)
- `isActive`: Current status of relationship

**Design Rationale:**
This junction table accommodates the complex reality that:
- One person can hold multiple roles across different companies
- Relationships change over time (appointments/resignations)
- We need both Companies House official data and our own relationship tracking

### Client-Service Delivery

The service delivery system uses a three-layer approach:

1. **Client Services** (`clientServices`): Links clients to services they receive
2. **Service Roles** (`serviceRoles`): Defines what work roles are needed for each service
3. **Client Service Role Assignments** (`clientServiceRoleAssignments`): Assigns specific users to roles for client-service combinations

**Design Rationale:**
This three-layer system provides:
- Flexibility: Services can be reconfigured without affecting client assignments
- Scalability: New roles can be added to services without restructuring
- Accountability: Clear assignment of responsibility (who does what for which client)
- Compliance: Audit trail of who was responsible when

## Companies House API Integration

The Companies House API integration serves multiple critical functions:

### Data Population Strategy

**Company Data Flow:**
1. User provides company number
2. API fetches complete company profile
3. `transformCompanyData()` maps API response to client schema
4. Full API response preserved in `companiesHouseData` field

**Officer Data Flow:**
1. API fetches all company officers (handles pagination automatically)
2. `transformOfficersData()` creates people records and client-people relationships
3. Duplicate prevention via `personNumber` unique constraint

### Data Transformation Philosophy

The transformation functions (`transformCompanyData`, `transformOfficersData`) follow these principles:

1. **Preserve Authority**: Official data takes precedence over manual entry
2. **Non-Destructive**: Original API responses are always preserved
3. **Flexible Mapping**: Handles variations in API response structure
4. **Privacy Compliant**: Respects Companies House privacy standards (e.g., birth dates)

### Key Benefits

1. **Data Quality**: Government-verified, authoritative information
2. **Compliance**: Automatic tracking of filing deadlines and overdue status
3. **Relationship Mapping**: Automatic discovery of company officers and relationships
4. **Audit Trail**: Complete preservation of source data
5. **Efficiency**: Bulk population of complex organizational data

## Field Design Philosophy

### Why These Fields Matter

**Compliance Fields** (accounts due dates, overdue flags):
- Enable proactive client management
- Prevent compliance failures
- Automate reminder systems

**Address Separation** (registered vs. correspondence):
- Recognizes business reality of different contact methods
- Maintains legal accuracy for registered addresses
- Enables effective communication

**Metadata Preservation** (JSON fields):
- Future-proofs against API changes
- Enables data mining and analysis
- Provides audit trail
- Supports debugging and data quality checks

**Privacy Considerations** (partial birth dates):
- Follows Companies House standards
- Balances utility with privacy
- Enables age-based analysis without full PII exposure

## System Benefits

This schema design provides:

1. **Authoritative Data**: Government-verified information reduces data quality issues
2. **Relationship Tracking**: Complex real-world relationships properly modeled
3. **Service Delivery**: Clear accountability and role assignment
4. **Compliance Management**: Automatic tracking of regulatory requirements
5. **Scalability**: Flexible service and role system accommodates business growth
6. **Audit Trail**: Complete data lineage and change tracking

## Conclusion

The Client-People-Service Roles schema represents a sophisticated approach to client management that leverages authoritative government data while providing the flexibility needed for complex service delivery. The integration with Companies House API transforms what would otherwise be manual data entry into an automated, accurate, and comprehensive client onboarding process.

The multi-table relationship structure may seem complex, but it accurately reflects the real-world complexity of business relationships and service delivery, while maintaining data integrity and enabling powerful queries and reporting capabilities.