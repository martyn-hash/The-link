# Developer Guide - Read Before Making Changes

**Last Updated:** November 26, 2025  
**Application:** The Link - CRM & Project Management

**Related Documentation:**
- High-level architecture: `replit.md`
- Architecture review: `app_observations.md`
- Active work plan: `APP_EXECUTION_PLAN.md`

---

## Quick Start for Testing

To test the application with full access:

1. Navigate to the root page (`/`)
2. Click on the **Password** tab
3. Login with these credentials:
   - **Email:** `georgewandhe@gmail.com`
   - **Password:** `TestPassword123`

For detailed test user credentials including portal users, see `DOCS/TEST_USER_CREDENTIALS.md`.

---

## Architecture Overview

### Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React + TypeScript, Wouter (routing), TanStack Query, shadcn/ui + Tailwind |
| Backend | Express.js + TypeScript |
| Database | PostgreSQL (Neon) via Drizzle ORM |
| Storage | Google Cloud Storage (Replit Object Storage) |
| Auth | Replit OIDC (staff) + Magic Links + Password (portal) |

### Key Directories

```
client/src/
├── components/ui/    # shadcn primitives - don't modify directly
├── components/       # Shared app components
├── pages/            # Route components (lazy-loaded)
├── hooks/            # Custom React hooks
└── lib/              # Utilities (queryClient, utils, etc.)

server/
├── routes/           # API endpoints (modular by domain)
│   └── clients/      # Client-specific route modules
├── storage/          # Data access layer (52 domain modules)
│   └── base/         # IStorage interface & types
├── core/             # Business logic (project creation, scheduling)
└── services/         # External integrations

shared/
└── schema/           # Database schema (10 domain modules)
    ├── users/        # User management, sessions
    ├── clients/      # Client entities
    ├── projects/     # Project management
    └── ...           # Other domains
```

---

## Critical Development Rules

### 1. Never Modify These Files

| File | Reason |
|------|--------|
| `server/vite.ts` | Core Vite dev server setup |
| `vite.config.ts` | Build configuration |
| `package.json` | Use packager tool for dependencies |
| `drizzle.config.ts` | Database configuration |

### 2. Schema and Types

**All schemas are now modular** in `shared/schema/` (10 domain modules). The legacy `shared/schema.ts` is just a compatibility shim for Drizzle Kit.

```typescript
// In shared/schema/[domain]/tables.ts
export const myTable = pgTable("my_table", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
});

// In shared/schema/[domain]/schemas.ts
export const insertMyTableSchema = createInsertSchema(myTable).omit({ id: true });
export type InsertMyTable = z.infer<typeof insertMyTableSchema>;
export type MyTable = typeof myTable.$inferSelect;
```

**Import paths:**
```typescript
// Preferred: Import from barrel export
import { users, type User, insertUserSchema } from '@shared/schema';

// Alternative: Import from specific domain
import { users, type User } from '@shared/schema/users';
```

### 3. Storage Layer Pattern

The storage layer uses a **facade pattern** with 52 domain-focused modules. All database operations go through the storage facade:

```typescript
// ✓ CORRECT - Use storage facade
import { storage } from './storage/index';
const client = await storage.getClientById(id);

// ✗ WRONG - Don't query database directly in routes
import { db } from './db';
const client = await db.query.clients.findFirst(...);
```

For new storage methods:
1. Add to domain storage module (e.g., `server/storage/clients/clientStorage.ts`)
2. Add to interface in `server/storage/base/IStorage.ts`
3. Add delegation in `server/storage/index.ts`

### 4. Route Pattern

Routes use consistent middleware injection:

```typescript
export function registerMyRoutes(
  app: Express,
  isAuthenticated: any,
  resolveEffectiveUser: any,
  requireAdmin: any,
  requireManager: any
) {
  app.get("/api/my-endpoint", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    const { effectiveUserId } = req;
    // Use effectiveUserId (handles impersonation correctly)
  });
}
```

### 5. Frontend Data Fetching

Use TanStack Query for all data fetching:

```typescript
// Queries
const { data, isLoading } = useQuery<MyType>({
  queryKey: ['/api/my-endpoint', id],  // Use array for proper cache invalidation
});

// Mutations
const mutation = useMutation({
  mutationFn: (data) => apiRequest('POST', '/api/my-endpoint', data),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['/api/my-endpoint'] });
  },
});
```

### 6. Form Handling

Always use react-hook-form with Zod validation:

```typescript
const form = useForm<InsertMyType>({
  resolver: zodResolver(insertMyTypeSchema),
  defaultValues: { name: '' },  // Always provide defaults
});
```

---

## Code Style Guidelines

### TypeScript

- Avoid `any` types where possible
- Use proper type imports: `import type { MyType } from '...'`
- Define interfaces in shared schema, not inline

### Components

- Use shadcn components from `@/components/ui/`
- Add `data-testid` attributes to interactive elements
- Follow naming pattern: `{action}-{target}` (e.g., `button-submit`, `input-email`)

### Styling

- Use Tailwind CSS utilities
- Follow existing color scheme (defined in `index.css`)
- Support dark mode with explicit variants: `bg-white dark:bg-gray-900`

---

## Testing Checklist

Before submitting changes, verify:

- [ ] Application starts without errors (`npm run dev`)
- [ ] No new LSP/TypeScript errors introduced
- [ ] New API endpoints have proper authentication middleware
- [ ] Database changes have corresponding schema updates
- [ ] Frontend changes work on mobile (check at 375px width)
- [ ] Forms have proper validation and error handling

### Testing with Playwright

For E2E testing, the testing agent can:
- Navigate and interact with browser
- Make API requests directly
- Verify UI elements

Always provide:
- Navigation path to feature
- Specific element selectors or data-testids
- Expected behavior to verify

---

## Performance Considerations

### Database Queries

1. **Avoid N+1 patterns:** Use batch methods when iterating over collections
2. **Use indexes:** Check `database_optimisations.md` for index requirements
3. **Limit relations:** Only load nested relations when needed

### Frontend

1. **Lazy loading:** All 60+ page components use React.lazy() with Suspense
2. **Query keys:** Use arrays for proper cache invalidation: `['/api/clients', id]`
3. **Loading states:** Always show skeleton/loading UI during queries

---

## Common Tasks

### Adding a New API Endpoint

1. Create/update storage method in appropriate domain module
2. Add to `IStorage` interface if new method
3. Add delegation in `server/storage/index.ts`
4. Add route in appropriate routes file with middleware
5. Test with proper authentication

### Adding a New Page

1. Create page component in `client/src/pages/`
2. Register route in `client/src/App.tsx` with React.lazy()
3. Add navigation link if needed (sidebar/menu)
4. Implement with proper loading and error states

### Adding a Database Table

1. Define table in appropriate `shared/schema/[domain]/tables.ts`
2. Add relations in `relations.ts`
3. Create insert schema and types in `schemas.ts` and `types.ts`
4. Export from domain index and main `shared/schema/index.ts`
5. Run database migration

---

## Getting Help

### Key Documentation Files

| Document | Purpose |
|----------|---------|
| `replit.md` | High-level architecture and features |
| `app_observations.md` | Architecture review and recommendations |
| `APP_EXECUTION_PLAN.md` | Active work plan and phase tracking |
| `speed_time.md` | Performance optimization history |
| `database_optimisations.md` | Database indexing strategy |
| `server/storage/CROSS_DOMAIN_PATTERN.md` | Cross-domain dependency patterns |
| `DOCS/TEST_USER_CREDENTIALS.md` | Test user accounts and login details |
| `DOCS/scheduling.md` | Service scheduling documentation |
| `DOCS/Service_and_Project_Logic.md` | Service/project business logic |

---

## Quick Reference: Import Paths

```typescript
// UI Components
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

// Data Layer
import { apiRequest, queryClient } from '@/lib/queryClient';
import { storage } from './storage/index';

// Schema & Types (modular architecture)
import { users, type User, insertUserSchema } from '@shared/schema';

// Utilities
import { cn } from '@/lib/utils';
```

---

## Final Reminders

1. **Test login:** Use `georgewandhe@gmail.com` / `TestPassword123` via Password tab
2. **Check types:** Run LSP diagnostics before completing work
3. **Don't modify:** Vite config, package.json, drizzle.config.ts
4. **Use storage facade:** Never query database directly in routes
5. **Document changes:** Update `replit.md` for significant architecture changes
6. **Modular schema:** All schemas in `shared/schema/` - legacy file is just a shim
