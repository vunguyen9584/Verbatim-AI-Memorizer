# Cross-Device Sync Design — Verbatim AI Memorizer

## Summary
Add optional, account-based cloud sync so a user’s lessons and folders stay consistent across devices while the app remains fully usable offline. The design is offline-first, uses the existing storage interfaces, resolves conflicts deterministically, and supports gradual rollout.

## Goals
- Optional sign-in; anonymous users continue using local data.
- Seamless two-way sync of Folders and Lessons across devices.
- Offline-first UX: local changes work instantly and sync later.
- Deterministic conflict resolution without data loss for common cases.
- Simple migration from current LocalStorage keys: `verbatim_folders`, `verbatim_lessons`.

## Non-Goals
- Full collaborative editing or CRDTs.
- Server-side business logic beyond per-user data isolation.
- Rich audit/history UI (basic versioning kept for conflicts only).

## Current State
- Storage is browser LocalStorage via services:
  - `LocalStorageFolderService` → key `verbatim_folders`
  - `LocalStorageLessonService` → key `verbatim_lessons`
- Types (from `types.ts`): `Folder` and `Lesson` have `id`, `createdAt`, `updatedAt`; `Folder` also has `displayOrder`, `isDefault`.

## Proposed Architecture
Offline-first with a Sync Engine that reconciles local and cloud stores.

- Storage Abstraction (already present):
  - Keep `LessonStorage` and `FolderStorage` interfaces.
  - Add a `CloudAdapter` implementing CRUD using the chosen backend.
  - Add a `SyncEngine` that:
    - Tracks pending local changes (queue) while offline or before successful upload.
    - Periodically pulls remote changes and merges into local.
    - Emits minimal events/hooks for UI sync status.

- Identity & Auth:
  - Add optional sign-in (Google/GitHub) so each user has a unique `user_id` for scoping data.

- Conflict Resolution: Last-Write-Wins (LWW) by `updatedAt` with server-time stamps to avoid clock drift. Deletes use tombstones to prevent “resurrection.”

## Backend Recommendation: Supabase (Postgres + Auth + Realtime)
Reasons: native row-level security (RLS) to isolate per-user data, simple TS client, realtime for live updates, SQL migrations. Alternative: Firebase Firestore (built-in offline cache). Either works; this doc specifies Supabase.

### Tables (DDL Sketch)
```sql
-- All rows are scoped by user_id via RLS
create table folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  display_order integer not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table lessons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  folder_id uuid not null references folders(id) on delete cascade,
  title text not null,
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- RLS policies: user can only access their own rows
```

### Data Model Notes
- Keep current client IDs for local objects; server rows use UUIDs. Map local IDs to server IDs in a lookup table in local storage (e.g., `sync_id_map`).
- Add optional `deleted_at` (tombstone) server-side. Client filters out deleted rows; deletes upload a tombstone instead of removing immediately.

## Client Components
1) Auth UI
   - Add “Sign in/Sign out” in header.
   - After sign-in, trigger initial full sync.

2) CloudAdapter (Supabase)
   - CRUD for folders/lessons scoped by `user_id`.
   - Bulk upsert endpoints to speed up initial migration.
   - Use server-returned `updated_at` for LWW.

3) SyncEngine
   - Maintains a local `pendingOps` queue: [{op: 'upsert'|'delete', entity: 'folder'|'lesson', payload, localId, ts}].
   - On network/auth availability or on timer (e.g., 10s debounce), flush queue with bulk upserts/deletes.
   - Pull phase: fetch rows updated since last sync cursor (`lastSyncedAt`) and merge.
   - Realtime: subscribe to Supabase changes for the user to reduce polling.
   - Status events: `sync:idle|syncing|error` for a small UI indicator.

4) Services Wiring
   - Replace direct uses of `lessonStorageService`/`folderStorageService` with a composite service that delegates to Local first and enqueues ops for Sync.
   - Reads: always from Local for instant UX; remote pulls overlay into Local.

## Sync Flows
1) First Sign-In (Migration)
   - Read all local folders/lessons; create a default folder remotely if none exists.
   - Upload local items as upserts; record server IDs in `sync_id_map`.
   - Set `lastSyncedAt` to server-time; start steady-state sync.

2) Steady-State
   - On local create/update/delete: write to Local immediately; enqueue to `pendingOps` with current local `updatedAt`.
   - Periodically or on connectivity: flush queue; server stamps `updated_at`.
   - Pull remote changes since `lastSyncedAt`; merge by LWW and apply tombstones.

3) Conflict Rules (LWW)
   - If both sides changed the same record: keep the one with greater `updated_at` (server-time). If equal, prefer server.
   - Deletes win: if remote has `deleted_at`, delete locally even if local has older updates.

## Minimal Client Changes
- Add a small Sync Status indicator.
- Add Auth button(s).
- Keep current LocalStorage schema; add lightweight `sync_id_map`, `pending_ops`, `last_synced_at` keys.

## API Contract (Supabase Client Sketch)
- Folders:
  - upsertFolders(rows[]), deleteFolders(ids[]), listFolders(updated_after)
- Lessons:
  - upsertLessons(rows[]), deleteLessons(ids[]), listLessons(updated_after)

## Security & Privacy
- RLS ensures per-user isolation. Avoid storing secrets in the repo.
- Optional: encrypt `content` at rest on client before upload (user passphrase-derived key) if stronger privacy is needed; out-of-scope for v1.

## Testing Plan
- Unit: merging and conflict resolution, tombstones, id mapping.
- Integration: sign-in, first sync migration, steady-state bi-directional updates, offline queue flush.
- Manual: device A/B update scenarios; delete propagation.

## Rollout Plan
1) Implement Auth + CloudAdapter behind feature flag.
2) Implement SyncEngine with LWW and tombstones.
3) Ship to a small cohort; monitor errors.
4) Enable for all users.

## Effort Estimate (v1)
- Auth + wiring: 0.5–1 day
- Cloud schema + adapter: 1–2 days
- SyncEngine + migration: 2–3 days
- QA and fixes: 1–2 days

## Future Enhancements
- IndexedDB for larger/local data instead of LocalStorage.
- Per-field merge for lessons (if needed).
- End-to-end encryption for `content`.
