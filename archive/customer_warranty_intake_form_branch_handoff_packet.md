# BRANCH HANDOFF PACKET — Customer Warranty Intake / Worker Branching Stream

## Handoff Purpose

This packet is intended to let a fresh branch chat resume work without losing context, decisions, scope boundaries, or artifact lineage.

This stream has completed the following major phases:
- reverse-engineered the dealer current-state implementation
- created a customer delta spec
- created a customer intended submission contract
- created a customer worker branching update spec
- reviewed the worker branching update spec
- created a change request for minor revisions to the worker branching update spec

The next likely phase is:
- create the **Customer Warranty Form Build Spec**
- optionally apply the Worker Branching Update Spec minor-revision CR first

---

## Current Objective State

We are designing a **Customer Warranty Intake** flow that should behave as similarly as possible to the current **Dealer Warranty Intake** flow, except where customer-specific field contract and customer-facing content require divergence.

The implementation target is:
- keep the dealer flow stable
- add a customer flow
- refactor the Worker into:
  - one shared core
  - one explicit dealer branch
  - one explicit customer branch

The work has been intentionally structured as artifacts first, code second.

---

## Authoritative Working Artifacts Created in This Stream

### 1) Dealer current-state baseline
**Artifact:** Dealer Warranty Intake — Current-State Implementation Spec

Purpose:
- documents the current dealer form + worker as-built behavior
- acts as the dealer baseline truth for delta work

### 2) Customer delta artifact
**Artifact:** Customer Warranty Intake — Delta Spec

Purpose:
- describes differences between the dealer baseline and the intended customer flow
- used as the transition artifact between current-state and target-state

### 3) Customer contract artifact
**Artifact:** Customer Warranty Intake — Intended Submission Contract

Purpose:
- locks the customer browser-to-Worker contract
- locks exact field names, section order, requiredness, validation posture, hidden/system fields, and output expectations

### 4) Worker implementation artifact
**Artifact:** Customer Warranty Intake — Worker Branching Update Spec

Purpose:
- defines the intended Worker architecture and refactor model
- shared core + explicit dealer/customer branches
- names branch-specific builders/validators
- preserves dealer behavior
- defines customer branch contact/ticket/email/note behavior

### 5) Worker revision artifact
**Artifact:** CR-WTY-WORKER-001 — Minor Revisions

Purpose:
- captures minor revisions requested after review of the Worker Branching Update Spec
- intentionally created as a CR + deltas instead of directly revising the spec

---

## Important Artifact-State Caveat

There is one important process note:

During review of the Worker Branching Update Spec, three tweaks were briefly applied to the canvas version before you clarified that you did **not** want the spec changed directly and instead wanted a **Change Request + Deltas**.

For a fresh branch, treat the following as the safe operational truth:

- **Base Worker spec** = `4-customer_warranty_intake_worker_branching_update_spec.md`
- **Pending revision package** = `CR-WTY-WORKER-001_minor_revisions.md`

Do **not** assume the live Worker spec artifact already includes those revisions unless you explicitly apply the CR.

---

## Files Produced / Referenced in This Stream

Use these as the main source stack in the next branch:

### Source / baseline / design files
- `dealer_warranty_form.html`
- `warranty-form-handler.js`
- `Customer Warranty Intake Form Frontend Design.pdf`
- `1-dealer_warranty_intake_current-state_implementation_spec.md`
- `2-customer_warranty_intake_delta_spec.md`
- `3-customer_warranty_intake-intended_submission_contract.md`
- `4-customer_warranty_intake_worker_branching_update_spec.md`

### Exported / generated files
- `2-customer_warranty_intake_delta_spec_v1.1.md`
- `customer_warranty_intake_worker_branching_update_spec.md`
- `CR-WTY-WORKER-001_minor_revisions.md`

If there is any ambiguity between older and newer versions, prefer:
1. explicitly versioned or later-numbered working artifacts
2. the most recent markdown export
3. this handoff packet’s locked decisions list

---

## Core Strategic Decisions Already Locked

### Overall workflow approach
- Artifacts first, code second
- Use interview-style decision locking before drafting specs
- Preserve dealer behavior during the customer-branch project
- Avoid scope creep into unrelated Worker hardening unless explicitly called out as deferred

### Customer form philosophy
- Customer form should behave like dealer form wherever possible
- Main differences should come from:
  - customer-specific fields
  - customer-specific validation requirements
  - customer-specific contact/ticket/email content
- General mechanics should remain aligned to dealer flow

---

## Locked Decisions — Customer Intended Submission Contract

Below is the locked decision set that was used to build the customer submission contract.

### Hidden / system fields
- `claim_submitted_by = customer`
- `category = Warranty`
- `website` remains the honeypot field

### Top-level yes/no fields
- `original_owner`
- `warranty_registration_complete`

Both are:
- required
- radio groups
- values are literal `yes` / `no`
- no conditional behavior
- captured values only

### Requiredness policy
- All visible customer-form fields are required
- Attachments remain required

### Attachments
- minimum 1 file
- maximum 10 files
- maximum 10 MB per file

### Warranty claim fields
Keep these names unchanged:
- `vin`
- `date_of_occurrence`
- `warranty_symptoms`
- `warranty_request`
- `attachments`

Explicitly exclude:
- `labor_hours`

### Customer information field names
Final locked set:
- `customer_first_name`
- `customer_last_name`
- `customer_address`
- `customer_city`
- `customer_region`
- `customer_postal_code`
- `customer_country`
- `customer_phone`
- `customer_email`

Important note:
- `customer_state` was considered and rejected
- `customer_region` was chosen for symmetry with `dealer_region`

### Original Selling Dealer field names
The customer form reuses dealer namespace for the Original Selling Dealer section:
- `dealer_name`
- `dealer_address`
- `dealer_city`
- `dealer_region`
- `dealer_postal_code`
- `dealer_country`
- `dealer_phone`
- `dealer_email`

Explicitly excluded from customer form:
- `dealer_first_name`
- `dealer_last_name`
- `dealer_contact_name`

### Naming rule for Original Selling Dealer
- existing `dealer_*` field names are reused to minimize drift
- but all human-readable output in customer flow must label these fields as **Original Selling Dealer**, not as dealer submitter identity

### Section order
Locked customer form section order:
1. Are You The Original Owner?
2. Warranty Registration Complete?
3. Original Selling Dealer
4. Customer Information
5. Warranty Claim Information

### Field order inside Original Selling Dealer
1. `dealer_name`
2. `dealer_address`
3. `dealer_city`
4. `dealer_region`
5. `dealer_postal_code`
6. `dealer_country`
7. `dealer_phone`
8. `dealer_email`

### Field order inside Customer Information
1. `customer_first_name`
2. `customer_last_name`
3. `customer_address`
4. `customer_city`
5. `customer_region`
6. `customer_postal_code`
7. `customer_country`
8. `customer_phone`
9. `customer_email`

### Field order inside Warranty Claim Information
1. `vin`
2. `date_of_occurrence`
3. `warranty_symptoms`
4. `warranty_request`
5. `attachments`

### Control types
Keep dealer-style control patterns:
- `original_owner` → radio group
- `warranty_registration_complete` → radio group
- `dealer_email`, `customer_email` → email inputs
- `date_of_occurrence` → date input
- `warranty_symptoms`, `warranty_request` → textareas
- `attachments` → multi-file upload
- remaining fields → standard text inputs

### Country fields
Both remain:
- blank required text inputs
- no default value
- no read-only behavior

Applies to:
- `dealer_country`
- `customer_country`

### Postal code fields
Keep dealer-form approach:
- required
- text inputs
- no strict numeric-only mask
- no country-specific formatting logic

### Address fields
Keep single-line approach:
- `dealer_address`
- `customer_address`

No Address Line 2 / Apt / Suite field.

### Email validation rule
Keep same rule for:
- `dealer_email`
- `customer_email`

Meaning:
- required
- basic front-end email-format validation
- submitted as plain text values

### Phone handling rule
Keep same rule for:
- `dealer_phone`
- `customer_phone`

Meaning:
- required
- plain text input
- no strict formatting mask
- treated as required strings

### VIN rule
Keep same rule as dealer flow:
- required
- uppercase before submit
- exactly 17 characters
- same regex excluding `I`, `O`, `Q`

### Submit behavior
Keep same as dealer form:
- submit as `multipart/form-data`
- same Worker endpoint pattern
- expect JSON
- success only when HTTP response is OK and `data.ok === true`

### Client-side UX mechanics
Keep same as dealer form:
- `novalidate`
- shared status area
- submit button loading state/spinner
- reset after success
- restore hidden/system defaults after reset
- same error-message mechanics
- same success-message pattern

### Canonical contact email for customer flow
- `customer_email`

### Confirmation email recipient
- `customer_email` only

### Customer-flow conditional logic
- `original_owner` and `warranty_registration_complete` do not trigger any conditional UI
- customer first/last name are always required
- there is no sold-unit logic in customer flow

### Ticket subject rule
Customer ticket subject remains structurally similar to dealer:
`Warranty Claim #<claimNumber> - <customer name> - <trailerNumber>`

Trailer number rule:
- 10th VIN character + last 4 VIN characters

### Ticket content rule
Customer ticket content/body structure was locked as:

- intro line
- Claim #
- VIN
- Customer Information
- Original Selling Dealer
- Warranty Claim Information

With this specific content model:

- Customer Information includes:
  - name
  - email
  - phone
  - address
  - Original Owner? → displayed as `Yes` / `No`
  - Warranty Registration Complete? → displayed as `Yes` / `No`

- Original Selling Dealer includes:
  - dealership
  - email
  - phone
  - address

- Warranty Claim Information includes:
  - date of occurrence
  - warranty symptoms
  - warranty request

### Ticket content display rules
- do not include Trailer # in ticket body
- do not include dealer contact name
- display `original_owner` / `warranty_registration_complete` as `Yes` / `No`
- ticket-content date format = `YYYY-MM-DD`

### Confirmation email structure
Locked structure:
- greeting/opening
- receipt confirmation paragraph
- review / no-approval disclaimer
- claim-number reference instruction
- signature block
- Claim Summary
- Customer Information
- Original Selling Dealer
- Warranty Claim Details
- Attached Files

### Confirmation email content rules
- no labor-hours content
- no dealer contact name
- Original Selling Dealer section label must be exactly **Original Selling Dealer**
- `original_owner` and `warranty_registration_complete` displayed as `Yes` / `No`
- date display in confirmation email = `MM-DD-YYYY`
- Trailer # appears in Claim Summary only

### Attachment note text
Customer branch note text:
`Warranty attachments uploaded via customer intake form for Claim #<claimNumber> (VIN <vin>).`

### Explicit contract exclusions
Customer flow does not include:
- `is_sold_unit`
- `labor_hours`
- `dealer_first_name`
- `dealer_last_name`
- `dealer_contact_name`
- sold-unit-based conditional logic
- any other field-triggered show/hide logic

---

## Locked Decisions — Worker Branching Update Spec

Below is the locked implementation model for the Worker.

### Worker architecture
Use:
- one shared core
- two explicit branches:
  - dealer
  - customer

Do not:
- duplicate into two separate full handlers
- allow the Worker to become one giant conditional-heavy path

### Shared core categories
These four categories are explicitly common core:
1. Parsing / Normalization
2. Validation / Formatting
3. HTTP / Response
4. External-Service Orchestration

### Shared core rule
All four categories are shared core.

Important nuance:
- belonging to a shared category does **not** mean every current helper stays shared unchanged
- where a helper contains dealer-specific business logic, it must be split into branch-specific implementations while preserving the shared stage

### Scope guardrail
For this update:
- shared core is formalized
- customer branch is added
- dealer branch remains behaviorally unchanged except for minimal internal refactoring needed to fit the shared-core / two-branch architecture

### Branch dispatch rule
- `claim_submitted_by = dealer` → dealer branch
- `claim_submitted_by = customer` → customer branch
- anything else / missing / unsupported → validation error / rejected submission

### Shared orchestration order
Locked order:
1. CORS / preflight / method gate
2. Parse request into normalized payload + attachments
3. Honeypot check
4. Dispatch branch from `claim_submitted_by`
5. Run branch-specific validation using shared validators
6. Resolve canonical submission email
7. Generate shared sequential claim number
8. Find or create HubSpot contact
9. Build ticket subject/content/properties
10. Create HubSpot ticket
11. Associate ticket to contact
12. Attempt company association
13. Upload attachments
14. Create attachment note
15. Build/send confirmation email
16. Return JSON response

### Claim-number rule
- one shared sequential claim counter
- shared by dealer and customer
- no branch-specific claim-number behavior

Critical wording locked:
> Claim number generation occurs after branch validation and canonical email resolution, but before any HubSpot side effects, including contact lookup/create, ticket creation, associations, attachment upload, note creation, and confirmation email send.

### Shared parsing stage
Keep:
- same multipart primary path
- same JSON parse path in code
- same honeypot alias support:
  - `honeypot`
  - `_hp`
  - `website`
- same attachment parsing behavior from `attachments`

Branch-specific difference here:
- which parsed fields are expected/normalized after parsing

### Shared validation/helpers
Shared where possible:
- required/non-empty check mechanism
- email validation pattern
- phone handling pattern
- VIN normalization / VIN regex
- attachment rules
- honeypot behavior
- Yes/No display formatting
- Trailer # derivation
- date formatting
- address assembly
- name assembly

### Shared attachment rules
For both branches:
- parse attachments from `attachments`
- minimum 1 file
- maximum 10 files
- maximum 10 MB per file
- PRIVATE upload behavior remains
- same note association pattern remains

### Failure handling policy
Do **not** introduce a new global fatal/non-fatal policy in this branching spec.

Reason:
- doing so would conflict with current dealer behavior
- dealer branch must remain behaviorally unchanged

Instead:
- keep failure-handling aligned to current dealer behavior for this update
- flag hardening / response-truthfulness review as deferred follow-up work

### Branch-specific function inventory
The spec should include explicit branch inventories like:

Dealer:
- `validateDealerSubmission(...)`
- `getDealerCanonicalEmail(...)`
- `buildDealerContactProperties(...)`
- `buildDealerTicketSubject(...)`
- `buildDealerTicketContent(...)`
- `buildDealerTicketProperties(...)`
- `buildDealerConfirmationEmail(...)`
- `buildDealerAttachmentNoteText(...)`

Customer:
- `validateCustomerSubmission(...)`
- `getCustomerCanonicalEmail(...)`
- `buildCustomerContactProperties(...)`
- `buildCustomerTicketSubject(...)`
- `buildCustomerTicketContent(...)`
- `buildCustomerTicketProperties(...)`
- `buildCustomerConfirmationEmail(...)`
- `buildCustomerAttachmentNoteText(...)`

### Shared core function/helper inventory
The spec should also explicitly list shared helpers grouped under the four shared categories:

#### Parsing / Normalization
- `initParsedPayload(...)`
- `parseJsonBodyInto(...)`
- `parseFormDataInto(...)`
- `toTrim(...)`
- `toLowerTrim(...)`
- `toUpperTrim(...)`
- `looksLikeFile(...)`

#### Validation / Formatting
- required/non-empty check helper
- `isValidEmail(...)`
- `isValidVin(...)`
- `joinName(...)`
- `joinAddress(...)`
- `getTrailerNumberFromVin(...)`
- shared Yes/No display formatter
- shared date formatter(s)
- `escapeHtml(...)`
- `compactProps(...)`

#### HTTP / Response
- `handlePreflight(...)`
- `corsHeaders(...)`
- `allowOrigin(...)`
- `jsonResponse(...)`

#### External-Service Orchestration
- `nextClaimNumber(...)`
- `sendEmail(...)`
- `hsRequest(...)`
- `hsFindContactByEmail(...)`
- `hsCreateContact(...)`
- `hsUpsertContact(...)`
- `hsCreateTicket(...)`
- `hsAssociateTicketToContact(...)`
- `hsGetPrimaryCompanyIdForContact(...)`
- `hsAssociateTicketToCompany(...)`
- `hsUploadFile(...)`
- `hsGetNoteTicketAssociationTypeId(...)`
- `hsCreateNoteWithAttachments(...)`

### Dealer branch required-field rules
Dealer requires:
- `claim_submitted_by = dealer`
- `is_sold_unit`
- `dealer_name`
- `dealer_first_name`
- `dealer_last_name`
- `dealer_address`
- `dealer_city`
- `dealer_region`
- `dealer_postal_code`
- `dealer_country`
- `dealer_phone`
- `dealer_email`
- `date_of_occurrence`
- `vin`
- `warranty_symptoms`
- `warranty_request`
- `labor_hours`
- minimum 1 attachment
- `customer_first_name` and `customer_last_name` only when `is_sold_unit = yes`

### Customer branch required-field rules
Customer requires:
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
- minimum 1 attachment

### Customer no-conditional rule
Customer flow has:
- no sold-unit logic
- no conditional visibility path
- no conditional requiredness path for customer name fields
- customer first/last are always required

### Customer branch out-of-contract dealer-only fields
Customer branch must not use these dealer-only fields as part of its intended contract:
- `is_sold_unit`
- `dealer_first_name`
- `dealer_last_name`
- `labor_hours`

Meaning for customer flow:
- out of contract
- not required
- not used in validation
- not used in subject/content/email/property mapping
- must not influence behavior even if present

### Dealer mirror rule
Dealer branch remains aligned to current dealer contract.

Dealer branch does **not** accept the new customer-only fields like:
- `original_owner`
- `warranty_registration_complete`
- `customer_address`
- `customer_city`
- `customer_region`
- `customer_postal_code`
- `customer_country`
- `customer_phone`
- `customer_email`

Important explicit exception:
- this does **not** affect existing dealer sold-unit logic
- dealer still supports:
  - `is_sold_unit`
  - `customer_first_name`
  - `customer_last_name`
- with current behavior:
  - name fields required only when `is_sold_unit = yes`

### Shared contact flow
Keep current overall behavior:
- choose canonical email
- search HubSpot contact by email
- if found, reuse contact ID
- if not found, create contact
- do not update existing contacts during this flow

Branch-specific differences are limited to:
- canonical email
- contact properties sent on create

### Dealer contact behavior
Dealer branch contact behavior stays as-is for this update.

Explicit deferred note:
- dealer contact model should be refactored later
- later work should review whether dealer contact creation should move toward a cleaner native-property model and reduce reliance on parallel custom identity fields

### Customer canonical email
- `customer_email`

### Customer contact model
Map customer core identity/contact to native HubSpot contact properties wherever possible:

- `customer_first_name` → `firstname`
- `customer_last_name` → `lastname`
- `customer_email` → `email`
- `customer_phone` → `phone`
- `customer_address` → `address`
- `customer_city` → `city`
- `customer_region` → `state`
- `customer_postal_code` → `zip`
- `customer_country` → `country`

### Customer contact storage rule
For customer flow:
- store only customer core identity/contact data on the contact
- do not store Original Selling Dealer fields on the contact
- do not store Original Selling Dealer fields in native or custom HubSpot properties
- Original Selling Dealer is content-only

### Shared ticket creation flow
Keep current overall behavior:
- build subject
- build content/body
- assemble ticket properties
- create ticket
- attempt ticket ↔ contact association
- attempt company association

Branch-specific differences limited to:
- subject builder
- content builder
- canonical contact/company context
- minimal property deltas

### Customer ticket property mapping
Customer ticket properties explicitly include:
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

### Original Selling Dealer data rule
Original Selling Dealer fields are **content-only** in customer branch.

That means:
- included in ticket content
- included in confirmation email
- not mapped to HubSpot native contact properties
- not mapped to HubSpot custom contact properties
- not mapped to HubSpot ticket properties as part of this update

### Customer company association rule
Keep same best-effort pattern as dealer:
- create/find customer contact
- attempt ticket ↔ contact association
- if contact has a primary company, attempt ticket ↔ company association
- do **not** try to resolve Original Selling Dealer into company association in this update

### Shared attachment + note flow
Keep same structure:
- upload attachments to HubSpot Files
- use PRIVATE access
- create note associated to ticket
- store uploaded file IDs in `hs_attachment_ids`

Only branch-specific difference:
- note text builder

Customer note text:
`Warranty attachments uploaded via customer intake form for Claim #<claimNumber> (VIN <vin>).`

### Shared confirmation-email flow
Keep same overall structure:
- optional/config-driven
- build payload
- send through same provider path
- record `sent` / `failed` / `skipped`

Branch-specific differences limited to:
- recipient
- subject
- body content/payload

### Customer confirmation-email rule
Recipient:
- `customer_email` only

Body sections:
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

Content rules:
- no dealer contact name
- no labor-hours content
- `original_owner` / `warranty_registration_complete` as `Yes` / `No`
- dates displayed as `MM-DD-YYYY`
- Trailer # in Claim Summary only

### Shared response flow
Keep same response shape/mechanics as dealer:
- same `ok: true` / `ok: false`
- same validation-error structure
- same general success payload shape
- same browser-facing success condition
- same logging/correlation style
- same success message pattern

Customer branch should **not** introduce a new response schema.

### Deferred follow-up work
The Worker spec should include a deferred section covering at minimum:
1. Dealer contact-model refactor
2. Failure-handling / response-truthfulness hardening
3. Broader Worker hardening / cleanup beyond customer-branch scope

---

## Review Outcome on Worker Branching Spec

The Worker Branching Update Spec was reviewed and judged **strong overall**, with the following review notes:

### Strong / approved direction
- architecture is sound
- orchestration order matches the actual Worker’s live flow pattern
- customer contract alignment is strong
- scope controls are good
- dealer preservation rule is good
- native HubSpot contact mapping for customer is good
- Original Selling Dealer content-only rule is good

### Review tweaks proposed
Three tweaks were proposed after review:

1. add a deferred follow-up note for **UTM/source capture**
2. clarify that **allowed file types remain unchanged from current/live behavior**
3. clarify that the helper name `hsUpsertContact(...)` may remain legacy even though behavior for this update is create/find without updating existing contacts

### Important process note
User did **not** want these directly applied at that moment.  
Instead, a CR + deltas package was requested.

### Worker-spec minor revision CR created
**Artifact:** `CR-WTY-WORKER-001_minor_revisions.md`

This CR includes:
- UTM/source-capture deferred follow-up
- file-type-policy clarification
- legacy helper-name clarification
- explicit no-change disposition on the proposed wording tweak about “does not accept” vs “ignored if present”

---

## Clarification on the “does not accept” wording discussion

This came up during review.

Meaning of the concern:
- the shared parser will likely still read raw incoming fields
- but branch logic may intentionally ignore fields that are out of contract

So “does not accept” could sound like:
- reject the entire request if extra fields exist

Whereas your practical intention may simply be:
- not required
- not used
- not behavior-affecting

This wording issue was discussed but **not adopted as a spec revision yet**.  
It is logged as **no change at this time** in the Worker minor-revision CR.

---

## Current Best Source Stack for a Fresh Branch

If you start fresh, use this stack in this order:

1. `dealer_warranty_form.html`
2. `warranty-form-handler.js`
3. `Customer Warranty Intake Form Frontend Design.pdf`
4. `1-dealer_warranty_intake_current-state_implementation_spec.md`
5. `2-customer_warranty_intake_delta_spec.md`
6. `3-customer_warranty_intake-intended_submission_contract.md`
7. `4-customer_warranty_intake_worker_branching_update_spec.md`
8. `CR-WTY-WORKER-001_minor_revisions.md`

---

## What Is Most Likely Next

The most likely next artifact is:

### Customer Warranty Form Build Spec

Purpose:
- translate the customer submission contract + Worker branching spec into a front-end build sheet

It should cover:
- field layout
- section labels
- exact field names
- hidden inputs
- validation UX
- submit UX
- success/error UX
- front-end parity with dealer form where applicable

Alternative next move:
- apply `CR-WTY-WORKER-001_minor_revisions.md` to the Worker Branching Update Spec first, then proceed to the build spec

---

## Suggested Fresh-Branch Opening Prompt

Use something close to this in the next branch chat:

> We are resuming the Customer Warranty Intake stream.  
> Source stack includes:
> - current dealer form HTML
> - current Worker JS
> - customer frontend design PDF
> - dealer current-state implementation spec
> - customer delta spec
> - customer intended submission contract
> - customer worker branching update spec
> - Worker minor-revision CR  
>
> Treat the locked decisions in the handoff packet as governing context for this branch.  
> Preserve dealer behavior.  
> Do not broaden scope into a general Worker redesign.  
> The likely next artifact is **Customer Warranty Form Build Spec**, unless I explicitly tell you to apply the Worker minor-revision CR first.

---

## Final Fresh-Branch Guardrails

Carry these forward explicitly:

- preserve dealer behavior
- customer flow should mirror dealer behavior wherever practical
- avoid scope creep
- do not silently refactor dealer contact modeling in this project
- Original Selling Dealer is content-only in customer flow
- customer contact maps to native HubSpot contact properties wherever possible
- customer confirmation email goes to customer only
- customer flow has no sold-unit logic
- claim number sequence is shared across both branches
- Worker hardening and response-truthfulness redesign are deferred
- UTM/source capture is not solved yet and has been called out as deferred follow-up in CR form

## Handoff Close

This branch is in a good state.  
The architecture is largely defined.  
The contract is largely defined.  
The next chat should not need to rediscover major decisions — it should either:
- finalize/apply the Worker minor-revision CR
- or move directly into the Customer Warranty Form Build Spec.