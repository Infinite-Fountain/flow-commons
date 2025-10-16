## Agent: Identity Connection Judge

Role: Ensure `../blueprint.md` supports a provider‑agnostic identity layer that can bind multiple identity sources to a single user while preserving privacy and reproducibility. Validate compatibility with: Privy, EOA wallets, Privy Smart Wallets, Human Passport, and World ID.

### Scope
- Verify the blueprint defines an internal, stable identity model that can aggregate multiple providers per user.
- Require deterministic serialization rules for IDs across providers (no provider lock‑in).
- Ensure admin workflows can add/remove/verify bindings and attribute activity and rewards across linked identities.

### Required Abstractions (Blueprint edits)
- UnifiedIdentityRecord (UIR)
  - `canonicalUserId`: internal stable id (e.g., `uid:<sha256(providerId|salt)>`)
  - `displayId`: UI-friendly last‑4 (privacy), derived from canonical or primary binding
  - `providerBindings`: object keyed by provider type with normalized identifiers
    - `privy`: `{ did: string, privyId: string }` (strip `did:privy:` for storage; keep raw in evidence)
    - `wallet`: array of `{ chainId: number, address: string (EIP‑55) }`
    - `privySmartWallet`: array of `{ chainId, address }`
    - `humanPassport`: `{ subjectId: string, credentialRef?: string }`
    - `worldId`: `{ nullifierHash: string, credentialRef?: string }`
  - `preferredPayoutWallet?`: `{ chainId: number, address: string (EIP‑55) }`
  - `evidence`: array of references (EAS UIDs, credential hashes/URLs)
  - `createdAt`, `updatedAt`, `version`

### Serialization & Normalization Rules
- Privy: store both raw DID and a normalized `privyId` without `did:privy:` prefix; lowercase.
- Wallets: store EIP‑55 checksummed address; include `chainId`. De‑duplicate across providers.
- World ID: store nullifier hash; never store biometric data.
- Human Passport: store opaque subject id; credentials as pointers only.
- Canonical user id: derived once, salted, and never re‑derived from mutable bindings. Persist in `entities.json`.
- UI display: last 4 chars only in public views; never render full identifiers.

### Provider Adapter Expectations
- `addBinding(providerType, payload, evidence)` → validates format, normalizes id, attaches evidence pointer.
- `removeBinding(providerType, identifier)` → soft delete with audit trail.
- `verifyBinding(providerType, identifier)` → optional cryptographic check (e.g., on‑chain signature/EAS attestation).
- `resolveUser(ids[])` → returns `canonicalUserId` by searching bindings; creates link suggestions when ambiguous.
 - `queuePendingLink(event)` → record inbound attestations/txs referencing unknown addresses for later verification & merge.

### Attribution & Aggregation Rules
- Rewards and attestations must attribute to `canonicalUserId` regardless of binding used.
- Donations and votes: resolve author/recipient via bindings at event time; record both `canonicalUserId` and provider id used.
- Prevent double counting: if multiple bindings point to same canonical user, aggregate once per canonical.
 - Attestation link policy: do not migrate historical EAS; when new wallet is added, issue/link a "wallet‑linked‑to‑user" EAS and include both canonical id and source address in artifacts.

### Security & Privacy
- Store minimal PII; prefer hashed or opaque identifiers where possible.
- Evidence lives as pointers (EAS UIDs, credential URLs/hashes), not raw documents.
- Access controls for admin binding changes; append‑only logs for audits.

### Payout Preferences Integration
- Use `preferredPayoutWallet` for distribution when present; otherwise default to Privy smart wallet binding.
- Minimum payout thresholds are enforced in the distributor module; identity layer only exposes the preferred wallet and verified bindings.

### Chart & Artifacts Alignment
- Ensure `entities.json` includes `canonicalUserId`, bindings, and `displayId` for chart nodes.
- USDC/EAS charts consume `canonicalUserId` for nodes; edges carry provider‑specific ids as metadata only.
- All artifacts replace full identifiers with `canonicalUserId` and last‑4 display labels.

### Validation Checklist
1) Can a single user link Privy, wallets, Privy Smart Wallets, Human Passport, and World ID concurrently?
2) Are all provider ids normalized with deterministic rules (strip prefixes, EIP‑55, etc.)?
3) Is there a stable `canonicalUserId` independent of any provider change?
4) Do exports and charts avoid leaking full identifiers (last‑4 only, canonical ids elsewhere)?
5) Do plan and execution artifacts attribute by `canonicalUserId` and remain reproducible?
6) Are pending links captured and later resolved to avoid orphan attestations/txs?

### Output Expectations
- Propose concrete edits to `../blueprint.md` to add the UIR schema, serialization rules, and admin workflows.
- Provide adapter interface definitions per provider and validation logic notes.
- Supply a mapping table from provider identifiers → `canonicalUserId` → `displayId` used in charts and cards.


