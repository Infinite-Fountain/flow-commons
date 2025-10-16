## Purpose

Define a reproducible, reviewer‑friendly system for community funding epochs ("page-names") under each category (project/community). GitHub is the canonical data source. A single page (manager+public) orchestrates: load raw snapshots, normalize, adjust, plan, and publish on‑chain payouts and attestations with strong guardrails and audit trails.

## Canonical Data Source

- Decision: GitHub snapshots only (canonical). Raw Firestore is operational; exports are authoritative for analysis and review.
- Structure per category/page:
  - `datasets/<category>/<page>/submissions.json` (raw)
  - `derived/<method-version>/normalized.json` (derived, with parameters)
  - `plan/distribution-plan.json` (final allocations, checksums)
  - `onchain/execution-receipt.json` (tx hashes, block numbers)
  - `attestations/eas-uids.json` (optional)
  - `MANIFEST.json` linking all artifacts and SHA-256 hashes

### Artifact MANIFEST (per-epoch)
- File: `MANIFEST.json` plus a `MANIFEST.schema.json` to validate structure
- Schema fields:
  - `artifacts[]`: `{ type, path, sha256, size, computedAt }`
  - `code`: `{ repo, commit, tags?: string[], toolVersions?: Record<string,string> }`
  - `params`: `{ file, hash }` (file path to parameters used; hash of contents)
- CI integration: re-hash all artifacts and fail on mismatch to ensure tamper‑evidence
- Distribution: attach MANIFEST to a GitHub Release named `category/page@vX.Y`
- Optional: PGP-sign the MANIFEST and publish `manifestCid` (IPFS) recorded alongside the plan

## Networks and Tokens

- Decision: Default network Base; prepare for Optimism, Celo, Arbitrum.
- Decision: Token USDC.
- Rationale: stability for budgeting; low fees on L2; broad tooling support.

## Distributor Architecture (Payout Pattern)

- Decision: Hybrid – push to top N, claim for the long tail, plus minimum payout threshold.
  - Parameters:
    - `topNPushCount`: number of highest allocations sent via push batch
    - `minPayoutThresholdUSDC`: accumulate until threshold, then push
    - `claimWindowDays`: window recipients can claim
    - `epochId`: unique idempotency key
- Alternatives (for future)
  - Push only — Score: 8/10
    - Pros: simple UX; immediate finality
    - Cons: gas spikes, revert-all risk on large sets

## Plan Integrity and Execution Workflow

- Commit plan hash on-chain before execute — Score: 9/10
  - Mechanism: compute SHA-256 (or keccak256) of `distribution-plan.json`, store in contract with `epochId`. Execution checks the hash matches; otherwise reverts.
  - Benefits: tamper-evident binding between GitHub artifact and on-chain execution.
- Cooldown (e.g., 24h) between publish and execute — Score: 8/10
  - Mechanism: contract enforces `earliestExecuteBlockTime` set at plan commit; execution valid only after the cooldown.
  - Benefits: human and reviewer window to verify data and params; allows cancel/replace plan before funds move.
- Mandatory simulation (e.g., Tenderly) — Score: 8/10
  - Preflight sim of batch or Merkle root claims; attach sim URL to `MANIFEST.json`.

### Contract Interfaces and Events (plan integrity)
- Functions:
  - `commitPlan(epochId, planHash, manifestCid, earliestExecuteAt)` — stores hash and enforces cooldown
  - `executePlan(epochId, planHash)` — executes only if stored hash matches and cooldown elapsed
- Events:
  - `PlanCommitted(epochId, planHash, manifestCid, earliestExecuteAt)`
  - `PlanExecuted(epochId, planHash)`
- Operational CLI flow:
  1) Generate `distribution-plan.json`
  2) Write/validate `MANIFEST.json` (capture Tenderly sim URL)
  3) Call `commitPlan` (records `manifestCid`/cooldown)
  4) After cooldown, call `executePlan`
  5) Write `onchain/execution-receipt.json` and update MANIFEST

## Governance and Guardrails

- Gnosis Safe as contract owner — Score: 9/10
  - Pros: multi-party approval; standard ops; hardware wallet support
  - Patterns: Safe module or direct owner functions with `onlyOwner`
- Committee roles + time‑lock — Score: 8/10
  - Setup: committee (N-of-M) signs plan commit; time‑lock enforces cooldown; emergency pause role
  - Pros: distributes trust; on-chain transparency
  - Cons: slower operations; coordination overhead


## Agent Architecture

Systematic design with 12 specialized agents, each with single responsibility and clear interfaces.

### Core Execution Agents
1. **Data Ingestion Agent**
   - Fetches raw voting data from Firestore
   - Validates data integrity and completeness
   - Exports sanitized data to GitHub
   - Handles rate limiting and retries

2. **UIR Management Agent**
   - Resolves `canonicalUserId` from any provider binding
   - Manages identity binding operations (add/remove/verify)
   - Handles fallback mechanisms when resolution fails
   - Validates provider-specific data formats
   - Maintains UIR data consistency across all agents

3. **Fraud Detection Agent**
   - Implements self-scoring exclusions
   - Detects outlier voting patterns (>2 std dev from reviewer mean)
   - Identifies potential collusion (identical scores across reviewers)
   - Generates fraud-detection.json artifacts

4. **Normalization Agent**
   - Applies base-100 normalization per reviewer
   - Calculates percentile rankings
   - Handles edge cases (single reviewer, missing data)
   - Generates normalized.json artifacts

5. **Allocation Calculation Agent**
   - Computes USDC distribution amounts
   - Applies bonus multipliers for top performers
   - Handles minimum payout thresholds
   - Generates allocation.json artifacts

6. **Blockchain Execution Agent**
   - Manages USDC transfers
   - Handles gas optimization
   - Implements retry logic for failed transactions
   - Generates transaction receipts

7. **Attestation Agent**
   - Creates EAS attestations for rewards
   - Links attestations to blockchain transactions
   - Handles attestation service failures
   - Generates attestation receipts

### Governance & Safety Agents
8. **Plan Integrity Agent**
   - Commits plan hash to blockchain before execution
   - Enforces cooldown periods
   - Validates plan hasn't been tampered with
   - Monitors for unauthorized changes

9. **Multi-sig Coordination Agent**
   - Manages Gnosis Safe transaction proposals
   - Coordinates with human signers
   - Handles time-lock mechanisms
   - Escalates critical decisions

10. **Audit & Compliance Agent**
    - Validates all calculations against original data
    - Ensures regulatory compliance
    - Generates audit reports
    - Flags suspicious activities

### Communication & UX Agents
11. **Notification Agent**
    - Sends updates to community members
    - Handles email/SMS notifications
    - Manages notification preferences
    - Provides status updates

12. **Dashboard Update Agent**
    - Updates community dashboard with latest data
    - Generates visual charts and reports
    - Handles real-time data synchronization
    - Manages caching for performance

### Agent Communication Patterns
- **Event-Driven Architecture**: Central event bus with DataReady, FraudDetected, AllocationComplete, TransactionFailed events
- **Retry Policies**: Exponential backoff (1s, 2s, 4s, 8s, 16s, 32s, 64s) with jitter
- **Circuit Breakers**: Stop retrying after 5 consecutive failures
- **Audit Trails**: Complete logs of all agent decisions and actions

### Data Flow Architecture
```
Raw Data → Validation → Fraud Detection → Normalization → Allocation → Execution → Attestation → Notification
```

## Unified Identity Record (UIR)

Provider-agnostic identity layer that binds multiple identity sources to a single canonical user while preserving privacy and reproducibility.

### UIR Schema
- **canonicalUserId**: internal stable id (e.g., `uid:<sha256(providerId|salt)>`)
- **displayId**: UI-friendly last-4 (privacy), derived from canonical or primary binding
- **providerBindings**: object keyed by provider type with normalized identifiers
  - `privy`: `{ did: string, privyId: string }` (strip `did:privy:` for storage)
  - `wallet`: array of `{ chainId: number, address: string (EIP-55) }`
  - `privySmartWallet`: array of `{ chainId, address }`
  - `humanPassport`: `{ subjectId: string, credentialRef?: string }`
  - `worldId`: `{ nullifierHash: string, credentialRef?: string }`
- **preferredPayoutWallet?**: `{ chainId: number, address: string (EIP-55) }`
- **evidence**: array of references (EAS UIDs, credential hashes/URLs)
- **createdAt**, **updatedAt**, **version**

### Core Design Principles
- **One user = one canonicalUserId**: Each user gets ONE stable `canonicalUserId` regardless of how many identity providers they link
- **Prevents duplicate rewards**: Consistent attribution across all systems
- **Fallback mechanisms**: If `canonicalUserId` cannot be determined, use `displayId` (last-4 of primary binding) as temporary identifier
- **Chart mapping**: Use `canonicalUserId` for all nodes, `displayId` for labels; multiple `providerBindings` are metadata only

### Serialization & Normalization Rules
- Privy: store both raw DID and normalized `privyId` without `did:privy:` prefix; lowercase
- Wallets: store EIP-55 checksummed address; include `chainId`; de-duplicate across providers
- World ID: store nullifier hash; never store biometric data
- Human Passport: store opaque subject id; credentials as pointers only
- Canonical user id: derived once, salted, and never re-derived from mutable bindings
- UI display: last 4 chars only in public views; never render full identifiers

### Attribution & Aggregation Rules
- Rewards and attestations must attribute to `canonicalUserId` regardless of binding used
- Donations and votes: resolve author/recipient via bindings at event time; record both `canonicalUserId` and provider id used
- Prevent double counting: if multiple bindings point to same canonical user, aggregate once per canonical
- Use `preferredPayoutWallet` for distribution when present; otherwise default to Privy smart wallet binding

## Agent Execution Infrastructure

Evaluate multiple secure options to run the publish/execute flows under guardrails.

- Gnosis Safe + module/service — Score: 9/10
  - Mature pattern; policyable executions; pairs with multisig approvals
- OpenZeppelin Defender (Autotasks + Relayer) — Score: 8/10
  - Managed infra, alerting, approvals; vendor dependency
- Circle Developer Wallets (custodial API) — Score: 7/10
  - Strong payments infra; useful for agent wallets; not ideal as programmatic treasury owner
- Custom backend signer — Score: 6/10
  - Full control; higher security/ops burden

## Autonomous Payments: x402 and AP2

- x402 (HTTP 402 revival for onchain micro‑payments)
  - Pros — Score: 8/10
    - Native pay‑per‑request for agents; microtransactions in USDC; standardized middleware
    - Helpful for gated analytics APIs or risk reports in the pipeline
  - Cons
    - Facilitator dependency; integration complexity; not needed for outbound payouts
  - Links: [Circle x402 explainer](https://www.circle.com/blog/autonomous-payments-using-circle-wallets-usdc-and-x402), [x402 AI starter](https://vercel.com/templates/ai/x402-ai-starter)
- Google AP2 (Agents to Payments) — Score: 7/10
  - Pros: broader agent-to-payment abstraction; potential multi‑rail reach
  - Cons: emerging standard; integration surface evolving
  - Link: [AP2 announcement](https://cloud.google.com/blog/products/ai-machine-learning/announcing-agents-to-payments-ap2-protocol)
- Guidance: useful for inbound agent payments (paywalls/data vendors). Outbound community payouts should remain in our distributor contract flow.

## Attestations and Transparency

- Decision: EAS attestations + contract events + GitHub receipts — Score: 10/10
  - EAS as on-chain source of truth; events for minimal immutable logs; GitHub mirrors for researchers
  - Artifacts: EAS schema id/version, attestation UIDs stored in `attestations/eas-uids.json`

## Reviewer Documentation Bundle (per-epoch)

- `docs/rubric.md`: the criteria evaluators will use
- `docs/params.json`: emitted by pipeline; exact normalization/allocation parameters
- `docs/SIMULATION.md`: links and screenshots of preflight simulations (Tenderly/Foundry traces)
- `docs/REPRODUCE.md`: one‑liner commands to run the reproducibility script/notebook
- Linting: CI job validates doc presence and non‑emptiness and checks links resolve
- Cross‑links: MANIFEST should reference all `docs/` files for complete provenance

## Donations Ingestion (TBD)

Options to evaluate:
- On-chain scanner (pool + user mappings) — Score: 8/10
  - Objective and tamper-evident; requires indexing infra
- The Graph subgraph — Score: 8/10
  - Researcher‑friendly queries; maintenance cost
- Hybrid (chain source + GitHub snapshots) — Score: 9/10
  - Best of both worlds; reproducible exports

## Normalization Methods

- Decision: Per‑reviewer base‑100 (current) — Score: 9/10
- Optional second lens: percentile/rank — Score: 8/10 (robust to outliers)
- Always store method name, version, and parameters in derived artifacts.

## Publication Artifacts (Avoid Duplication)

Minimum set per epoch:
- `submissions.json` (raw)
- `normalized.json` (method, params included)
- `distribution-plan.json` (final allocations; checksum)
- `execution-receipt.json` (tx hashes; block numbers)
- `MANIFEST.json` linking the above with hashes and optional sim URLs
- Tag a GitHub release with `category/page@vX.Y` and attach all artifacts

## Failure Handling and Idempotency (TBD)

Options:
- Revert-all batch — Score: 7/10 (clean but brittle)
- Partial success + retry queue — Score: 8/10 (progress with bookkeeping)
- Merkle claims — Score: 9/10 (no batch risk; idempotent claims)
- Idempotency keys/nonces — Score: 9/10 (prevent double payouts; plan‑bound nonces)

## UX: Single Page with Role Toggles

- Mode structure (single URL):
  - Manager mode (authz): Load ➝ Normalize ➝ Adjust ➝ Plan ➝ Review ➝ Publish ➝ Execute ➝ Receipts
  - Public mode: Read‑only of the same sections; deep‑dive tabs for researchers (e.g., matrices, parameters, diffs)
- Latest‑on‑top chronology:
  - Top section shows the newest epoch summary and actions; older epochs collapse below with links to their artifacts and receipts. Filter by epoch or status (draft, committed, executed).
- Safety prompts:
  - Pre‑execute checklist: dataset hash match, parameters frozen, cooldown satisfied, spend caps in range, sim passed, multisig approvals complete.

## Open Questions (Trackers)

- Donations ingestion: choose indexer strategy and identity mappings
- Exact EAS schema(s): per‑recipient reward vs per‑epoch summary vs both
- Committee and timelock parameters: N‑of‑M, cooldown length, emergency pause
- Thresholds: `topNPushCount`, `minPayoutThresholdUSDC`, `claimWindowDays`
- Multi‑network deployment tooling and environment management


