# Missing Routes from Refactoring

## Summary
During the refactoring, **13 routes** were accidentally omitted from the modular structure.

## Missing Routes List

### Auth Module (auth.ts) - 7 routes missing
1. **DELETE /api/users/:id** (line 2949 in backup)
2. **PUT /api/users/profile** (line 2998 in backup)
3. **GET /api/dashboards/homescreen** (line 3389 in backup)
4. **GET /api/dashboards/:id** (line 3409 in backup)
5. **DELETE /api/auth/impersonate** (line 3578 in backup)
6. **GET /api/auth/impersonation-state** (line 3589 in backup)
7. **GET /api/documents/:id/file** (line 3985 in backup)

### Clients Module (clients.ts) - 4 routes missing
1. **GET /api/clients/:id/chronology** (line 2631 in backup)
2. **GET /api/client-tag-assignments** (line 3640 in backup)
3. **DELETE /api/portal-users/:portalUserId** (line 9210 in backup)
4. **PUT /api/portal-users/:portalUserId** (line 9144 in backup)

### Projects Module (projects.ts) - 1 route missing
1. **GET /api/clients/:clientId/projects** (line 4203 in backup)

### Integrations Module (integrations.ts) - 1 route missing
1. **POST /api/test-email** (line 7853 in backup)

## Impact
These routes are likely being called by the frontend and will return 404 errors until restored.

## Action Required
Add these routes back to their respective module files.
