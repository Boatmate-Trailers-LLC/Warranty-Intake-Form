# Customer Warranty Intake — Form Build Spec

## Document Purpose

This document translates the locked Customer Warranty Intake submission contract and Worker branching spec into a front-end implementation build sheet.

It is a build-spec artifact, not code.

Its purpose is to:
- define the customer form HTML/CSS/JS build target
- make layout, labels, field names, and client-side behavior implementation-ready
- preserve dealer-form mechanics wherever practical
- keep dealer behavior stable by avoiding unnecessary front-end architecture changes in this milestone
- provide a deterministic build baseline before coding begins

## Baseline and Scope

This build spec is based on:
- `dealer_warranty_form.html`
- `3-customer_warranty_intake-intended_submission_contract.md`
- `4-customer_warranty_intake_worker_branching_update_spec.md`
- `2-customer_warranty_intake_delta_spec.md`
- `Customer Warranty Intake Form Frontend Design.pdf`
- the provided Boatmate visual style sheet image

This spec is scoped to the **customer-facing form build** only.

It covers:
- front-end structure
- field layout
- visible labels
- exact field names
- hidden/system inputs
- client-side validation behavior
- submit behavior
- success/error UX
- dealer-parity implementation rules

It does **not** define:
- Worker code changes
- HubSpot implementation details beyond front-end dependencies
- UTM/source capture implementation
- a new file-type policy
- a full sitewide design-system implementation

## Implementation Target

### Recommended Build Shape

Implement the customer flow as a **separate dedicated customer form artifact/page** parallel to the dealer form.

Recommended approach for this milestone:
- start from the current dealer form structure/CSS/JS pattern
- remove dealer-only sections/logic
- add the customer-specific sections/fields
- keep the same overall fetch/validation/status/spinner mechanics
- do **not** convert the dealer form into one combined multi-mode front-end form in this milestone

### Build Goal

The customer form should feel like the dealer form’s sibling:
- same overall component pattern
- same validation model
- same response handling model
- same loading/status behavior
- same mobile collapse behavior
- customer-specific differences only where the contract requires them

## Build-Layer Resolutions

These items are resolved at the build layer so coding can proceed without reopening the contract.

### 1) Visible label copy follows dealer-form/PDF wording where that improves parity

Use these visible labels in the implemented customer form:
- `dealer_region` / `customer_region` → **State/Province/Region**
- `dealer_postal_code` / `customer_postal_code` → **Zip/Postal Code**
- `dealer_country` / `customer_country` → **Country/Region**

This does **not** change payload names.

### 2) Date input remains a native date control

The design PDF visually shows `mm / dd / yyyy`, but implementation remains:
- `type="date"`
- native browser date UI
- no custom masked date text control in this milestone

### 3) No new client-side file-type allowlist in this build

Allowed file types are unchanged from current/live behavior.

Implementation rule for this milestone:
- do **not** introduce a new `accept="..."` restriction unless it is confirmed to match live behavior exactly
- safest build is to keep the file input behavior aligned to the current dealer form pattern

### 4) Submit button label follows the design, while loading behavior follows dealer parity

Use:
- default button label: **Submit**
- loading label: **Submitting...**

### 5) Typography should not block implementation

Use the site’s existing font stack if available.

If component-local fallback styling is needed:
- use Arial/system sans fallback
- do not block the build on custom Gotham/Oswald loading

## Front-End Structure

### Form Shell

Use the same general shell pattern as the dealer form:
- wrapper container
- bordered form card
- fieldset-based section grouping
- same responsive grid approach
- shared status line + submit button action row

### Core DOM Rules

Keep these top-level mechanics aligned with the dealer form:
- `<form id="warranty-form" novalidate>`
- shared status element `#form-status` with `aria-live="polite"`
- submit button `#submit-btn`
- spinner element inside the button
- same general helper-class patterns for invalid states and layout

### Hidden / System Inputs

The customer form must include:
- `claim_submitted_by`
- `category`
- `website`

Locked values:
- `claim_submitted_by = customer`
- `category = Warranty`
- `website = ""` by default and visually hidden as the honeypot

### Honeypot UI Rule

Keep the same dealer-form anti-spam pattern:
- visually hidden honeypot wrapper
- hidden offscreen, not removed from DOM
- include a visible-for-bots label of `Website`
- input name remains `website`

## Section Order

The implemented customer form must render sections in this exact order:

1. **Are You The Original Owner?**
2. **Warranty Registration Complete?**
3. **Original Selling Dealer**
4. **Customer Information**
5. **Warranty Claim Information**
6. **Actions / Status**

## Section Build Sheet

## 1) Are You The Original Owner?

### Section Type
- fieldset

### Legend
- `Are You The Original Owner?`

### Field
- name: `original_owner`
- control: radio group
- allowed values: `yes`, `no`
- required: yes

### UI Pattern
- use the same horizontal dealer-style radio-group pattern
- `Yes` and `No` inline on desktop
- wrap cleanly on narrow screens

### Conditional Logic
- none

### Invalid UX
- apply fieldset-level invalid styling when nothing is selected and validation reaches this section
- clear invalid state immediately when either radio is selected

## 2) Warranty Registration Complete?

### Section Type
- fieldset

### Legend
- `Warranty Registration Complete?`

### Field
- name: `warranty_registration_complete`
- control: radio group
- allowed values: `yes`, `no`
- required: yes

### UI Pattern
- same horizontal dealer-style radio-group pattern

### Conditional Logic
- none

### Invalid UX
- apply fieldset-level invalid styling when nothing is selected and validation reaches this section
- clear invalid state immediately when either radio is selected

## 3) Original Selling Dealer

### Section Type
- fieldset

### Legend
- `Original Selling Dealer`

### Field Order and Build Rules

1. `dealer_name`
   - label: `Dealership`
   - control: text input
   - required: yes
   - layout: full-width row

2. `dealer_address`
   - label: `Address`
   - control: text input
   - required: yes
   - layout: full-width row

3. `dealer_city`
   - label: `City`
   - control: text input
   - required: yes
   - layout: left column

4. `dealer_region`
   - label: `State/Province/Region`
   - control: text input
   - required: yes
   - layout: right column

5. `dealer_postal_code`
   - label: `Zip/Postal Code`
   - control: text input
   - required: yes
   - layout: left column
   - no numeric-only mask
   - no country-specific formatting logic

6. `dealer_country`
   - label: `Country/Region`
   - control: text input
   - required: yes
   - layout: right column
   - blank by default

7. `dealer_phone`
   - label: `Phone`
   - control: `type="tel"`
   - required: yes
   - layout: left column
   - no strict phone mask
   - treat as a required string

8. `dealer_email`
   - label: `Email`
   - control: `type="email"`
   - required: yes
   - layout: right column
   - same basic email validation pattern as dealer form

### Explicit Exclusions

Do **not** include:
- `dealer_first_name`
- `dealer_last_name`
- `dealer_contact_name`

## 4) Customer Information

### Section Type
- fieldset

### Legend
- `Customer Information`

### Field Order and Build Rules

1. `customer_first_name`
   - label: `First Name`
   - control: text input
   - required: yes
   - layout: left column

2. `customer_last_name`
   - label: `Last Name`
   - control: text input
   - required: yes
   - layout: right column

3. `customer_address`
   - label: `Address`
   - control: text input
   - required: yes
   - layout: full-width row

4. `customer_city`
   - label: `City`
   - control: text input
   - required: yes
   - layout: left column

5. `customer_region`
   - label: `State/Province/Region`
   - control: text input
   - required: yes
   - layout: right column

6. `customer_postal_code`
   - label: `Zip/Postal Code`
   - control: text input
   - required: yes
   - layout: left column
   - no numeric-only mask
   - no country-specific formatting logic

7. `customer_country`
   - label: `Country/Region`
   - control: text input
   - required: yes
   - layout: right column
   - blank by default

8. `customer_phone`
   - label: `Phone`
   - control: `type="tel"`
   - required: yes
   - layout: left column
   - no strict phone mask
   - treat as a required string

9. `customer_email`
   - label: `Email`
   - control: `type="email"`
   - required: yes
   - layout: right column
   - same basic email validation pattern as dealer form

## 5) Warranty Claim Information

### Section Type
- fieldset

### Legend
- `Warranty Claim Information`

### Field Order and Build Rules

1. `vin`
   - label: `Trailer VIN`
   - control: text input
   - required: yes
   - layout: row 1 left column
   - `maxlength="17"`
   - regex/pattern aligned to dealer VIN rule
   - trim and uppercase before validation and submission
   - `autocomplete="off"`
   - `spellcheck="false"`

2. `date_of_occurrence`
   - label: `Date of Occurrence`
   - control: `type="date"`
   - required: yes
   - layout: row 1 right column

3. `warranty_symptoms`
   - label: `Warranty Symptoms`
   - control: textarea
   - required: yes
   - layout: row 2 left column
   - use the same general textarea sizing as dealer form

4. `warranty_request`
   - label: `Warranty Request`
   - control: textarea
   - required: yes
   - layout: row 2 right column
   - use the same general textarea sizing as dealer form

5. `attachments`
   - label: `File Upload`
   - control: multi-file input
   - required: yes
   - layout: full-width row below the two textareas
   - keep `multiple`
   - no new file-type `accept` restriction in this milestone

### Attachment Helper Text

Render helper text directly below the file input:
- `Up to 10 files. Max 10MB each.`

### Explicit Exclusions

Do **not** include:
- `labor_hours`
- `ship_to`
- `labor_rate`

## Layout Specification

### Shared Layout Pattern

Use the existing dealer-form CSS/grid model as the base.

### Desktop Layout

#### Top yes/no sections
- one fieldset each
- radios inline horizontally

#### Original Selling Dealer
- two-column grid
- `dealer_name` full width
- `dealer_address` full width
- `dealer_city` + `dealer_region`
- `dealer_postal_code` + `dealer_country`
- `dealer_phone` + `dealer_email`

#### Customer Information
- two-column grid
- `customer_first_name` + `customer_last_name`
- `customer_address` full width
- `customer_city` + `customer_region`
- `customer_postal_code` + `customer_country`
- `customer_phone` + `customer_email`

#### Warranty Claim Information
- two-column claim grid
- row 1: `vin` + `date_of_occurrence`
- row 2: `warranty_symptoms` + `warranty_request`
- row 3: `attachments` full width

### Mobile Layout

At the same breakpoint pattern as the dealer form:
- collapse all two-column grids to one column
- keep section order unchanged
- keep the radio groups readable and tappable
- keep the action row usable without horizontal overflow

## Validation / JavaScript Build Rules

## Validation Model

Keep the same overall dealer-form validation philosophy:
- `novalidate`
- custom validation in JavaScript
- top-to-bottom validation order
- show only the first error message in the status area
- mark invalid fields/fieldsets visually
- backend remains final authority

## Validation Order

Validate in this exact order:

1. `original_owner` radio selection
2. `warranty_registration_complete` radio selection
3. Original Selling Dealer required fields
4. Customer Information required fields
5. Warranty Claim Information fields
   - validate VIN required/format before other claim fields
   - then validate `date_of_occurrence`
   - then `warranty_symptoms`
   - then `warranty_request`
6. attachments

## Requiredness Rules

All visible fields are required.

This includes:
- both top-level radio groups
- all Original Selling Dealer fields
- all Customer Information fields
- all Warranty Claim Information fields
- at least one attachment

## Field-Level Rules

### Email
Apply the current dealer-style basic email regex validation to:
- `dealer_email`
- `customer_email`

### VIN
Apply the current dealer VIN rule:
- uppercase before submit
- exactly 17 characters
- regex excludes `I`, `O`, `Q`

### Attachments
Apply the same current dealer constraints:
- minimum 1 file required
- maximum 10 files
- maximum 10 MB per file

### No Conditional Section Logic
The customer form has **no** sold-unit logic.

Do **not** implement:
- `is_sold_unit`
- hidden customer section behavior
- input disabling tied to visibility
- conditional requiredness tied to any yes/no answer

## Invalid-State UX

### Input fields
- apply `.bm-invalid` to invalid inputs
- remove invalid outline as the user corrects the field
- wire this on `input`, `change`, and `blur`, consistent with dealer behavior

### Radio groups
Use fieldset-level invalid styling for:
- `original_owner`
- `warranty_registration_complete`

Suggested fieldset ids:
- `original-owner-fieldset`
- `registration-complete-fieldset`

Clear fieldset invalid styling immediately when a valid option is selected.

## Friendly Error Labels

Use a curated `FIELD_LABELS` map rather than raw ids for user-facing error text.

Because the customer form contains repeated generic labels across sections, the curated labels should be **section-aware** where that improves clarity.

Recommended `FIELD_LABELS` wording:
- `dealer_name` → `Dealership`
- `dealer_address` → `Original Selling Dealer Address`
- `dealer_city` → `Original Selling Dealer City`
- `dealer_region` → `Original Selling Dealer State/Province/Region`
- `dealer_postal_code` → `Original Selling Dealer Zip/Postal Code`
- `dealer_country` → `Original Selling Dealer Country/Region`
- `dealer_phone` → `Original Selling Dealer Phone`
- `dealer_email` → `Original Selling Dealer Email`
- `customer_first_name` → `Customer First Name`
- `customer_last_name` → `Customer Last Name`
- `customer_address` → `Customer Address`
- `customer_city` → `Customer City`
- `customer_region` → `Customer State/Province/Region`
- `customer_postal_code` → `Customer Zip/Postal Code`
- `customer_country` → `Customer Country/Region`
- `customer_phone` → `Customer Phone`
- `customer_email` → `Customer Email`
- `vin` → `Trailer VIN`
- `date_of_occurrence` → `Date of Occurrence`
- `warranty_symptoms` → `Warranty Symptoms`
- `warranty_request` → `Warranty Request`
- `attachments` → `File Upload`

## Standard Message Text

Use dealer-parity message mechanics with the following text rules.

### Required field helper
- `{label} is required.`

### Invalid email
- `Email must be a valid email address.`

### Invalid VIN
- `Trailer VIN must be 17 characters (no I, O, Q).`

### Missing original owner answer
- `Please select "Yes" or "No" for "Are You The Original Owner?"`

### Missing registration answer
- `Please select "Yes" or "No" for "Warranty Registration Complete?"`

### Attachment errors
- `At least one attachment is required.`
- `Too many attachments. Maximum is 10 files per submission.`
- `Attachment "<filename>" is too large. Maximum size is 10MB per file.`

## Submit / Fetch Behavior

## Transport

Keep the same submission transport as dealer form:
- `FormData`
- `fetch(...)`
- `POST`
- same Worker endpoint pattern

## Endpoint Constant

Keep the same config pattern as dealer form:
- one `WARRANTY_ENDPOINT` constant near the top of the script

The actual environment URL may vary by local/staging/prod context, but the customer form should follow the same endpoint-management pattern as the dealer form.

## Success Condition

Treat submission as successful only when:
- the HTTP response is OK
- the response parses as JSON
- `data.ok === true`

## Response Handling

Keep the same front-end handling model as dealer form:
- if non-OK HTTP or invalid payload, treat as failure
- use Worker-provided `message` or joined `errors[]` when present
- otherwise show a generic HTTP-status-based failure message

## Network Failure Handling

Use the same dealer-style network failure message:
- `Network error while submitting. Please try again.`

## Submit Button Loading State

Keep dealer-form behavior:
- disable button while submitting
- add loading class
- show spinner
- set `aria-busy="true"` on the form while request is in flight
- restore button state in `finally`

## Success UX

On success:
- set status message using the same success-message pattern as dealer form
- include the claim number
- reset the form
- restore hidden/system default values
- clear any radio-fieldset invalid styling
- clear any remaining invalid input styling

### Success Message Text
- `Claim #<claimNumber> submitted successfully.`

## Reset Rules After Success

After `form.reset()`:
- reassign `claim_submitted_by = customer`
- reassign `category = Warranty`
- leave the honeypot empty
- ensure both radio-group fieldsets have no invalid styling
- no conditional section hide/show reset is needed because all sections remain visible in the customer form

## Accessibility / UX Rules

The customer form should preserve the dealer form’s general usability posture while aligning to the provided design.

Minimum implementation rules:
- keep semantic fieldsets/legends
- maintain label → input `for` / `id` wiring
- preserve `aria-live="polite"` on the status region
- preserve visible focus treatment
- keep radio options easy to tap on mobile
- keep error state visible without relying on color alone where practical
- avoid introducing custom widgets that reduce native accessibility for radios/date/file inputs

## Styling Direction

### Base Styling

Use the current dealer form styling as the implementation base:
- same border radius family
- same fieldset/input sizing family
- same invalid/success/error mechanics
- same responsive breakpoint family

### Boatmate Brand Direction

Where local styling choices are needed for the customer form:
- primary action/button color preference: `#071C3C`
- primary action text: `#FFFFFF`
- neutral border family may follow the provided style sheet / current dealer-form palette

Do not expand this milestone into a full brand-token refactor.

## Explicit Non-Requirements

This build spec does **not** require:
- introducing UTM/source hidden fields yet
- implementing a new client-side file-type allowlist
- changing Worker response schema
- changing Worker false-success behavior
- adding inline per-field error text under every field
- combining dealer and customer into one universal browser form
- adding autocomplete taxonomies, address APIs, or country/state dropdown logic

## Deferred Follow-Up Notes

The following remain deferred and should not silently expand this build:
- UTM/source capture
- broader Worker hardening
- response-truthfulness redesign
- any new file-type policy
- deeper brand-system implementation

## Acceptance Snapshot

This build spec should be considered satisfied when the implemented customer form:
- posts `multipart/form-data` to the same Worker endpoint pattern
- submits `claim_submitted_by=customer`, `category=Warranty`, and `website`
- renders the exact locked section order
- uses the exact locked payload field names
- excludes `is_sold_unit`, `dealer_first_name`, `dealer_last_name`, `dealer_contact_name`, `labor_hours`, `ship_to`, and `labor_rate`
- applies the locked validation order and requiredness rules
- keeps VIN/email/attachment rules aligned to the dealer baseline
- uses the same success condition and same success-message pattern as dealer flow
- preserves dealer-style status/spinner/reset behavior
- does not introduce new conditional UI logic

