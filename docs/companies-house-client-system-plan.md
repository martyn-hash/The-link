# Companies House Client Management System - Implementation Plan

## Overview

This document outlines the implementation plan for integrating Companies House API into the existing client management system, creating a comprehensive client-people-service management solution.

## Key Concepts from Requirements

### Core Philosophy
- **Authoritative Data First**: Leverage Companies House as the single source of truth for UK company data
- **Relationship-Centric Design**: Model the complex real-world relationships between companies, people, and services
- **Compliance-Aware**: Automatically track regulatory requirements and filing deadlines
- **Non-Destructive Data**: Preserve original API responses for audit trails and future analysis

### Data Model Architecture

#### 1. Extended Clients Table
Transform from simple client records to comprehensive company profiles:

**Companies House Integration Fields:**
- `companyNumber` - Unique CH identifier (lookup key)
- `companiesHouseName` - Official registered name
- `companyStatus` - Current legal status (active, dissolved, etc.)
- `companyType` - Legal structure (ltd, plc, etc.)
- `dateOfCreation` - Incorporation date
- `jurisdiction` - Legal jurisdiction (england-wales, scotland, etc.)
- `sicCodes` - Standard Industrial Classification codes (array)

**Registered Office Address:**
- Complete address fields (registeredAddress1-4, registeredPostcode)
- Distinguished from trading/correspondence addresses

**Compliance Tracking:**
- `accountingReferenceDay/Month` - Financial year end
- `lastAccountsMadeUpTo` - Last filed accounts date
- `nextAccountsDue` - Next accounts deadline
- `accountsOverdue` - Boolean compliance flag
- `confirmationStatementOverdue` - Annual statement compliance
- `companiesHouseData` - Full JSON preservation

#### 2. People Table
Comprehensive person management supporting both CH officers and manual contacts:

**Core Identity:**
- `firstName`, `lastName`, `fullName` - Flexible name handling
- `personNumber` - CH person identifier for cross-company tracking

**Companies House Specific:**
- `nationality`, `countryOfResidence` - CH required fields
- `occupation` - Professional role
- `dateOfBirthMonth/Year` - Privacy-preserving birth date

**Dual Address System:**
- Correspondence address (day-to-day contact)
- Registered address (official CH address)

#### 3. Client-People Relationships
Junction table modeling complex real-world relationships:
- Official CH roles (director, secretary, etc.)
- Custom relationship types (contact, shareholder, etc.)
- Appointment/resignation tracking with dates
- Active status management

### Companies House API Integration Strategy

#### Data Flow Architecture
1. **Company Lookup**: User provides company number → API fetches complete profile
2. **Data Transformation**: Raw CH response → Application schema mapping
3. **Officer Discovery**: Automatic population of people and relationships
4. **Data Preservation**: Complete audit trail with original responses

#### Key Benefits
- **Instant Population**: Complex organizational data filled automatically
- **Compliance Monitoring**: Automatic tracking of regulatory deadlines
- **Relationship Discovery**: Company officers automatically linked
- **Data Quality**: Government-verified, authoritative information

## Implementation Phases

### Phase 1: Foundation (Schema & API)
**Objective**: Establish data foundation and CH API integration

**Tasks:**
1. Extend clients table with Companies House fields
2. Create people table and client-people relationships
3. Build Companies House API service with proper error handling
4. Implement data transformation utilities (CH → internal schema)
5. Set up secrets management for CH API key
6. Create database migrations

**Key Deliverables:**
- Extended database schema
- Working CH API integration
- Data transformation layer

### Phase 2: Core Client Creation Flow
**Objective**: Replace existing client creation with CH lookup

**Tasks:**
1. Build new client creation modal with CH lookup
2. Implement company number validation and search
3. Create company confirmation step with CH data display
4. Handle CH officer population and relationship creation
5. Integrate with existing service assignment system
6. Add comprehensive error handling

**Key Deliverables:**
- New client creation flow
- Company lookup and confirmation
- Officer auto-population

### Phase 3: Client Detail Management
**Objective**: Rich client detail view with comprehensive information

**Tasks:**
1. Create client detail view with tabbed interface
2. Build Overview tab with company details and related people
3. Preserve existing service management functionality
4. Add people management within client context
5. Implement chronology and communication tracking placeholders
6. Create navigation integration

**Key Deliverables:**
- Comprehensive client detail view
- Related people management
- Service integration maintenance

## Technical Architecture Decisions

### Data Integrity Patterns
- **Atomic Operations**: Client creation with services/roles as single transaction
- **Validation Layers**: Multi-level validation (client, server, database)
- **Audit Trails**: Complete preservation of source data
- **Rollback Safety**: Transaction-safe operations with cleanup

### API Integration Patterns
- **Centralized Client**: Single `CompaniesHouseAPI` class
- **Custom Errors**: Specific error types for different API conditions
- **Rate Limit Handling**: Proper backoff and retry logic
- **Response Caching**: Optional caching for repeated lookups

### UI/UX Design Principles
- **Progressive Disclosure**: Simple lookup → detailed confirmation → full management
- **Error Recovery**: Clear error messages with retry options
- **Data Confidence**: Visual indicators for CH-verified vs manual data
- **Workflow Integration**: Seamless integration with existing service assignments

## Migration Strategy

### Existing Data Preservation
- Current clients remain unchanged with null CH fields
- Service assignments preserved through schema extension
- Users can "upgrade" existing clients via CH lookup later
- No breaking changes to existing functionality

### Backwards Compatibility
- All existing API endpoints continue to work
- Current client management modal phased out gracefully
- New features additive, not replacement initially

## Success Metrics

### Functional Goals
- [ ] CH company lookup working with test company (13606514)
- [ ] Officers automatically populated with relationships
- [ ] Service assignments integrated with new client model
- [ ] Client detail view displaying comprehensive CH data
- [ ] Error handling for all CH API scenarios

### Technical Goals
- [ ] Zero data loss during migration
- [ ] All existing functionality preserved
- [ ] Response times under 2 seconds for CH lookups
- [ ] Comprehensive error handling and user feedback
- [ ] Audit trail for all CH data operations

## Risk Mitigation

### API Dependencies
- **CH API Downtime**: Graceful degradation to manual entry
- **Rate Limiting**: Proper backoff and user feedback
- **Data Changes**: CH schema evolution handling

### Data Quality
- **Validation**: Multi-layer validation before persistence
- **Reconciliation**: Mechanisms to handle CH data updates
- **User Override**: Allow manual corrections when needed

## Next Steps

1. **Phase 1 Implementation**: Begin with schema extensions and CH API integration
2. **Testing Strategy**: Comprehensive testing with real CH data
3. **User Training**: Documentation for new workflow patterns
4. **Performance Monitoring**: Track CH API integration performance
5. **Iterative Enhancement**: Continuous improvement based on user feedback

---

*This document serves as the roadmap for transforming the current basic client management into a sophisticated Companies House-integrated system that provides authoritative data, compliance monitoring, and comprehensive relationship management.*