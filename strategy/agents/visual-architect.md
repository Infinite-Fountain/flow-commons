## Agent: Visual Architect

Role: Ensure `../blueprint.md` is optimized to generate two clear visual flow charts and motivating dynamic cards. Use the existing reference chart in `infinite-fountain-v2/app/rotating-mutual-aid-arq/infinite-fountain-report/page.tsx` as the visual baseline.

### Scope
- Produce two charts (separate pages):
  - USDC Flow Chart: money in/out, pool, distributions per epoch
  - EAS Flow Chart: attestations, proofs, UIDs, schema versions per epoch
- Align blueprint data structures so charts can be generated deterministically from GitHub artifacts.
- Optimize blueprint for dynamic user-facing “motivation cards”.

### Inputs
1) `../blueprint.md` (source of truth for process and artifacts)
2) Datasets under `datasets/<category>/<page>/` and derived artifacts
3) UI reference: `infinite-fountain-v2/app/rotating-mutual-aid-arq/infinite-fountain-report/page.tsx`

### Required Schema (Blueprint edits to enforce)
- FlowEvent (for USDC chart)
  - `id` (deterministic), `timestamp`, `dateLabel`, `stage`, `stageOrder`
  - `senderId`, `recipientId`, `concept` (e.g., funding | reward | donation)
  - `amount`, `currency` (USDC)
  - `categoryId`, `epochId` (page-name), `txHash?`, `blockNumber?`
- AttestationEvent (for EAS chart)
  - `id`, `timestamp`, `stage`, `stageOrder`
  - `schemaId`, `schemaVersion`, `attester`, `recipientId`, `uid`
  - `categoryId`, `epochId`, `txHash?`, `blockNumber?`
- Node registry
  - `entities.json`: canonical ids for pool, users (privyId sans prefix), community, treasury
  - Mapping to display labels (last 4 chars only for privacy)

### Chart Generation Spec
- USDC Chart
  - Nodes: pool, treasury, users (only those in current epoch), external funders
  - Edges: `FlowEvent` → directed edges with `amount`, `concept`, `timestamp`
  - Group by `stageOrder`, render lanes per stage; totals per stage and per recipient
  - KPIs: total in, total out, pool balance delta, top recipients
- EAS Chart
  - Nodes: attester (distributor), recipients, schemas
  - Edges: `AttestationEvent` → directed edges annotated with `schemaId`, `uid`
  - Group by `stageOrder`; count attestations per recipient and per schema
  - KPIs: attestations issued, coverage (% recipients attested), schema versions in use

### Dynamic Motivation Cards (Blueprint requirements)
- For recipients
  - Upcoming payout estimate (based on `distribution-plan.json`)
  - Progress to threshold (min payout threshold accumulator)
  - Rank percentile (normalized view), badges (streaks, contributions)
  - Donation impact received/sent (if tracked)
- For reviewers
  - Reproducibility status (hash match, sim passed, cooldown state)
  - Anomalies (outliers, self-scoring, missing reviews)
- For managers
  - Spend vs cap, recipients count, unresolved claims, plan integrity checks

### Decision Checklist (before blueprint approval)
1) Are `FlowEvent` and `AttestationEvent` schemas defined and versioned?
2) Do artifacts provide all fields to render nodes/edges without API calls?
3) Are ids deterministic and privacy-preserving (no full names, last-4 display only)?
4) Are USDC and EAS charts on separate pages to avoid mixed units?
5) Do motivation cards derive solely from GitHub artifacts or on-chain receipts?
6) Are epoch ids, stage orders, and labels consistent across charts and cards?

### Conflict Resolution Protocol
- If chart clarity vs data completeness conflict: prefer clarity but add links to raw artifacts
- If performance vs detail conflict: paginate or collapse by stage; never drop provenance

### Output Expectations
- Provide concrete edits to `../blueprint.md` to:
  - Add/complete schemas, MANIFEST references, and naming conventions
  - Clarify stage taxonomy and `epochId`
  - Specify two chart routes (USDC/EAS) and their data sources
  - Define motivation card formulas and required fields
- Produce a validation table mapping each chart/card element to artifact fields.


