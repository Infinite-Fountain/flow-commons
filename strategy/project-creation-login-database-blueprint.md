## Project creation, login, database blueprint (interoperable-canvas)

### Goals
- Open-source dashboard/canvas tool with controlled hosted instance (avoid abuse).
- Reuse existing Privy + Firebase for speed; clean namespacing to isolate data.
- Provide a clear path for forkers to self-host and swap auth/storage (SIWE, etc.).

### Decisions (v1)
- Auth: Privy (same app as IFv2 for now). Enforce strict allowlist on hosted instance.
- Storage model: Firestore for metadata, Firebase Storage for binaries.
- Namespacing: All interoperable-canvas data under `interoperable-canvas/**` in Firestore and `interoperable-canvas/assets/**` in Storage.
- Autosave: Debounced (800–1200ms) with draft versions per asset.
- OSS stance: Document how to replace allowlist with SIWE/other auth for forks; repository remains vendor-agnostic by isolating auth in adapters.

Storage bucket: Use the same bucket. Create a top-level prefix interoperable-canvas/assets/ for this tool, and scope rules to that path. No new bucket needed.

Firestore: Use the same Firebase project. Create collections under interoperable-canvas/** and add rules for allowlist + membership. Keep IFv2 paths unchanged.

### Open-source note on allowlist
Hosted instance: strict allowlist to prevent abuse and control costs. For forkers: replace the allowlist check with your own policy (e.g., open sign-ups, SIWE, Web3Auth), and deploy to your Firebase/DB. This preserves openness while protecting the shared demo.

---

## Firestore data model (path-based keys)

### Rationale
Path-based keys keep the hierarchy human-readable and simple to query. Each document carries enough path context to list, move, or render folder trees without complex graph traversals.

### Collections
- `interoperable-canvas/projects/{projectId}`: project root metadata
- `interoperable-canvas/folders/{projectId}:{fullPath}`: folder nodes
- `interoperable-canvas/assets/{assetId}`: assets metadata (file, text, chart configs)
- `interoperable-canvas/members/{projectId}:{userId}`: membership/roles
- `interoperable-canvas/allowlist/{userId}`: hosted allowlist
- `interoperable-canvas/versions/{assetId}:{versionId}`: version records

### Documents (examples)
- Project
  - id: `pgf-gardens`
  - path: `interoperable-canvas/projects/pgf-gardens`
  - data: `{ name: "PGF Gardens", createdAt, ownerPrivyId }`

- Folder (path-based)
  - id: `pgf-gardens:/` (root)
  - id: `pgf-gardens:/hero`
  - id: `pgf-gardens:/hero/buttons`
  - path: `interoperable-canvas/folders/{projectId}:{fullPath}`
  - data: `{ projectId: "pgf-gardens", fullPath: "/hero/buttons", parentPath: "/hero", createdAt }`

- Asset
  - id: `asset_9d12...`
  - path: `interoperable-canvas/assets/asset_9d12...`
  - data: `{ projectId: "pgf-gardens", fullPath: "/hero/buttons/cta.json", kind: "text"|"image"|"chart", sizeBytes, storagePath, draftVersionId, publishedVersionId, updatedAt }`

- Member
  - id: `pgf-gardens:privy_abc123`
  - path: `interoperable-canvas/members/pgf-gardens:privy_abc123`
  - data: `{ projectId: "pgf-gardens", userId: "privy_abc123", role: "owner"|"editor"|"viewer", addedAt }`

- Version (per asset)
  - id: `asset_9d12...:v001`
  - path: `interoperable-canvas/versions/asset_9d12...:v001`
  - data: `{ assetId: "asset_9d12...", number: 1, status: "draft"|"published", metadataDelta, createdAt }`

### Common queries
- List folders under a parent
  - `where(projectId == X) AND where(parentPath == Y)` on `interoperable-canvas/folders`
- List assets in a folder
  - `where(projectId == X) AND where(fullPath startsWith Y + "/") AND where(depth == currentDepth)`
  - Consider storing `depth` as the count of path segments to filter exact folder level.
- Find project members
  - `where(projectId == X)` on `interoperable-canvas/members`

### Moves/renames
- To move `/hero/buttons` → `/hero/cta`, update the folder doc id and `fullPath`, and batch-update any children with `fullPath` prefix. For assets, update `fullPath` and (if desired) move file in Storage; otherwise keep `storagePath` stable and only update metadata.

---

## Firebase Storage layout
- `interoperable-canvas/assets/{projectId}/{relativePath}`
  - Example: `interoperable-canvas/assets/pgf-gardens/hero/buttons/cta.png`
- Keep IFv2 unchanged. Start interoperable-canvas assets under `interoperable-canvas/assets/` to avoid path conflicts.

---

## Autosave + versioning
- Debounce 800–1200ms for metadata and text assets.
- For binaries: write metadata draft immediately; upload file; link new `versionId` when upload completes.
- Maintain `draftVersionId` and `publishedVersionId` on asset doc. Allow promote/demote actions.
- Optionally cap historical versions (e.g., retain last 20).

---

## Auth and access control
- Privy user as canonical ID (`request.auth.token.sub`).
- Allowlist: `flowcommons/allowlist/{userId}` presence = permitted on hosted instance.
- Membership: `flowcommons/members/{projectId}:{userId}` defines role; gate project access on membership.
- Admin-only project creation (strict allowlist or role check).

### Firestore rules outline (concept)
```
rules_version = '2';
service cloud.firestore {
  match /databases/{db}/documents {
    function uid() { return request.auth != null ? request.auth.token.sub : null }
    function allowlisted() { return exists(/databases/$(db)/documents/interoperable-canvas/allowlist/$(uid())) }
    function member(projectId) { return exists(/databases/$(db)/documents/interoperable-canvas/members/$(projectId + ":" + uid())) }

    match /interoperable-canvas/projects/{projectId} {
      allow read, write: if request.auth != null && allowlisted() && member(projectId);
    }
    match /interoperable-canvas/{doc=**} {
      allow read, write: if false; // tighten by default
    }
  }
}
```

### Storage rules outline (concept)
```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /interoperable-canvas/assets/{allPaths=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

---

## MetaMask and OSS notes
- Hosted: continue with Privy (wallet + Google). Show a message if not allowlisted (link to contact admin via Telegram).
- OSS forks: provide an AuthAdapter interface. Keep `PrivyAuthAdapter` in repo and document a `SiweAuthAdapter` (Wallet + SIWE) for teams that don’t want Privy. Include example env and minimal API routes to implement nonce/signature/session.

---

## Next steps
- Implement collections and rules in Firebase console (or rules files) with `interoperable-canvas/**` namespaces.
- Add allowlist management UI (simple Firestore writer or CLI script).
- Implement debounced autosave and version linking in the simulator.
- Document BYO-auth in README and adapter interfaces.

