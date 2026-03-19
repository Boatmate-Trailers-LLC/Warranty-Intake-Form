# Customer Warranty Intake — Worker Patch Plan

## Document Purpose

This document is a thin implementation patch plan for the **Worker/backend only**.

It translates the locked Worker Branching Update Spec into a surgical patch sequence against the current `warranty-form-handler.js` baseline so implementation can proceed with minimal ambiguity and minimal drift.

This is **not** the front-end patch plan.

## Governing Inputs

This patch plan is based on:
- `4-customer_warranty_intake_worker_branching_update_spec.md` (current authoritative Worker branching spec)
- `warranty-form-handler.js` (current Worker baseline)
- `3-customer_warranty_intake-intended_submission_contract.md`
- `5-customer_warranty_intake_form_build_spec.md`
- `6-customer_warranty_intake_frontend_patch_plan_v1.0.md`

If this patch plan conflicts with the current Worker branching spec, the Worker branching spec wins.

## Scope

This patch plan covers:
- shared-core / two-branch Worker restructuring
- customer-branch parsing, validation, mapping, content, note, and email logic
- dealer-branch preservation inside the new architecture
- backend-only acceptance checks

This patch plan does **not** cover:
- front-end HTML/CSS/JS work
- UTM/source capture
- broader Worker hardening / truthfulness redesign
- response-schema redesign
- dealer contact-model cleanup beyond what is minimally required for branching
- new file-type policy changes
- Original Selling Dealer company-resolution logic

## Implementation Strategy

### Build Shape

Implement this update as a **single Worker artifact** with:
- one shared orchestration pipeline
- one explicit `dealer` branch
- one explicit `customer` branch

Recommended implementation approach:
- patch the existing `warranty-form-handler.js`
- keep one `fetch()` entry point
- keep shared infrastructure shared
- move dealer/customer business differences into explicit branch-specific helpers
- preserve dealer behavior unless a minimal internal refactor is required to support the branching model

### Target Outcome

The Worker should behave as one shared operational pipeline that:
- parses both dealer and customer submissions through the same core
- dispatches from `claim_submitted_by`
- validates against the correct branch contract
- uses one shared claim-number sequence
- reuses shared HubSpot / Files / email transport helpers where appropriate
- returns the same general response structure/mechanics already used by the dealer flow

## Patch Target

### Source Baseline
- `warranty-form-handler.js`

### Patch Shape
- patch the existing Worker file in place
- do **not** fork into separate dealer/customer Worker files
- do **not** duplicate the full end-to-end handler into two standalone flows

## Patch Sequence

## Patch Group 1 — Re-scope the Artifact to Shared Core + Two Branches

### Objective
Convert the current dealer-only Worker into the locked shared-core / two-branch shape without changing the file into two duplicated handlers.

### Actions
- update top-level file comments/header notes so the artifact clearly states:
  - shared core
  - supported branches: `dealer`, `customer`
  - current scope limits
  - preserved dealer baseline intent
- keep one exported `fetch()` entry point
- keep shared CORS / request / response infrastructure in place
- prepare the file structure so shared helpers and branch-specific helpers are clearly separated

### Result
The Worker is structurally ready for explicit dealer/customer branching inside one file.

## Patch Group 2 — Expand the Parsed Payload Shape

### Objective
Teach the shared parsing stage to normalize the full customer contract while preserving the dealer baseline fields.

### Actions
- update `initParsedPayload()` so it can hold both dealer and customer branch fields
- keep existing dealer fields, including:
  - `is_sold_unit`
  - `dealer_first_name`
  - `dealer_last_name`
  - `labor_hours`
- add customer-branch fields:
  - `original_owner`
  - `warranty_registration_complete`
  - `customer_address`
  - `customer_city`
  - `customer_region`
  - `customer_postal_code`
  - `customer_country`
  - `customer_phone`
  - `customer_email`
- preserve shared core fields:
  - `vin`
  - `category`
  - `claim_submitted_by`
  - `honeypot`
- preserve honeypot alias support:
  - `honeypot`
  - `_hp`
  - `website`

### Result
The normalized payload can represent either branch without losing current dealer capability.

## Patch Group 3 — Expand Shared Parsing Helpers

### Objective
Keep one shared parsing stage while adding customer-field extraction.

### Actions
- update `parseJsonBodyInto(...)` to normalize the new customer-branch fields
- update `parseFormDataInto(...)` to normalize the new customer-branch fields
- keep attachment parsing shared from `attachments`
- keep max-count and per-file-size checks in shared parsing behavior
- keep current/live file-type behavior unchanged in this milestone
- do **not** add new customer-specific parsing pathways outside the shared helpers

### Result
Both JSON and multipart parsing can populate the correct normalized payload for either branch.

## Patch Group 4 — Add Explicit Branch Dispatch and Canonical Email Selection

### Objective
Replace the current implicit dealer-only assumption with explicit branch dispatch.

### Actions
- after honeypot handling, dispatch branch from `claim_submitted_by`
- enforce dispatch rules:
  - `dealer` → dealer branch
  - `customer` → customer branch
  - anything else → validation error / rejected submission
- replace the current hardcoded dealer-email assumption with branch-specific canonical email helpers:
  - `getDealerCanonicalEmail(...)`
  - `getCustomerCanonicalEmail(...)`
- canonical email rules:
  - dealer branch → `dealer_email`
  - customer branch → `customer_email`

### Result
The Worker chooses the correct branch and the correct canonical submitter email before any HubSpot side effects.

## Patch Group 5 — Split Server-Side Validation into Explicit Branch Helpers

### Objective
Preserve shared validation primitives while moving dealer/customer business rules into explicit branch validators.

### Actions
- preserve shared helper utilities such as:
  - required/non-empty checks
  - `isValidEmail(...)`
  - `isValidVin(...)`
  - attachment-rule enforcement
  - date / address / yes-no formatting helpers
- rename/refactor the current dealer validator into explicit dealer-branch form, for example:
  - `validateDealerSubmission(...)`
- add `validateCustomerSubmission(...)`

### Dealer Branch Rules
Keep current dealer validation behavior, including:
- `claim_submitted_by = dealer`
- sold-unit yes/no requirement
- dealer contact-name requirement
- `labor_hours` required
- conditional customer first/last name when `is_sold_unit = yes`
- at least 1 attachment required

### Customer Branch Rules
Require:
- `claim_submitted_by = customer`
- `original_owner`
- `warranty_registration_complete`
- `dealer_name`
- `dealer_address`
- `dealer_city`
- `dealer_region`
- `dealer_postal_code`
- `dealer_country`
- `dealer_phone`
- `dealer_email`
- `customer_first_name`
- `customer_last_name`
- `customer_address`
- `customer_city`
- `customer_region`
- `customer_postal_code`
- `customer_country`
- `customer_phone`
- `customer_email`
- `date_of_occurrence`
- `vin`
- `warranty_symptoms`
- `warranty_request`
- at least 1 attachment

### Customer Branch Out-of-Contract Rule
For the customer branch:
- do not use `is_sold_unit`
- do not use `dealer_first_name`
- do not use `dealer_last_name`
- do not use `labor_hours`
- even if present, they must not influence customer validation or downstream behavior

### Result
Server-side validation becomes explicit, branch-correct, and still grounded in shared helper primitives.

## Patch Group 6 — Keep Claim Number Generation Shared

### Objective
Preserve one claim-number sequence for both branches.

### Actions
- keep `nextClaimNumber(...)` shared
- keep claim-number generation after branch validation and canonical email resolution
- keep claim-number generation before any HubSpot side effects
- do not introduce branch-specific claim-number behavior

### Result
Both dealer and customer submissions use the same shared sequential claim-number system.

## Patch Group 7 — Refactor Contact Flow to Shared Find/Create + Branch-Specific Property Builders

### Objective
Keep one shared contact orchestration path while moving property mapping decisions into branch-specific builders.

### Actions
- keep the shared contact flow shape:
  - choose canonical email
  - find contact by email
  - if found, reuse existing contact ID
  - if not found, create contact
- keep current helper naming if practical, including legacy naming such as `hsUpsertContact(...)`
- align behavior to current locked rule:
  - create/find only
  - do **not** update existing contact properties during this milestone
- add/introduce branch-specific property builders:
  - `buildDealerContactProperties(...)`
  - `buildCustomerContactProperties(...)`

### Dealer Branch Contact Rule
Preserve current dealer contact behavior as-is for this milestone.

### Customer Branch Contact Rule
Map customer identity/contact data to native HubSpot contact properties where possible:
- `customer_first_name` → `firstname`
- `customer_last_name` → `lastname`
- `customer_email` → `email`
- `customer_phone` → `phone`
- `customer_address` → `address`
- `customer_city` → `city`
- `customer_region` → `state`
- `customer_postal_code` → `zip`
- `customer_country` → `country`

### Customer Contact Storage Rule
For the customer contact record:
- store only the customer’s core identity/contact data
- do **not** store Original Selling Dealer fields on the contact
- do **not** store Original Selling Dealer fields in custom contact properties as part of this update

### Result
The contact step stays shared, but branch-specific property decisions become explicit and correct.

## Patch Group 8 — Split Ticket Subject / Content / Property Builders

### Objective
Move ticket payload differences into explicit branch builders while preserving shared ticket creation flow.

### Actions
- preserve the shared ticket-creation path:
  - build subject
  - build content
  - assemble properties
  - create ticket
  - attempt contact association
  - attempt company association
- replace current dealer-only builders with explicit branch builders:
  - `buildDealerTicketSubject(...)`
  - `buildCustomerTicketSubject(...)`
  - `buildDealerTicketContent(...)`
  - `buildCustomerTicketContent(...)`
  - `buildDealerTicketProperties(...)`
  - `buildCustomerTicketProperties(...)`

### Dealer Branch Rule
Keep dealer branch behavior materially unchanged.

### Customer Branch Subject Rule
Use:
- `Warranty Claim #<claimNumber> - <customer name> - <trailerNumber>`

Where:
- customer name = first + last name
- trailer number = 10th VIN character + last 4 VIN characters

### Customer Branch Content Rule
Build customer ticket content with this section order:
1. opening line for website customer intake
2. claim number + VIN
3. `=== Customer Information ===`
4. `=== Original Selling Dealer ===`
5. `=== Warranty Claim Information ===`

Customer content must include:
- customer full name
- `customer_email`
- `customer_phone`
- assembled customer address
- `original_owner` displayed as `Yes` / `No`
- `warranty_registration_complete` displayed as `Yes` / `No`
- dealer name / email / phone / assembled address
- date of occurrence
- warranty symptoms
- warranty request

### Customer Branch Ticket Property Rule
Include:
- `hs_pipeline`
- `hs_pipeline_stage`
- `subject`
- `content`
- `trailer_vin`
- `warranty_date_of_occurrence`
- `warranty_symptoms`
- `warranty_request`
- `hs_file_upload`
- `hs_ticket_category`
- `claim_submitted_by`
- `original_owner`
- `warranty_registration_complete`

Explicitly omit:
- `warranty_labor_hours`

### Original Selling Dealer Content-Only Rule
For the customer branch, Original Selling Dealer data is:
- included in ticket content
- not mapped to contact properties
- not mapped to ticket properties as part of this update
- not used to resolve special company-association logic

### Result
Ticket payload construction becomes explicit per branch while the overall create/associate flow remains shared.

## Patch Group 9 — Preserve Shared Company-Association Pattern

### Objective
Keep company association behavior aligned to the current dealer best-effort model.

### Actions
- keep the existing best-effort sequence:
  - attempt ticket ↔ contact association
  - if contact has a primary company, attempt ticket ↔ company association
- preserve non-fatal behavior if associations fail
- for the customer branch, do **not** add new logic that tries to resolve the Original Selling Dealer into a company association

### Result
Association behavior remains consistent with current scope and does not expand into new dealer-resolution logic.

## Patch Group 10 — Split Attachment Note Text Builder

### Objective
Keep shared attachment upload mechanics but make note text branch-correct.

### Actions
- keep shared attachment flow:
  - upload to HubSpot Files
  - PRIVATE access
  - collect file IDs
  - create note associated to ticket
  - store IDs in `hs_attachment_ids`
- replace the current dealer-only note-body assumption with branch-specific note-text builders:
  - `buildDealerAttachmentNoteText(...)`
  - `buildCustomerAttachmentNoteText(...)`

### Customer Branch Note Text Rule
Use:
- `Warranty attachments uploaded via customer intake form for Claim #<claimNumber> (VIN <vin>).`

### Dealer Branch Rule
Keep the current dealer note-text behavior.

### Result
Attachment handling remains shared, while note wording becomes correct for each branch.

## Patch Group 11 — Split Confirmation Email Builders

### Objective
Keep shared email transport/config flow while making recipient and content branch-correct.

### Actions
- preserve shared email-send mechanics:
  - config-driven enable/disable
  - same provider path
  - same `sent` / `failed` / `skipped` status model
- replace the current dealer-only builder with explicit branch builders:
  - `buildDealerConfirmationEmail(...)`
  - `buildCustomerConfirmationEmail(...)`

### Dealer Branch Rule
Keep current dealer confirmation-email behavior as-is.

### Customer Branch Confirmation Email Rule
#### Recipient
- `customer_email` only

#### Subject
- same general confirmation pattern as dealer flow, but customer-flow data

#### Body Sections
1. greeting/opening
2. receipt confirmation paragraph
3. review / no-approval disclaimer paragraph
4. claim-number reference instruction
5. signature block
6. Claim Summary
7. Customer Information
8. Original Selling Dealer
9. Warranty Claim Details
10. Attached Files

#### Content Rules
- no dealer contact name
- no labor-hours content
- `original_owner` and `warranty_registration_complete` displayed as `Yes` / `No`
- dates displayed as `MM-DD-YYYY`
- Trailer # included in Claim Summary only

### Result
Email sending remains shared, while recipient and body content become branch-correct.

## Patch Group 12 — Update the Main Orchestration Path

### Objective
Wire the shared-core / two-branch model into the existing `fetch()` flow.

### Actions
- preserve current high-level orchestration order:
  1. CORS / preflight / method gate
  2. parse request into normalized payload + attachments
  3. honeypot check
  4. dispatch branch from `claim_submitted_by`
  5. run branch-specific validation using shared validators
  6. resolve canonical submission email
  7. generate shared claim number
  8. find or create HubSpot contact
  9. build ticket subject/content/properties
  10. create HubSpot ticket
  11. associate ticket to contact
  12. attempt company association
  13. upload attachments
  14. create attachment note
  15. build/send confirmation email
  16. return JSON response
- replace current direct dealer-only calls in the main flow with branch-selected helper calls
- keep logging / correlation id style aligned to current behavior

### Result
The main handler reflects the locked branching architecture without becoming a giant conditional-heavy block.

## Patch Group 13 — Preserve Response Shape and Current Failure Policy

### Objective
Keep browser-facing success/error mechanics aligned to the current dealer flow for this milestone.

### Actions
- keep the same general JSON response shape/mechanics for both branches:
  - same `ok: true` / `ok: false`
  - same validation-error structure
  - same general success payload shape
  - same browser-facing success condition
  - same optional internal IDs / diagnostic fields currently returned
- keep the same general success message pattern already used by dealer flow
- do **not** introduce a customer-specific response schema
- do **not** use this milestone to redesign false-success / fatal-vs-non-fatal boundaries
- mirror current dealer best-effort downstream behavior for the customer branch unless the locked spec explicitly says otherwise

### Result
Front-end expectations remain stable while the backend gains customer-branch support.

## Patch Group 14 — Dealer Preservation Check

### Objective
Make sure the new architecture does not accidentally drift dealer behavior.

### Actions
- keep dealer sold-unit logic intact
- keep dealer conditional customer-name rule intact
- keep dealer contact-name handling intact
- keep dealer labor-hours handling intact
- keep dealer ticket subject/content/property behavior materially unchanged
- keep dealer note text and confirmation-email behavior materially unchanged
- limit dealer edits to minimal internal refactor required by the new branch architecture

### Result
Dealer behavior remains the baseline sibling flow rather than a silently changed contract.

## Patch Group 15 — Backend Acceptance Check

### Objective
Verify the Worker patch is correct before integrated end-to-end testing.

### Static Acceptance Checks
- Worker remains one file / one entry point
- no duplicated full dealer/customer end-to-end handlers exist
- branch dispatch is explicit and based on `claim_submitted_by`
- both `validateDealerSubmission(...)` and `validateCustomerSubmission(...)` exist
- canonical email selection is branch-specific
- claim number remains shared
- contact flow remains create/find only for this milestone
- customer contact mapping uses native customer contact properties
- customer ticket properties include `original_owner` and `warranty_registration_complete`
- customer ticket properties omit `warranty_labor_hours`
- customer note text uses `customer intake form`
- customer confirmation email goes to `customer_email`
- no new response schema has been introduced

### Behavioral Acceptance Checks
- invalid or missing `claim_submitted_by` returns validation failure
- dealer submission still validates and behaves as before
- customer submission with missing `original_owner` fails validation
- customer submission with missing `warranty_registration_complete` fails validation
- customer submission ignores out-of-contract dealer-only fields such as `labor_hours`
- customer branch uses `customer_email` as the canonical contact email
- customer contact create/find does not overwrite an existing contact during this milestone
- customer ticket content includes customer section + Original Selling Dealer section + claim section
- customer attachment note is created with the correct customer wording
- customer confirmation email excludes labor-hours and dealer-contact-name content
- downstream non-fatal failures still mirror current dealer best-effort behavior

## Out of Scope / Do Not Patch Here

Do **not** use this Worker patch plan to introduce:
- front-end markup or JS changes
- UTM/source capture
- a new allowed-file-type policy
- response-truthfulness redesign
- dealer contact-model cleanup beyond minimal branching support
- a special Original Selling Dealer company lookup / association workflow
- a split multi-file Worker architecture unless later governance explicitly changes that direction

## Handoff Note

After this Worker patch plan is accepted, implementation can proceed against:
- `6-customer_warranty_intake_frontend_patch_plan_v1.0.md`
- `7-customer_warranty_intake_worker_patch_plan_v1.0.md`

using the current locked build spec and current locked Worker branching spec as governing artifacts.
