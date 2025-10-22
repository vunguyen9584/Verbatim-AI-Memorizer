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

## Current Implementation (v1)
- Backend: Firebase Firestore via a `CloudAdapter` implementation (`cloudAdapterFirebase`). Feature-flagged by `VITE_SYNC_ENABLED`.
- Auth: required for sync; when not signed in, status is `unauthenticated`.
- Offline-first writes: Local writes happen immediately via local storage services; a `Composite` storage layer enqueues a pending op for each change into LocalStorage key `verbatim_pending_ops`.
- Flush to cloud: A background timer (every ~10s) triggers sync. The engine batches pending ops into upserts (and tombstones for deletes) and calls `upsertFolders`/`upsertLessons` on the adapter. On success, the queue is cleared and status returns to `idle`.
- Remote to local: Firestore realtime subscriptions (`onSnapshot`) per user stream rows. The engine applies LWW (by comparing remote `updated_at` vs local `updatedAt`) and applies tombstones for deletes.
- Status model exposed to UI: `disabled | unauthenticated | syncing | idle | error`. UI component `SyncStatus` subscribes to status changes and calls `syncEngine.start()`.

Important: A cursor-based pull (`lastSyncedAt`) is not used yet; the code defines a key but does not read/write it. ID mapping between local IDs and server UUIDs is not implemented; upserts currently rely on optional `serverId` that is not persisted in local types.

## Proposed Architecture (target)
Offline-first with a Sync Engine that reconciles local and cloud stores.

- Storage Abstraction (already present):
  - Keep `LessonStorage` and `FolderStorage` interfaces.
  - Add a `CloudAdapter` implementing CRUD using the chosen backend.
  - Add/extend the `SyncEngine` to:
    - Tracks pending local changes (queue) while offline or before successful upload.
    - Support cursor-based incremental pulls (in addition to realtime) and merge into local.
    - Emits minimal events/hooks for UI sync status.

- Identity & Auth:
  - Add optional sign-in (Google/GitHub) so each user has a unique `user_id` for scoping data.

- Conflict Resolution: Last-Write-Wins (LWW) by `updatedAt` with server-time stamps to avoid clock drift. Deletes use tombstones to prevent “resurrection.”

## Backend
Current: Firebase Firestore (implemented)
- Uses batch writes with `serverTimestamp()` for `updated_at` and optional tombstones via `deleted_at`.
- Realtime updates via `onSnapshot`, filtered by `user_id`.

Alternative/Future: Supabase (Postgres + Auth + Realtime)
- Pros: native row-level security (RLS), SQL, realtime, typed client.
- The SQL schema below applies if/when migrating to Supabase.

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

2) CloudAdapter (Firebase in current build)
   - Batch upserts to `folders`/`lessons` collections with `serverTimestamp()` for `updated_at`.
   - `deleted_at` set for tombstones instead of hard deletes.
   - Realtime: `onSnapshot` subscriptions per `user_id`.

3) SyncEngine
   - Maintains a local `pendingOps` queue: [{op: 'upsert'|'delete', entity: 'folder'|'lesson', payload, localId, ts}].
   - Flush: when authenticated and enabled, background timer (~10s) batches and uploads pending ops.
   - Pull (current): relies on Firestore realtime (`onSnapshot`); cursor-based incremental pulls are not yet implemented.
   - Merge: LWW by comparing remote `updated_at` with local `updatedAt`; deletes apply via tombstones.
   - Status events: `disabled | unauthenticated | syncing | idle | error`.

4) Services Wiring
   - Replace direct uses of `lessonStorageService`/`folderStorageService` with a composite service that delegates to Local first and enqueues ops for Sync.
   - Reads: always from Local for instant UX; remote pulls overlay into Local.

## Sync Flows
1) First Sign-In (Migration)
   - Read all local folders/lessons; create a default folder remotely if none exists.
   - Upload local items as upserts; record server IDs in `sync_id_map`.
   - Set `lastSyncedAt` to server-time; start steady-state sync.

2) Steady-State
   - On local create/update/delete: write to Local immediately; enqueue to `pendingOps`.
   - Background timer flushes queue; server stamps `updated_at`.
   - Remote changes arrive via realtime subscription; merge by LWW and apply tombstones.

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

- Current Firestore behaviors (implemented):
  - Upserts: batched `set(..., { merge: true })` with `serverTimestamp()` for `updated_at`.
  - Deletes: set `deleted_at` to `serverTimestamp()`.
  - Listing: queries filter `deleted_at == null` (no `updatedAfter` cursor).
  - Realtime: `onSnapshot` with `where('user_id','==', userId)`.

The Supabase contract below remains relevant if adopting Supabase later:

## Security & Privacy
- RLS ensures per-user isolation. Avoid storing secrets in the repo.
- Optional: encrypt `content` at rest on client before upload (user passphrase-derived key) if stronger privacy is needed; out-of-scope for v1.

## Testing Plan
- Unit: LWW merges and tombstones; ensure realtime applies correctly; add id mapping tests when implemented.
- Integration: sign-in, initial upload, periodic flush, realtime downsync.
- Manual: device A/B update scenarios; delete propagation; network loss and recovery.

## Rollout Plan
1) Enable Firebase-based sync behind feature flag.
2) Harden SyncEngine (retry/backoff, dedupe) and add ID mapping + cursor pull.
3) Ship to a small cohort; monitor errors.
4) Optionally evaluate Supabase migration.

## Effort Estimate (v1)
- Auth + wiring: 0.5–1 day
- Cloud schema + adapter: 1–2 days
- SyncEngine + migration: 2–3 days
- QA and fixes: 1–2 days

## Future Enhancements
- IndexedDB for larger/local data instead of LocalStorage.
- Per-field merge for lessons (if needed).
- End-to-end encryption for `content`.

## Known Limitations (current build)
- No cursor-based incremental pull; relies on realtime only.
- No local↔server ID mapping yet; upserts may create new rows instead of updating.
- `reorderFolders` operation is enqueued but not handled specially by the uploader.
- No retry/backoff or queue deduplication.
