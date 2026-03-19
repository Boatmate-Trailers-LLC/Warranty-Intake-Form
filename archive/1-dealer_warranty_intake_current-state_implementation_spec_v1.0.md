# Dealer Warranty Intake — Current-State Implementation Spec

## Document Purpose

This document describes the current as-built behavior of the Dealer Warranty Intake system based on the current `dealer_warranty_form.html` and `warranty-form-handler.js` files.

This is not a future-state requirements document. It is a reverse-engineered implementation spec intended to:
- document the current live dealer submission flow
- define the current front-end ⇄ Worker contract
- capture exact field names and conditional rules
- document current validation behavior
- document current HubSpot routing behavior
- provide a stable baseline for designing the Customer Warranty Intake flow

## System Scope

The current dealer warranty intake flow consists of:
- a dealer-facing HTML form
- client-side JavaScript for conditional UI, validation, and submission
- a Cloudflare Worker that parses, validates, enriches, and routes submissions
- a Durable Object used for sequential claim numbering
- HubSpot as the downstream CRM/ticket destination
- optional confirmation email behavior

## Current Submission Flow

1. Dealer opens the Dealer Warranty Intake form.
2. Form always includes hidden values:
   - `claim_submitted_by=dealer`
   - `category=Warranty`
3. Dealer completes Dealer Information fields.
4. Dealer selects whether the unit is a sold unit using `is_sold_unit=yes|no`.
5. If `is_sold_unit=yes`, the Customer Information section is shown and customer first/last name become required.
6. Dealer completes Warranty Claim Information fields.
7. Dealer attaches one or more files under `attachments`.
8. Client-side JavaScript validates the submission in top-to-bottom form order.
9. Browser submits `multipart/form-data` to the Cloudflare Worker endpoint.
10. Worker parses the request, validates required values, generates a sequential claim number, and attempts HubSpot operations.
11. Worker may optionally send a confirmation email.
12. Worker returns JSON to the browser.
13. If browser receives `ok: true`, the UI shows success and resets the form.

## Current Live Form Contract

### Hidden / System Fields
The current HTML form submits these hidden/system fields:
- `claim_submitted_by`
- `category`
- `website` (honeypot)

Current fixed values in the HTML form:
- `claim_submitted_by = dealer`
- `category = Warranty`

### Dealer Information Fields
The current form field names are:
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

All of the above are required on the current dealer form.

### Sold Unit Field
The current radio field name is:
- `is_sold_unit`

Allowed values in the current form:
- `yes`
- `no`

This field is required.

### Customer Information Fields
The current customer field names are:
- `customer_first_name`
- `customer_last_name`

These are:
- hidden by default
- shown only when `is_sold_unit=yes`
- disabled when hidden
- required only when visible / when `is_sold_unit=yes`

### Warranty Claim Information Fields
The current field names are:
- `vin`
- `date_of_occurrence`
- `warranty_symptoms`
- `warranty_request`
- `labor_hours`
- `attachments`

Current UI expectations:
- `vin` is required
- `date_of_occurrence` is required
- `warranty_symptoms` is required
- `warranty_request` is required
- `labor_hours` is required
- `attachments` is required

### Explicitly Not in Current Dealer Contract
The current dealer form does not collect or submit:
- `sold_unit`
- `dealership`
- `original_owner`
- customer address / city / region / postal code / country / phone / email
- `ship_to`
- `labor_rate`

## Client-Side Behavior

### Conditional UI Logic
The front-end script uses the radio group named `is_sold_unit` to control the Customer Information fieldset.

Current behavior:
- default state = customer section hidden
- when `is_sold_unit=yes`, customer section is shown
- when `is_sold_unit=no`, customer section is hidden
- when hidden, customer inputs are disabled
- when hidden, customer inputs are not required
- when hidden, invalid styling is cleared from customer inputs

### Client-Side Normalization
Before validation/submission:
- `vin` is trimmed and uppercased

### Client-Side Validation Order
The front-end validates in this order:
1. Dealer Information required fields
2. `is_sold_unit` radio selection
3. Customer first/last name when `is_sold_unit=yes`
4. Warranty Claim Information fields, with VIN format validated before the other claim fields
5. Attachments

### Client-Side Validation Rules
Current front-end validation enforces:
- all Dealer Information fields are non-empty
- dealer email matches a basic email regex
- `is_sold_unit` must be selected
- customer first/last name are required only when `is_sold_unit=yes`
- `vin` must be 17 characters and match `[A-HJ-NPR-Z0-9]{17}`
- `date_of_occurrence` must be non-empty
- `warranty_symptoms` must be non-empty
- `warranty_request` must be non-empty
- `labor_hours` must be non-empty
- at least one attachment is required
- max 10 attachments
- max 10 MB per attachment

### Client-Side UX Behavior
Current UI behavior includes:
- custom validation because form uses `novalidate`
- field-level invalid styling via `.bm-invalid`
- fieldset-level invalid styling for the sold-unit radio group
- shared status message area in `#form-status`
- submit button loading state with spinner
- success resets the form and restores initial hidden-field/UI state
- after `form.reset()`, script reassigns hidden values:
  - `claim_submitted_by = dealer`
  - `category = Warranty`

## Worker Request Parsing

### Supported Content Types
Current Worker behavior:
- primary live contract: `multipart/form-data`
- code path also supports: `application/json`

The HTML dealer form currently uses `multipart/form-data`.

### Parsed Payload Shape
The Worker initializes and parses these normalized payload fields:
- `vin`
- `category`
- `claim_submitted_by`
- `is_sold_unit`
- `honeypot`
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
- `customer_first_name`
- `customer_last_name`
- `date_of_occurrence`
- `warranty_symptoms`
- `warranty_request`
- `labor_hours`

### Honeypot Handling
Current Worker behavior supports these honeypot aliases:
- `honeypot`
- `_hp`
- `website`

If honeypot is non-empty:
- Worker logs a warning
- Worker returns `ok: true` with a generic submitted message
- submission is silently dropped

### Attachment Parsing
Current Worker attachment behavior:
- reads files only from `attachments`
- ignores non-file values
- max 10 files
- max 10 MB per file
- collects `attachments.files`
- collects `attachments.fileNames`
- collects parsing/limit errors in `attachments.errors`

## Worker Validation Rules

### Authoritative Submission Rules
The Worker currently enforces:
- `claim_submitted_by` must equal `dealer`
- VIN must match 17-char regex with no I/O/Q
- all dealer fields are required
- dealer email is required and must match basic email regex
- `is_sold_unit` must be `yes` or `no`
- if `is_sold_unit=yes`, `customer_first_name` is required
- if `is_sold_unit=yes`, `customer_last_name` is required
- `date_of_occurrence` is required
- `warranty_symptoms` is required
- `warranty_request` is required
- `labor_hours` is required
- at least one attachment is required

### Current Validation Limits / Gaps
The Worker currently does not strongly enforce:
- numeric format for `labor_hours`
- future-date prevention for `date_of_occurrence`
- file type allowlisting

## Claim Number Behavior

The Worker generates a claim number before HubSpot operations using the `CLAIM_COUNTER` Durable Object.

Current behavior:
- storage key = `n`
- initial seed = `100000`
- first generated claim number = `100001`
- Worker uses `POST /next` on the Durable Object stub

## HubSpot Contact Behavior

### Contact Lookup / Create Logic
The Worker uses dealer email as the canonical submission email.

Current behavior:
- lowercases `dealer_email`
- searches HubSpot contacts by email
- if contact exists, returns the existing contact ID
- if no contact exists, creates a new contact
- does not update existing contact properties during this flow

### Current Contact Property Mapping
When creating a new contact, the Worker prepares these properties:
- `email`
- `dealer`
- `dealer_first_name`
- `dealer_last_name`
- `dealer_address`
- `dealer_city`
- `dealer_state` ← mapped from `dealer_region`
- `dealer_zip` ← mapped from `dealer_postal_code`
- `dealer_country`
- `dealer_phone`
- `dealer_email`
- `customer_first_name`
- `customer_last_name`

## HubSpot Ticket Behavior

### Ticket Naming / Subject Logic
The Worker builds:
- trailer number = 10th VIN character + last 4 characters when VIN length = 17
- dealer contact name from dealer first + last
- customer name from customer first + last

Current subject format:
- `Warranty Claim #<claimNumber> - <dealer name or dealer contact name or Dealer> - <trailerNumber>`

### Ticket Content Body
The Worker builds a multi-line text content block containing:
- claim number
- VIN
- dealer information
- customer name
- date of occurrence
- warranty symptoms
- warranty request
- labor hours when present

### Current Ticket Property Mapping
The Worker maps these ticket properties:
- `hs_pipeline`
- `hs_pipeline_stage`
- `subject`
- `content`
- `trailer_vin`
- `warranty_date_of_occurrence`
- `warranty_symptoms`
- `warranty_request`
- `warranty_labor_hours`
- `hs_file_upload`
- `hs_ticket_category`
- `claim_submitted_by`

Current source values include:
- `hs_ticket_category` ← `category`
- `hs_file_upload` ← comma-joined attachment filenames

### Ticket Creation Config
Current defaults when env vars are absent:
- pipeline default = `760934225`
- stage default = `1108043102`

## HubSpot Associations

If both `ticketId` and `contactId` exist, the Worker attempts:
- ticket ↔ contact association
- lookup of contact’s primary company
- ticket ↔ company association when company is found

Association failures are logged but do not stop response flow.

## Attachment Upload + Note Behavior

When `ticketId` exists and attachments are present, the Worker attempts to:
- upload files to HubSpot Files API
- use PRIVATE access
- default folder path to `/warranty-intake` unless overridden by env
- collect uploaded HubSpot file IDs
- create a note associated to the ticket
- populate `hs_attachment_ids` on the note as a semicolon-delimited list of file IDs

Current note body format:
- `Warranty attachments uploaded via dealer intake form for Claim #<claimNumber> (VIN <vin>).`

## Confirmation Email Behavior

### Email Enablement Gate
Current email send path only runs when all of the following are true:
- `EMAIL_ENABLED === "true"`
- `EMAIL_API_ENDPOINT` is present
- `EMAIL_API_KEY` is present
- `FROM_EMAIL` is present

### Email Payload Content
If enabled, the Worker builds and sends a confirmation email containing:
- claim number
- trailer number when derivable
- VIN
- date submitted
- dealer information
- customer name
- date of occurrence
- warranty symptoms
- warranty request
- labor hours when present
- attached file names or `None`

Current recipient:
- dealer email only

### Email Status Values
Current response/status values:
- `sent`
- `failed`
- `skipped`

## Current Response Contract

### Browser-Side Success Condition
The front-end treats submission as successful only when:
- HTTP response is OK
- JSON parses successfully
- `data.ok === true`

### Current Worker Success Payload
Current Worker success response may include:
- `ok`
- `claimNumber`
- `ref`
- `contactId`
- `ticketId`
- `noteId`
- `emailStatus`
- `message`
- `ticketError`
- `attachmentFileNames`
- `attachmentFileIds`
- `attachmentsError`

### Current Worker Validation Error Payload
Current validation error behavior:
- HTTP 400
- JSON with `ok: false`
- `errors: [...]`

### Current Failure Characteristic
Current as-built behavior allows a possible false-success condition:
- ticket creation errors are caught into `ticketError`
- Worker still returns `ok: true`
- browser treats that as a successful submission

## Known Intentional Behaviors

The following appear intentional in the current implementation:
- dealer-only flow identified by `claim_submitted_by=dealer`
- sold-unit logic is driven by `is_sold_unit`
- customer info on dealer form is name-only
- `ship_to` is excluded entirely
- `labor_rate` is excluded entirely
- honeypot alias `website` is accepted
- contact handling behaves as create-or-find instead of overwrite/update
- claim number is generated server-side, not supplied by browser

## Known Technical Limitations / Open Concerns

Current as-built limitations and concerns include:
- possible false-success if ticket creation fails
- `category` is still client-submitted, even though form fixes it to `Warranty`
- response payload exposes internal IDs not strictly needed by browser
- JSON support exists in code but is not the primary live dealer-form contract
- endpoint hardening is light beyond CORS allowlist + honeypot
- `labor_hours` is required but not strongly typed as numeric
- `date_of_occurrence` is required but not checked against future dates
- no explicit file type allowlist is enforced

## Baseline Summary for Customer-Form Design

This dealer implementation establishes the current baseline pattern:
- one purpose-built HTML form for the dealer submitter experience
- one Worker endpoint handling parsing, validation, claim numbering, HubSpot routing, and optional email
- conditional requirements driven by submission context (`is_sold_unit`)
- server-generated claim numbers
- HubSpot ticket-centric routing with contact/company association attempts
- attachment upload plus note association pattern
- JSON response returned to browser for UI messaging

This document should be treated as the current-state baseline for defining the Customer Warranty Intake delta spec.

