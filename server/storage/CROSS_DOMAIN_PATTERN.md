# Cross-Domain Helper Injection Pattern

## Overview

When extracting domain-specific storage modules from the monolithic `storage.ts`, some modules need to access methods from other domains to enrich their data. This document explains the pattern used to handle these cross-domain dependencies safely.

## The Challenge

During refactoring, we encounter situations where:
- A domain module needs data from another domain
- We cannot have circular dependencies between modules
- We must maintain backward compatibility during the transition

## The Solution: Helper Injection

Instead of modules directly importing each other (which creates circular dependencies), we inject helper functions or the entire storage instance when needed.

## Example: UserActivityStorage

The `UserActivityStorage` class needs to enrich activity data with details from other domains (projects, clients, people, etc.). Here's how it's implemented:

### 1. Constructor Injection

```typescript
export class UserActivityStorage {
  constructor(
    private db: ReturnType<typeof drizzle>,
    private storage?: any // Injected storage for cross-domain access
  ) {}
}
```

### 2. Usage in Facade

```typescript
// In server/storage/index.ts
export class DatabaseStorage implements IStorage {
  private oldStorage: OldDatabaseStorage;
  private userStorage: UserStorage;
  private userActivityStorage: UserActivityStorage;

  constructor(pool?: any, verbose?: boolean) {
    this.oldStorage = new OldDatabaseStorage(pool, verbose);
    this.userStorage = new UserStorage(db);
    // Pass oldStorage for cross-domain access
    this.userActivityStorage = new UserActivityStorage(db, this.oldStorage);
  }
}
```

### 3. Cross-Domain Access

```typescript
// In UserActivityStorage
async getRecentlyViewedByUser(userId: string, limit: number) {
  const activities = await this.getActivities(userId, limit);
  
  // Enrich with cross-domain data using injected storage
  for (const activity of activities) {
    if (activity.entityType === 'project' && this.storage) {
      activity.entityData = await this.storage.getProjectById(activity.entityId);
    }
    // ... other entity types
  }
  
  return activities;
}
```

## Guidelines for Future Stages

### When to Use This Pattern

Use helper injection when:
1. A domain needs read-only access to another domain's data
2. The data enrichment is for display purposes
3. The relationship is not core to the domain's business logic

### When NOT to Use This Pattern

Avoid helper injection when:
1. Two domains have core business logic dependencies (consider merging them)
2. The relationship requires transactional consistency (use a service layer instead)
3. It creates complex dependency chains

### Implementation Steps

1. **Identify Cross-Domain Needs**: During extraction, note which methods need external data
2. **Design the Interface**: Define minimal helper interfaces or use the full storage
3. **Inject via Constructor**: Pass helpers through the constructor, not imports
4. **Document Dependencies**: Clearly document why the injection is needed
5. **Plan for Removal**: Once all domains are extracted, replace with proper service layer

## Migration Path

### Current State (Stages 1-14)
- Use OldDatabaseStorage as the injected helper
- Provides access to all unmigrated methods
- Simple but couples to old implementation

### Target State (Stage 15+)
- Replace with specific service interfaces
- Use dependency injection container
- Clear separation of concerns

## Examples from Stage 1

### UserActivityStorage Constructor
```typescript
constructor(
  private db: ReturnType<typeof drizzle>,
  private storage?: any // Will be OldDatabaseStorage initially
)
```

### DatabaseStorage Facade
```typescript
// Delegation with helper injection
this.userActivityStorage = new UserActivityStorage(db, this.oldStorage);
```

### Method Using Cross-Domain Data
```typescript
async getRecentlyViewedByUser(userId: string, limit: number) {
  // Get activities from this domain
  const activities = await this.db
    .select()
    .from(userActivityTracking)
    .where(eq(userActivityTracking.userId, userId))
    .orderBy(desc(userActivityTracking.viewedAt))
    .limit(limit);

  // Enrich with cross-domain data if storage available
  if (this.storage) {
    for (const activity of activities) {
      switch (activity.entityType) {
        case 'project':
          activity.project = await this.storage.getProjectById(activity.entityId);
          break;
        case 'client':
          activity.client = await this.storage.getClientById(activity.entityId);
          break;
        // ... other cases
      }
    }
  }

  return activities;
}
```

## Benefits

1. **No Circular Dependencies**: Modules don't import each other
2. **Backward Compatible**: Can use old storage during transition
3. **Testable**: Can inject mocks for testing
4. **Flexible**: Can evolve to proper service layer

## Considerations

1. **Type Safety**: Using `any` loses type safety temporarily
2. **Performance**: May cause N+1 queries if not careful
3. **Complexity**: Adds a layer of indirection
4. **Temporary**: This is a transition pattern, not the final architecture

## Future Improvements

After all domains are extracted (Stage 15):
1. Define proper service interfaces
2. Use a DI container (e.g., tsyringe)
3. Implement caching for cross-domain queries
4. Add query optimization (batch loading)

## Conclusion

The cross-domain helper injection pattern allows us to safely extract domain modules while maintaining functionality that requires data from multiple domains. It's a pragmatic approach that enables incremental refactoring without breaking the application.