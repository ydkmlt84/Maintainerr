# Code Review: PR #2330 — Add Jellyfin Support

> **Pre-merge cleanup:** Remove the `jellyfin-dev/` folder and its entry in `.gitignore` before merging to main.

**PR**: [Maintainerr/Maintainerr#2330](https://github.com/Maintainerr/Maintainerr/pull/2330)
**Author**: enoch85
**Size**: +13,986 / -3,019 across 164 files
**Commits**: 2 (main feature + dev branch warning)

---

## Overview

This PR introduces Jellyfin as an alternative media server to Plex. It includes:

- A **media-server abstraction layer** (`IMediaServerService` interface, factory, adapters)
- A **Jellyfin adapter** with full SDK integration (`@jellyfin/sdk`)
- A **Plex adapter** wrapping the existing `PlexApiService`
- **Rule migration** service for switching between servers
- **Media server switch** workflow with preview/confirm flow
- Database migrations for new schema (varchar IDs, Jellyfin settings columns)
- UI for Jellyfin configuration, server selection, and switching
- Shared contracts package with Zod validation
- Comprehensive test coverage (~87%)

---

## Critical Issues

### 1. `Promise.all()` failure mode in watch history batching
**Files**: `apps/server/src/modules/api/media-server/jellyfin/jellyfin-adapter.service.ts`

The Jellyfin adapter batches user queries with `Promise.all()`. If **any single user query fails**, the entire batch fails and no watch data is returned. Should use `Promise.allSettled()` to handle partial failures gracefully.

### 2. Database down-migration is unsafe
**File**: `apps/server/src/database/migrations/1767576516009-JellyfinSupport.ts`

- `collection_media.mediaServerId` (varchar) cannot reliably convert back to `plexId` (integer)
- `exclusion.mediaServerId NOT NULL` has no default — the down migration INSERT will fail
- `collection.libraryId` varchar → integer lacks conversion logic

If a rollback is ever needed, it will fail or cause data loss.

### 3. No validation that target server has credentials before switching
**File**: `apps/server/src/modules/settings/media-server-switch.service.ts`

The switch operation clears source credentials and resets collections **without checking** that the target server is configured. Users could lock themselves out of both servers.

### 4. Silent error swallowing in factory initialization
**File**: `apps/server/src/modules/api/media-server/media-server.factory.ts`

```typescript
try { await this.getService(); }
catch { /* Media server not configured yet */ }
```

Catches **all** errors silently — not just missing configuration but also network failures and auth errors.

---

## High Priority Issues

### 5. Watch record progress always returns 100%
**File**: `apps/server/src/modules/api/media-server/jellyfin/jellyfin.mapper.ts:269`

`progress: 100` is hardcoded. Should use `item.UserData?.PlayedPercentage` for accurate partial-watch tracking.

### 6. Cache reset is a no-op in Plex adapter
**File**: `apps/server/src/modules/api/media-server/plex/plex-adapter.service.ts`

`resetMetadataCache()` does nothing despite `PlexApiService` having this capability. Callers will believe the cache was cleared when it wasn't.

### 7. Query parameter types not parsed in controller
**File**: `apps/server/src/modules/api/media-server/media-server.controller.ts`

`@Query('page')` returns strings, not numbers. Without `ParseIntPipe`, pagination math operates on strings, producing incorrect offsets.

### 8. Race condition during media server switch
**File**: `apps/server/src/modules/settings/media-server-switch.service.ts`

Between updating settings and uninitializing the old server, concurrent API requests could route to the wrong adapter. No synchronization mechanism exists.

### 9. Critic rating normalization needs verification
**Files**: `apps/server/src/modules/api/media-server/jellyfin/jellyfin.mapper.ts`, `apps/server/src/modules/rules/getter/jellyfin-getter.service.ts`

Division by 10 assumes Jellyfin critic ratings are 0-100. If they're already 0-10, values will be incorrect. This should be verified against the Jellyfin API.

---

## Medium Priority Issues

### 10. Inconsistent error handling between adapters
- Plex: throws generic `Error('Failed to create collection')` with no details
- Jellyfin: returns empty arrays for read failures, throws for writes
- Neither approach is documented in the interface contract

### 11. Genre ID uses array index
**File**: `apps/server/src/modules/api/media-server/jellyfin/jellyfin.mapper.ts:371-374`

`id: index` is non-unique across items and fragile if genre order changes. Should use a hash of the genre name.

### 12. Collection type fallback maps to 'movie'
**File**: `apps/server/src/modules/api/media-server/plex/plex.mapper.ts`

Collections are always mapped to type `'movie'` regardless of actual content type. This could cause type mismatches for show collections.

### 13. External ratings return null on Jellyfin
IMDb, Rotten Tomatoes, and TMDB ratings return `null` in the Jellyfin getter. Users creating rules with these properties will get silent failures. Should be documented or warned in the UI.

### 14. UI shows both server tabs during initial setup
**File**: `apps/ui/src/components/Settings/index.tsx`

Both Plex and Jellyfin tabs are visible before a server is selected. Only the `MediaServerSelector` should be shown in the initial state.

### 15. Stale test result in Jellyfin settings form
**File**: `apps/ui/src/components/Settings/Jellyfin/index.tsx`

The `testResult` state is never cleared when URL/API key inputs change. Users can modify credentials and save with a stale "success" indicator.

### 16. Circular module dependencies
`PlexApiModule` ↔ `MediaServerModule` use `forwardRef()`. Works but is a code smell that complicates initialization order and future refactoring.

---

## Test Coverage Assessment

| Area | Coverage | Notes |
|------|----------|-------|
| Jellyfin Mapper | Excellent | 560+ lines, edge cases covered |
| Plex Mapper | Excellent | 433+ lines, malformed data handled |
| Jellyfin Getter | Excellent | All properties, hierarchy traversal |
| Rule Migration | Good | Preview, execution, skip modes |
| Action Handlers | Good | All action types, ID lookup failures |
| Collection Handler | Good | All action types, Overseerr integration |
| Controller | Good | Pagination, validation tested |
| Jellyfin Adapter | Partial | Only lifecycle/init tested, not data retrieval |
| Plex Adapter | Missing | No unit tests |
| Legacy Controller | Missing | No integration tests |
| End-to-end | Missing | No multi-service integration tests |

---

## What's Done Well

- **Clean abstraction**: `IMediaServerService` is well-designed with clear JSDoc documentation
- **Migration safety**: Rule migration runs before destructive data clearing, wrapped in transactions
- **Backward compatibility**: Legacy `/api/plex` endpoints preserved with deprecation headers
- **Shared contracts**: Zod-validated DTOs in a shared package
- **Test data factories**: Excellent test utilities with Faker.js
- **Feature detection**: `supportsFeature()` allows graceful degradation
- **Comprehensive Jellyfin coverage**: Watch history user-iteration, BoxSet collections, tick-to-ms conversion all handled correctly

---

## Pre-Merge Cleanup Checklist

Items in the branch that are dev artifacts or need attention before merging to main:

- [ ] Remove `jellyfin-dev/` folder and its `.gitignore` entry
- [ ] Remove `console.log({ res })` in `apps/server/src/modules/api/servarr-api/helpers/radarr.helper.ts` (~line 121)
- [ ] Remove development warning from `README.md` ("THIS IS A DEVELOPMENT BRANCH...")

---

## Recommendations

### Before merge:
1. Replace `Promise.all()` with `Promise.allSettled()` in watch history batching
2. Add target server credential validation before executing switch
3. Add `ParseIntPipe` to controller query parameters
4. Fix `resetMetadataCache()` no-op in Plex adapter
5. Complete the pre-merge cleanup checklist above

### Soon after merge:
6. Fix watch record progress mapping (use actual percentage)
7. Clear test result state on input change in Jellyfin settings form
8. Add unit tests for `PlexAdapterService`
9. Verify Jellyfin critic rating scale
10. Document unsupported Jellyfin rule properties in UI

### Longer term:
11. Resolve circular module dependencies
12. Add integration tests for the full switch flow
13. Standardize error handling contract across adapters

---

**Overall**: This is a substantial, well-architected feature addition. The abstraction layer is clean and the migration path is thoughtful. The critical issues around `Promise.all`, unsafe down-migrations, and missing credential validation should be addressed before merge. The rest can be iterated on.
