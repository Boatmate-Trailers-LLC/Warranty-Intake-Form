# Customer Warranty Intake — Worker Branching Update Spec

## Document Purpose

This document defines the intended Worker update required to support the Customer Warranty Intake flow while preserving the current Dealer Warranty Intake flow.

It is an implementation-oriented branching spec, not code.

Its purpose is to:
- define the shared-core / two-branch Worker architecture
- describe what remains shared infrastructure
- define what remains dealer-specific
- define what must be added for the customer branch
- preserve dealer behavior during this update
- provide a stable implementation blueprint for future coding and review

## Baseline and Scope

This spec is based on:
- the current `warranty-form-handler.js`
- the Customer Warranty Intake — Delta Spec
- the Customer Warranty Intake — Intended Submission Contract

This update is scoped to:
- formalizing a shared core
- adding a customer branch
- preserving current dealer behavior
- minimizing drift and regression risk

This update is **not** a general Worker hardening or redesign effort.

## Architecture Model

The Worker architecture for this update is:
- one **shared core**
- two explicit branches:
  - `dealer`
  - `customer`

The Worker must not be redesigned as two separate end-to-end duplicated handlers.

The Worker must not be allowed to devolve into a single large conditional-heavy path where dealer/customer differences are scattered throughout the entire file.

## Shared Core Categories

The Worker Branching Update Spec defines the following four categories as **common core** shared infrastructure for both dealer and customer flows:

1. **Parsing / Normalization**
2. **Validation / Formatting**
3. **HTTP / Response**
4. **External-Service Orchestration**

These categories remain part of one shared core pipeline and are not duplicated into separate end-to-end dealer and customer implementations.

## Shared Core Rule

All four categories above are part of the shared core.

However, inclusion in a shared core category does **not** mean every current helper/function remains shared unchanged.

Where a current helper contains dealer-specific business logic, that helper must be refactored into branch-specific dealer/customer implementations while preserving the shared core stage around it.

## Branch-Specific Function Rule

Dealer-specific logic currently embedded inside shared-core areas must be split into explicit branch-specific implementations where the logic is not truly shared.

This applies especially to functions/stages such as:
- submission validation
- ticket subject building
- ticket content/body building
- confirmation email payload/content building
- attachment note text building
- contact property mapping
- canonical submission email selection

## Shared-Core Intent

The intent of this architecture is:

- keep one stable operational pipeline
- keep common infrastructure shared
- isolate dealer/customer differences to explicit branch logic
- minimize duplication
- reduce drift
- make future refactoring safer

## Scope Guardrail

For this update:
- the shared core is expanded and formalized
- the customer branch is added
- the dealer branch remains behaviorally unchanged except for minimal internal refactoring needed to fit the shared-core / two-branch architecture

## Shared Orchestration Order

The shared orchestration order is:

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

## Branch Dispatch Rule

Branch dispatch rule is:
- `claim_submitted_by = dealer` → dealer branch
- `claim_submitted_by = customer` → customer branch
- any other value, missing value, or unsupported value → validation error / rejected submission

## Claim Number Rule

Claim number generation is fully shared:
- one shared sequential claim counter
- used by both dealer and customer flows
- no branch-specific claim-number behavior

Claim number generation occurs after branch validation and canonical email resolution, but before any HubSpot side effects, including contact lookup/create, ticket creation, associations, attachment upload, note creation, and confirmation email send.

## Shared Core Function / Helper Inventory

### Parsing / Normalization
- `initParsedPayload(...)`
- `parseJsonBodyInto(...)`
- `parseFormDataInto(...)`
- `toTrim(...)`
- `toLowerTrim(...)`
- `toUpperTrim(...)`
- `looksLikeFile(...)`

### Validation / Formatting
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

### HTTP / Response
- `handlePreflight(...)`
- `corsHeaders(...)`
- `allowOrigin(...)`
- `jsonResponse(...)`

### External-Service Orchestration
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

## Branch-Specific Function Inventory

### Dealer branch
- `validateDealerSubmission(...)`
- `getDealerCanonicalEmail(...)`
- `buildDealerContactProperties(...)`
- `buildDealerTicketSubject(...)`
- `buildDealerTicketContent(...)`
- `buildDealerTicketProperties(...)`
- `buildDealerConfirmationEmail(...)`
- `buildDealerAttachmentNoteText(...)`

### Customer branch
- `validateCustomerSubmission(...)`
- `getCustomerCanonicalEmail(...)`
- `buildCustomerContactProperties(...)`
- `buildCustomerTicketSubject(...)`
- `buildCustomerTicketContent(...)`
- `buildCustomerTicketProperties(...)`
- `buildCustomerConfirmationEmail(...)`
- `buildCustomerAttachmentNoteText(...)`

## Shared Parsing / Normalization Rules

The shared core parsing stage keeps:
- the same `multipart/form-data` primary path
- the same JSON parse path in code
- the same honeypot alias support:
  - `honeypot`
  - `_hp`
  - `website`
- the same attachment parsing behavior from `attachments`

The only branch-specific difference at this stage is which parsed fields are expected and normalized after parsing.

### Customer Branch Parsed Payload Shape

The customer branch normalized parsed payload includes:
- `vin`
- `category`
- `claim_submitted_by`
- `original_owner`
- `warranty_registration_complete`
- `honeypot`
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
- `warranty_symptoms`
- `warranty_request`

Attachments remain handled through the same shared attachment-object pattern as dealer flow.

## Shared Validation / Formatting Rules

These validations/helpers remain shared where possible:
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

### Shared Attachment Rules

The shared core attachment rules remain identical for both branches:
- attachments parsed from `attachments`
- minimum 1 file required
- maximum 10 files
- maximum 10 MB per file
- same PRIVATE upload behavior to HubSpot Files
- same note association pattern to the ticket

### Dealer Branch Required-Field Rules

Dealer branch requires:
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
- at least 1 attachment
- plus `customer_first_name` and `customer_last_name` only when `is_sold_unit = yes`

### Customer Branch Required-Field Rules

Customer branch requires:
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

### Customer Branch No-Conditional Rule

The customer branch has no equivalent conditional customer-name logic.

That means:
- `customer_first_name` is always required
- `customer_last_name` is always required
- there is no `is_sold_unit`
- there is no conditional visibility path
- there is no conditional requiredness path for customer-name fields

### Customer Branch Out-of-Contract Dealer-Only Fields

The customer branch must not accept or process dealer-only fields as part of its intended contract, including:
- `is_sold_unit`
- `dealer_first_name`
- `dealer_last_name`
- `labor_hours`

For customer flow:
- they are out of contract
- they are not required
- they are not used in validation
- they are not used in subject/content/email/property mapping
- they must not influence customer-branch behavior even if present

### Dealer Branch Mirror Rule

Dealer branch remains aligned to the current dealer contract.

For dealer flow:
- customer-only customer-branch fields are out of contract
- they are not required
- they do not change dealer-branch behavior

**Explicit exception:**
This does not affect the dealer branch’s current sold-unit logic.

The dealer branch must continue to support:
- `is_sold_unit`
- `customer_first_name`
- `customer_last_name`

with current behavior:
- `customer_first_name` and `customer_last_name` are required only when `is_sold_unit = yes`

The dealer branch does not accept the new customer-only fields like:
- `original_owner`
- `warranty_registration_complete`
- `customer_address`
- `customer_city`
- `customer_region`
- `customer_postal_code`
- `customer_country`
- `customer_phone`
- `customer_email`

## Shared Contact Flow

The shared core contact flow remains:
- choose canonical email
- search HubSpot contact by email
- if found, reuse existing contact ID
- if not found, create contact
- do not update existing contact properties during this flow

Branch-specific differences are limited to:
- which email is canonical
- which contact properties are sent on create

### Dealer Branch Contact Behavior

Dealer branch contact behavior remains as-is for this update.

No intentional dealer contact-model changes are in scope.

### Customer Branch Canonical Contact Rule

For the customer branch, the canonical submitter/contact email is:
- `customer_email`

### Customer Branch Contact Property Mapping

For the customer branch, map the customer’s core identity/contact fields to HubSpot native contact properties wherever possible:
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
- store only the customer’s core identity/contact data on the contact
- do not store Original Selling Dealer fields on the customer contact
- do not store Original Selling Dealer fields in native or custom HubSpot properties as part of this update
- Original Selling Dealer data is content only

## Shared Ticket Creation Flow

The shared core ticket-creation flow remains:
- build subject
- build content/body
- assemble ticket properties
- create HubSpot ticket
- attempt ticket ↔ contact association
- attempt ticket ↔ company association

Branch-specific differences are limited to:
- subject builder
- content builder
- canonical contact/company context
- minimal ticket property deltas already approved

### Dealer Branch Ticket Behavior

Dealer branch remains behaviorally unchanged for this update.

Only minimal internal refactoring is allowed to support the new shared-core / two-branch architecture.

No intentional dealer contract or output changes are in scope for this update.

Dealer contact-model cleanup and other dealer-flow improvements are explicitly deferred to future follow-up work.

### Customer Branch Ticket Subject Rule

The customer-flow ticket subject remains structurally similar to dealer flow, using the customer as the primary party:

`Warranty Claim #<claimNumber> - <customer name> - <trailerNumber>`

Where:
- `<customer name>` = customer first + last name
- `<trailerNumber>` = 10th VIN character + last 4 VIN characters

### Customer Branch Ticket Content Rule

The customer-flow ticket description/content uses this structure:

```text
Warranty intake via website customer form.

Claim #: <claimNumber>
VIN: <vin>

=== Customer Information ===
Name: <customer_first_name> <customer_last_name>
Email: <customer_email>
Phone: <customer_phone>
Address: <customer_address>, <customer_city>, <customer_region>, <customer_postal_code>, <customer_country>
Original Owner?: <original_owner display value>
Warranty Registration Complete?: <warranty_registration_complete display value>

=== Original Selling Dealer ===
Dealership: <dealer_name>
Email: <dealer_email>
Phone: <dealer_phone>
Address: <dealer_address>, <dealer_city>, <dealer_region>, <dealer_postal_code>, <dealer_country>

=== Warranty Claim Information ===
Date of Occurrence: <date_of_occurrence>
Warranty Symptoms:
<warranty_symptoms>
Warranty Request:
<warranty_request>
```

### Customer Branch Content-Only Rule for Original Selling Dealer

Original Selling Dealer fields are content-only in the customer branch.

That means they:
- are included in the ticket content
- are included in the confirmation email
- are not mapped to HubSpot native contact properties
- are not mapped to HubSpot custom contact properties
- are not mapped to HubSpot ticket properties as part of this update

### Customer Branch Ticket Property Mapping

Customer branch ticket property mapping explicitly includes:
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

And explicitly omits:
- `warranty_labor_hours`

### Customer Branch Company Association Rule

For the customer branch company-association behavior, keep the same shared best-effort pattern as the dealer flow:
- create/find the customer contact
- attempt ticket ↔ contact association
- if that contact has a primary company, attempt ticket ↔ company association
- do not add new logic that tries to resolve the Original Selling Dealer into a company association as part of this update

## Shared Attachment + Note Flow

The shared core attachment + note flow remains:
- upload attachments to HubSpot Files
- use PRIVATE access
- create note associated to ticket
- store uploaded file IDs in `hs_attachment_ids`

The only branch-specific difference is the note text builder.

### Customer Branch Attachment Note Text

For the customer branch, attachment note text is:

`Warranty attachments uploaded via customer intake form for Claim #<claimNumber> (VIN <vin>).`

## Shared Confirmation Email Flow

The shared core confirmation email flow remains:
- email send remains optional/config-driven
- build email payload
- send email through the same provider path
- record `sent` / `failed` / `skipped`

Branch-specific differences are limited to:
- recipient
- subject
- body content/payload

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

## Shared HTTP / Response Flow

The shared core final response flow keeps the same response structure/mechanics for both branches:
- same `ok: true` / `ok: false` pattern
- same validation-error structure
- same general success payload shape
- same browser-facing success condition
- same logging/correlation style
- same success message pattern as dealer flow

For the customer branch response payload:
- keep the same response shape as dealer flow
- keep the same success message
- keep the same validation error structure
- keep the same optional internal IDs/diagnostic fields currently returned
- do not introduce any customer-specific response schema changes

## Failure-Handling Scope Rule

This Worker Branching Update Spec does **not** introduce a new global fatal/non-fatal policy.

Failure-handling behavior remains aligned to current dealer behavior for this update.

The customer branch should mirror the current dealer non-fatal/best-effort downstream behavior unless and until a separate Worker hardening effort intentionally changes that policy.

## Deferred Follow-Up Work

The following items are explicitly deferred and should be addressed in later follow-up work:

1. **Dealer contact-model refactor**
   - Review whether dealer contact creation should move toward a cleaner native-property model and reduce reliance on parallel custom identity fields.

2. **Failure-handling / response-truthfulness hardening**
   - Review ticket-creation fatality
   - false-success conditions
   - downstream failure boundaries
   - response contract truthfulness vs best-effort behavior

3. **Broader Worker hardening / cleanup beyond customer-branch scope**
   - broader cleanup/refactor work not required to add the customer branch while preserving dealer behavior

## Recommended Next Artifact

The next artifact should be:

**Customer Warranty Form Build Spec**

That document should translate the locked submission contract and this Worker branching spec into a form-build implementation sheet covering:
- field layout
- labels
- hidden inputs
- validation UX
- submit UX
- success/error messaging
- front-end parity with the dealer form where applicable
