# Customer Warranty Intake Form - Worker Implementation Prompt

## Scope Wrapper

### Scope
These instructions apply only to this conversation thread/chat in which they are pasted.

### Activation
Treat the directives below as active immediately in this chat from this message forward.

### Isolation
Do not apply, generalize, or carry these instructions into other chats, projects, memories, or future conversations unless I explicitly tell you to.

### Precedence
Within this chat, follow these instructions as the governing workflow unless they conflict with higher-priority system/developer instructions.

### Deactivation
If I say “exit [mode name]” or “reset mode,” stop applying these instructions.

## ROLE

You are a deterministic patch implementer for Boatmate’s warranty-intake Worker.

Your job is to patch the existing `warranty-form-handler.js` file in a controlled, minimal-drift way using only the supplied governing artifacts.

You are not acting as:
- a product designer
- an architect reopening requirements
- a refactor bot doing opportunistic cleanup
- a security-hardening pass
- a backend redesign agent

Your job is to implement the locked Worker changes exactly as specified.

## REQUIRED INPUT

Before you begin, confirm you have these 5 inputs:

1. `4-customer_warranty_intake_worker_branching_update_spec.md`
   - current authoritative Worker branching spec
   - governs architecture, shared-core rules, branch rules, orchestration order, mapping rules, and backend scope

2. `7-customer_warranty_intake_worker_patch_plan_v1.0.md`
   - current Worker patch sequence
   - governs recommended patch order, patch grouping, and backend acceptance checks

3. `warranty-form-handler.js`
   - current Worker source baseline
   - patch this file in place

4. `3-customer_warranty_intake-intended_submission_contract.md`
   - governs the intended customer submission contract

5. `5-customer_warranty_intake_form_build_spec.md`
   - coordination artifact for front-end/Worker contract alignment
   - relevant for hidden inputs, expected field names, and no-response-schema-redesign coordination

If any of these 5 inputs are missing, stop and request them before coding.

Request message if missing:

> Please provide the current Worker branching spec, the Worker patch plan, the current `warranty-form-handler.js` baseline, the intended customer submission contract, and the current customer build spec before implementation. I should not infer or reconstruct missing source artifacts.

If all 5 inputs are present:
- follow them in this precedence order:
  1. `4-customer_warranty_intake_worker_branching_update_spec.md`
  2. `7-customer_warranty_intake_worker_patch_plan_v1.0.md`
  3. `warranty-form-handler.js`
  4. `3-customer_warranty_intake-intended_submission_contract.md`
  5. `5-customer_warranty_intake_form_build_spec.md`
- if there is any conflict, the current Worker branching spec wins
- do not invent behavior outside these artifacts

## OBJECTIVE

Patch the existing `warranty-form-handler.js` to support the Customer Warranty Intake flow while preserving the current Dealer Warranty Intake flow.

## CRITICAL SCOPE RULES

- WORKER / BACKEND ONLY.
- Patch the existing `warranty-form-handler.js` in place.
- Keep one Worker artifact.
- Keep one exported `fetch()` entry point.
- Keep one shared orchestration pipeline.
- Add one explicit dealer branch and one explicit customer branch.
- Do not fork into separate dealer/customer Worker files.
- Do not duplicate the full end-to-end handler into two standalone flows.
- Do not redesign the response schema.
- Do not redesign response truthfulness / false-success behavior in this milestone.
- Do not add UTM/source capture in this milestone.
- Do not add a new allowed-file-type policy in this milestone.
- Do not add special Original Selling Dealer company-resolution logic.
- Do not do broader dealer contact-model cleanup beyond what is minimally required for branching.
- Preserve current dealer behavior unless a minimal internal refactor is required to fit the shared-core / two-branch architecture.

## IMPLEMENTATION STRATEGY

- Start from the current `warranty-form-handler.js` baseline.
- Preserve shared infrastructure where it is truly shared:
  - CORS / preflight / method gate
  - JSON / multipart parsing stage
  - attachment parsing mechanics
  - response helpers
  - claim-number generation
  - HubSpot request helpers
  - file upload flow
  - note association flow
  - email transport
- Split dealer/customer business logic into explicit branch-specific helpers where the logic is not truly shared.
- Keep the dealer branch behaviorally aligned to the current dealer contract.
- Add the customer branch per the authoritative Worker branching spec.

## TOP-LEVEL ARCHITECTURE RULES

Implement the Worker as:
- one shared core
- two explicit branches:
  - dealer
  - customer

The shared orchestration order must remain:

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

Do not change that overall orchestration shape.

## PATCH TARGET

- Patch target: `warranty-form-handler.js`
- Do not create a second Worker file.
- Do not convert the file into two duplicated end-to-end handlers.

## PATCH SHAPE

Refactor and add explicit helpers along these lines.

### SHARED CORE HELPERS / STAGES

- `initParsedPayload(...)`
- `parseJsonBodyInto(...)`
- `parseFormDataInto(...)`
- `toTrim(...)`
- `toLowerTrim(...)`
- `toUpperTrim(...)`
- `looksLikeFile(...)`
- required/non-empty helper(s)
- `isValidEmail(...)`
- `isValidVin(...)`
- `joinName(...)`
- `joinAddress(...)`
- `getTrailerNumberFromVin(...)`
- shared yes/no display helper(s)
- shared date formatter(s)
- `escapeHtml(...)`
- `compactProps(...)`
- `handlePreflight(...)`
- `corsHeaders(...)`
- `allowOrigin(...)`
- `jsonResponse(...)`
- `nextClaimNumber(...)`
- `sendEmail(...)`
- `hsRequest(...)`
- `hsFindContactByEmail(...)`
- `hsCreateContact(...)`
- `hsUpsertContact(...)`  
  legacy name may remain if practical
- `hsCreateTicket(...)`
- `hsAssociateTicketToContact(...)`
- `hsGetPrimaryCompanyIdForContact(...)`
- `hsAssociateTicketToCompany(...)`
- `hsUploadFile(...)`
- `hsGetNoteTicketAssociationTypeId(...)`
- `hsCreateNoteWithAttachments(...)`

### BRANCH-SPECIFIC HELPERS

#### Dealer branch
- `validateDealerSubmission(...)`
- `getDealerCanonicalEmail(...)`
- `buildDealerContactProperties(...)`
- `buildDealerTicketSubject(...)`
- `buildDealerTicketContent(...)`
- `buildDealerTicketProperties(...)`
- `buildDealerConfirmationEmail(...)`
- `buildDealerAttachmentNoteText(...)`

#### Customer branch
- `validateCustomerSubmission(...)`
- `getCustomerCanonicalEmail(...)`
- `buildCustomerContactProperties(...)`
- `buildCustomerTicketSubject(...)`
- `buildCustomerTicketContent(...)`
- `buildCustomerTicketProperties(...)`
- `buildCustomerConfirmationEmail(...)`
- `buildCustomerAttachmentNoteText(...)`

## SHARED PARSING / NORMALIZATION RULES

Keep:
- `multipart/form-data` as the primary live path
- the JSON parse path in code
- honeypot alias support:
  - `honeypot`
  - `_hp`
  - `website`
- shared attachment parsing from `attachments`

Expand the normalized payload so it can represent both branches.

Keep current dealer fields, including:
- `is_sold_unit`
- `dealer_first_name`
- `dealer_last_name`
- `labor_hours`

Add customer-branch fields:
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

Preserve shared core fields:
- `category`
- `claim_submitted_by`
- `honeypot`

## ATTACHMENT RULES

Keep shared attachment rules identical for both branches:
- files are parsed only from `attachments`
- minimum 1 file required
- maximum 10 files
- maximum 10 MB per file
- same PRIVATE upload behavior to HubSpot Files
- same note association pattern to the ticket
- keep current/live allowed-file-type behavior unchanged in this milestone
- do not introduce a new file-type allowlist in this milestone

## BRANCH DISPATCH RULES

After honeypot handling:
- `claim_submitted_by = dealer` → dealer branch
- `claim_submitted_by = customer` → customer branch
- any other value, missing value, or unsupported value → validation error / rejected submission

Replace any hardcoded dealer-only assumption with explicit branch dispatch.

## CANONICAL EMAIL RULES

- dealer branch canonical email = `dealer_email`
- customer branch canonical email = `customer_email`

Use explicit helpers:
- `getDealerCanonicalEmail(...)`
- `getCustomerCanonicalEmail(...)`

## VALIDATION RULES

Preserve shared validation primitives where possible:
- required/non-empty checks
- `isValidEmail(...)`
- `isValidVin(...)`
- attachment-rule enforcement
- shared yes/no, date, and address helpers

### Dealer branch
- preserve current dealer validation behavior
- `claim_submitted_by` must equal `dealer`
- keep `is_sold_unit` requirement
- keep dealer contact-name requirement
- keep `labor_hours` required
- keep conditional `customer_first_name` and `customer_last_name` only when `is_sold_unit = yes`
- keep at least 1 attachment required

### Customer branch
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

## CUSTOMER BRANCH OUT-OF-CONTRACT RULE

For the customer branch, these dealer-only fields are out of contract:
- `is_sold_unit`
- `dealer_first_name`
- `dealer_last_name`
- `labor_hours`

For customer flow:
- they are not required
- they are not used in validation
- they are not used in subject/content/email/property mapping
- they must not influence customer behavior even if present

## DEALER BRANCH MIRROR RULE

Preserve current dealer behavior.
Do not let customer-only fields change dealer-branch behavior.

Explicit exception:
- dealer branch still supports `is_sold_unit`
- dealer branch still supports conditional `customer_first_name` / `customer_last_name` when `is_sold_unit = yes`

## CONTACT FLOW RULES

Keep the shared contact orchestration shape:
- choose canonical email
- find contact by email
- if found, reuse existing contact ID
- if not found, create contact

Do not update existing contact properties during this milestone.

Legacy helper naming such as `hsUpsertContact(...)` may remain if practical, but its behavior for this milestone must remain create/find only.

### Dealer branch contact behavior
- preserve current dealer behavior as-is

### Customer branch contact behavior
Map customer identity/contact data to HubSpot native contact properties where possible:
- `customer_first_name` → `firstname`
- `customer_last_name` → `lastname`
- `customer_email` → `email`
- `customer_phone` → `phone`
- `customer_address` → `address`
- `customer_city` → `city`
- `customer_region` → `state`
- `customer_postal_code` → `zip`
- `customer_country` → `country`

For the customer contact record:
- store only the customer’s core identity/contact data
- do not store Original Selling Dealer fields on the customer contact
- do not store Original Selling Dealer fields in native or custom contact properties in this milestone

## TICKET FLOW RULES

Keep the shared ticket-creation path:
- build subject
- build content
- assemble ticket properties
- create HubSpot ticket
- attempt ticket ↔ contact association
- attempt ticket ↔ company association

Use explicit branch-specific builders.

### Dealer branch
- keep dealer behavior materially unchanged

### Customer branch subject
- `Warranty Claim #<claimNumber> - <customer name> - <trailerNumber>`

Where:
- customer name = first + last name
- trailer number = 10th VIN character + last 4 VIN characters

### Customer branch content
Build the ticket content in this section order:
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
- `original_owner` displayed as Yes / No
- `warranty_registration_complete` displayed as Yes / No
- dealer name / email / phone / assembled address
- date of occurrence
- warranty symptoms
- warranty request

### Customer branch ticket properties must include
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

## ORIGINAL SELLING DEALER RULE

For the customer branch, Original Selling Dealer data is:
- included in ticket content
- not mapped to contact properties
- not mapped to ticket properties in this milestone
- not used for special company-resolution logic

## ASSOCIATION RULES

Keep the current best-effort association pattern:
- attempt ticket ↔ contact association
- if contact has a primary company, attempt ticket ↔ company association
- preserve non-fatal behavior if associations fail

For the customer branch:
- do not add new logic that tries to resolve the Original Selling Dealer into a company association

## ATTACHMENT NOTE RULES

Keep shared attachment upload mechanics:
- upload files to HubSpot Files
- PRIVATE access
- collect file IDs
- create note associated to ticket
- store IDs in `hs_attachment_ids`

Use explicit note-text builders.

### Customer branch note text
- `Warranty attachments uploaded via customer intake form for Claim #<claimNumber> (VIN <vin>).`

### Dealer branch
- preserve current dealer note behavior

## CONFIRMATION EMAIL RULES

Keep shared email transport.
Split the email-payload/content builders per branch.

### Dealer branch
- preserve current dealer confirmation email behavior

### Customer branch
- send confirmation to `customer_email` only
- do not include labor-hours content
- do not include dealer contact-name content
- include claim summary aligned to the customer contract
- keep overall email transport / best-effort behavior aligned to the dealer baseline

## HONEYPOT / NON-FATAL FAILURE RULES

Preserve current honeypot behavior:
- non-empty honeypot silently drops the submission
- Worker returns `ok: true` with a generic submitted message
- submission is not processed further

Preserve current downstream best-effort behavior where that is already part of the dealer baseline.
Do not redesign false-success / truthfulness behavior in this milestone.

## RESPONSE RULES

Keep the same general response structure/mechanics already used by the dealer flow.
Do not redesign the response schema.
Do not change the browser-facing success contract in this milestone.

## DELIVERABLES

1. Patch `warranty-form-handler.js` in place
2. Keep the implementation production-style, not pseudo-code
3. Preserve one Worker file and one `fetch()` entry point
4. At the end, provide:
   - a short summary of what changed
   - any assumptions made
   - a brief self-check against the acceptance checklist below

## ACCEPTANCE CHECKLIST

### Static / structural checks
- one Worker file only
- one exported `fetch()` entry point only
- explicit dealer branch exists
- explicit customer branch exists
- shared-core helpers remain shared where appropriate
- no duplicated full end-to-end dealer/customer handlers exist

### Behavioral checks
- invalid or missing `claim_submitted_by` returns validation failure
- dealer submission still validates and behaves as before
- customer submission with missing `original_owner` fails validation
- customer submission with missing `warranty_registration_complete` fails validation
- customer submission ignores out-of-contract dealer-only fields such as `labor_hours`
- customer branch uses `customer_email` as the canonical contact email
- customer contact create/find does not overwrite an existing contact during this milestone
- customer ticket subject follows the locked customer subject rule
- customer ticket content includes customer section + Original Selling Dealer section + claim section
- customer ticket properties include `original_owner` and `warranty_registration_complete`
- customer ticket properties omit `warranty_labor_hours`
- customer attachment note is created with the correct customer wording
- customer confirmation email excludes labor-hours and dealer-contact-name content
- downstream non-fatal failures still mirror current dealer best-effort behavior
- claim number generation remains shared across both branches
- response schema/mechanics remain aligned to the current dealer flow

## OUTPUT MODE

Modify the target implementation in production-style code.
Do not return pseudo-code.

At completion, return:
1. a concise change summary
2. assumptions made, if any
3. a brief acceptance-check self-audit

## IMPORTANT

Do not improve deferred areas.
Do not add UTM/source capture.
Do not redesign response truthfulness.
Do not introduce a new file-type policy.
Do not create separate dealer/customer Worker files.
Do not convert the implementation into two duplicated end-to-end handlers.
Follow the attached artifacts exactly and keep drift to zero.