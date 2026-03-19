# Customer Warranty Intake — Front-End Patch Plan

## Document Purpose

This document is a thin implementation patch plan for the **customer front-end form only**.

It translates the locked build spec into a surgical patch sequence against the current dealer-form baseline so implementation can proceed with minimal ambiguity and minimal drift.

This is **not** the Worker patch plan.

## Governing Inputs

This patch plan is based on:
- `5-customer_warranty_intake_form_build_spec.md` (current authoritative build spec)
- `dealer_warranty_form.html` (current front-end baseline)
- `3-customer_warranty_intake-intended_submission_contract.md`
- `4-customer_warranty_intake_worker_branching_update_spec.md`

If this patch plan conflicts with the current build spec, the build spec wins.

## Scope

This patch plan covers:
- customer-form HTML structure
- customer-form CSS/layout reuse
- customer-form JavaScript validation/submission behavior
- reset/status/spinner behavior
- front-end-only acceptance checks

This patch plan does **not** cover:
- Worker code changes
- HubSpot mapping behavior
- UTM/source capture
- response-schema redesign
- broader design-system refactoring

## Implementation Strategy

### Build Shape

Implement the customer form as a **separate dedicated front-end artifact/page** parallel to the dealer form.

Recommended implementation approach:
- use `dealer_warranty_form.html` as the source baseline
- fork it into a dedicated customer form artifact
- preserve the same shell/CSS/JS architecture where practical
- remove dealer-only and sold-unit-specific behavior
- add the customer-specific sections and validation flow from the current build spec

### Target Outcome

The customer form should behave like the dealer form’s sibling:
- same overall wrapper/card/fieldset structure
- same responsive grid philosophy
- same submit button + spinner pattern
- same status handling pattern
- same `FormData` + `fetch` submission model
- same reset philosophy
- customer-specific field inventory and validation only

## Patch Target

### Source Baseline
- `dealer_warranty_form.html`

### Recommended New Artifact
- create a separate customer form file/page
- recommended working filename: `customer_warranty_form.html`

This milestone should **not** convert the dealer form into a shared dual-mode form.

## Patch Sequence

## Patch Group 1 — Clone and Re-scope the Artifact

### Objective
Create a dedicated customer-form artifact from the dealer baseline without mutating dealer behavior.

### Actions
- duplicate `dealer_warranty_form.html` into a separate customer-form artifact
- update file header comments so the artifact clearly states:
  - customer-only flow
  - current status
  - current purpose
  - hard business rules for customer submission
- replace dealer-only narrative/comments that describe sold-unit logic, conditional customer section behavior, or labor-hours collection

### Result
A customer-specific front-end file exists with the dealer file preserved intact.

## Patch Group 2 — Update Top-Level Metadata and Hidden Inputs

### Objective
Re-scope the artifact from dealer submission to customer submission.

### Actions
- keep `<form id="warranty-form" novalidate>`
- preserve the same `#form-status` region and `#submit-btn` pattern
- preserve the honeypot wrapper and `website` input
- change hidden input `claim_submitted_by` value from `dealer` to `customer`
- keep hidden input `category` value as `Warranty`
- keep honeypot label text `Website`

### Result
The customer form posts the correct fixed front-end system values:
- `claim_submitted_by=customer`
- `category=Warranty`
- `website=""`

## Patch Group 3 — Replace Section Order

### Objective
Bring the rendered section order into alignment with the locked customer build spec.

### Required Render Order
1. `Are You The Original Owner?`
2. `Warranty Registration Complete?`
3. `Original Selling Dealer`
4. `Customer Information`
5. `Warranty Claim Information`
6. `Actions / Status`

### Actions
- remove the dealer-only `Dealer Information` section in its current form
- remove the `Is this a sold unit?` section entirely
- remove the conditional dealer-style `Customer Information` section in its current name-only form
- insert the two required top-level radio fieldsets
- insert the new full `Original Selling Dealer` section
- insert the new full `Customer Information` section
- rebuild the claim section without labor-hours

## Patch Group 4 — Add Top-Level Radio Fieldsets

### Objective
Add the two required customer-specific yes/no questions.

### Section A
**Legend:** `Are You The Original Owner?`

**Field**
- `name="original_owner"`
- radios with values `yes` and `no`
- required

**Recommended DOM id pattern**
- fieldset id: `original-owner-fieldset`
- yes radio id: `original_owner_yes`
- no radio id: `original_owner_no`

### Section B
**Legend:** `Warranty Registration Complete?`

**Field**
- `name="warranty_registration_complete"`
- radios with values `yes` and `no`
- required

**Recommended DOM id pattern**
- fieldset id: `registration-complete-fieldset`
- yes radio id: `warranty_registration_complete_yes`
- no radio id: `warranty_registration_complete_no`

### UI Rules
- use the same dealer-style `.radio-group` / `.radio-option` pattern
- radios inline on desktop
- wrap cleanly on narrow screens
- apply fieldset-level invalid styling when unanswered
- clear invalid styling immediately on valid selection

## Patch Group 5 — Replace Dealer Information with Original Selling Dealer

### Objective
Replace the current dealer-contact section with the customer-contract dealer section.

### Remove From Dealer Baseline
- `dealer_first_name`
- `dealer_last_name`
- any dealer-contact-name concept

### Build This Exact Field Set
Row 1:
- `dealer_name` — label `Dealership` — full width

Row 2:
- `dealer_address` — label `Address` — full width

Row 3:
- `dealer_city` — label `City` — left column
- `dealer_region` — label `State/Province/Region` — right column

Row 4:
- `dealer_postal_code` — label `Zip/Postal Code` — left column
- `dealer_country` — label `Country/Region` — right column

Row 5:
- `dealer_phone` — label `Phone` — left column
- `dealer_email` — label `Email` — right column

### Layout Rule
Use the existing two-column dealer grid pattern:
- `.field-grid.field-grid--two`
- `.field-wide` for full-width rows

## Patch Group 6 — Replace Customer Information Section

### Objective
Replace the dealer’s conditional name-only customer section with the full required customer section.

### Remove From Dealer Baseline
- conditional hide/show logic
- `is-hidden` default state for customer section
- disabling/enabling customer inputs based on sold-unit answer
- name-only customer section structure

### Build This Exact Field Set
Row 1:
- `customer_first_name` — label `First Name` — left column
- `customer_last_name` — label `Last Name` — right column

Row 2:
- `customer_address` — label `Address` — full width

Row 3:
- `customer_city` — label `City` — left column
- `customer_region` — label `State/Province/Region` — right column

Row 4:
- `customer_postal_code` — label `Zip/Postal Code` — left column
- `customer_country` — label `Country/Region` — right column

Row 5:
- `customer_phone` — label `Phone` — left column
- `customer_email` — label `Email` — right column

### Layout Rule
Use the existing two-column dealer grid pattern:
- `.field-grid.field-grid--two`
- `.field-wide` for full-width rows

## Patch Group 7 — Rebuild Warranty Claim Information

### Objective
Align the claim section to the customer build spec while preserving dealer-style claim-grid behavior.

### Keep
- `vin`
- `date_of_occurrence`
- `warranty_symptoms`
- `warranty_request`
- `attachments`

### Remove
- `labor_hours`
- any labor-hours helper text, validation, or payload dependence

### Required Claim Layout
Row 1:
- `vin` — label `Trailer VIN` — left column
- `date_of_occurrence` — label `Date of Occurrence` — right column

Row 2:
- `warranty_symptoms` — label `Warranty Symptoms` — left column
- `warranty_request` — label `Warranty Request` — right column

Row 3:
- `attachments` — label `File Upload` — full width
- helper text: `Up to 10 files. Max 10MB each.`

### Control Rules
- `vin` remains text input with dealer-style VIN attributes/pattern
- `date_of_occurrence` remains `type="date"`
- textareas remain similar in size to dealer form
- file input remains `multiple`
- do **not** introduce a new `accept` attribute in this milestone

## Patch Group 8 — Preserve CSS and Adjust Only What Is Necessary

### Objective
Reuse the dealer form’s CSS model without broad restyling.

### Keep As-Is Where Possible
- root token structure
- wrapper max-width pattern
- bordered form card
- fieldset styling
- `.field`
- `.field-grid`
- `.field-grid--two`
- `.field-wide`
- `.claim-grid`
- `.radio-group`
- `.radio-option`
- `.bm-invalid`
- `.bm-actions`
- `.bm-spinner`
- honeypot `.hp`
- mobile breakpoint behavior

### Allowed CSS Adjustments
- button text label updates
- button color updates if needed to align with build-spec brand direction
- any small spacing tweaks required by the extra top radio fieldsets or full-width attachments row

### Do Not Expand Into
- a sitewide token refactor
- custom date picker UI
- custom file upload widget
- new conditional-layout architecture

## Patch Group 9 — Rewrite JavaScript Required-ID Arrays and Validation Flow

### Objective
Replace dealer-only validation/data assumptions with the locked customer validation order.

### Remove Dealer-Specific JS Concepts
- `DEALER_REQUIRED_IDS` as currently defined
- `CONDITIONAL_CUSTOMER_IDS`
- `SOLD_UNIT_NAME`
- sold-unit fieldset references
- `getSoldUnitValue()`
- `setCustomerSectionVisible()`
- `markSoldUnitInvalid()` / `clearSoldUnitInvalid()` for sold-unit
- any submit-time dependency on `is_sold_unit`
- any requiredness toggling tied to section visibility

### Replace With Customer Validation Groups
Recommended grouping:
- `ORIGINAL_OWNER_NAME = "original_owner"`
- `REGISTRATION_NAME = "warranty_registration_complete"`
- `DEALER_REQUIRED_IDS = [dealer_name, dealer_address, dealer_city, dealer_region, dealer_postal_code, dealer_country, dealer_phone, dealer_email]`
- `CUSTOMER_REQUIRED_IDS = [customer_first_name, customer_last_name, customer_address, customer_city, customer_region, customer_postal_code, customer_country, customer_phone, customer_email]`
- `CLAIM_REQUIRED_IDS = [vin, date_of_occurrence, warranty_symptoms, warranty_request]`

### New Validation Order
1. validate `original_owner` radio selection
2. validate `warranty_registration_complete` radio selection
3. validate Original Selling Dealer required fields
4. validate Customer Information required fields
5. validate Warranty Claim Information
   - VIN required/format first
   - then `date_of_occurrence`
   - then `warranty_symptoms`
   - then `warranty_request`
6. validate attachments last

### Requiredness Rule
All visible fields are required all the time.

There is no conditional section behavior in the customer form.

## Patch Group 10 — Update Friendly Labels and Message Text

### Objective
Keep dealer-style friendly messaging while adapting labels to the customer form.

### Actions
- replace the current `FIELD_LABELS` object with the customer-form version from the current build spec
- remove labels for deleted fields such as:
  - `dealer_first_name`
  - `dealer_last_name`
  - `labor_hours`
- add labels for new fields such as:
  - `dealer_postal_code`
  - `dealer_country`
  - `customer_address`
  - `customer_city`
  - `customer_region`
  - `customer_postal_code`
  - `customer_country`
  - `customer_phone`
  - `customer_email`
  - `original_owner`
  - `warranty_registration_complete` as needed for message helpers

### Required Message Rules
Use the current build-spec message set:
- `{label} is required.`
- `Email must be a valid email address.`
- `Trailer VIN must be 17 characters (no I, O, Q).`
- `Please select "Yes" or "No" for "Are You The Original Owner?"`
- `Please select "Yes" or "No" for "Warranty Registration Complete?"`
- `At least one attachment is required.`
- `Too many attachments. Maximum is 10 files per submission.`
- `Attachment "<filename>" is too large. Maximum size is 10MB per file.`

## Patch Group 11 — Preserve Submit Transport and Success Handling

### Objective
Keep the dealer transport/success mechanics, but re-scope reset behavior to customer defaults.

### Keep
- `WARRANTY_ENDPOINT` constant pattern
- `FormData(form)` submission
- `fetch(..., { method: "POST", body: formData })`
- success condition: HTTP OK + JSON + `data.ok === true`
- network failure message
- button disabling/spinner handling
- `aria-busy` behavior
- first-error-only status behavior

### Update
- button default label to `Submit`
- loading label to `Submitting...`
- success status text remains `Claim #<claimNumber> submitted successfully.`
- after `form.reset()`:
  - restore `claim_submitted_by = customer`
  - restore `category = Warranty`
  - leave honeypot empty
  - clear invalid styling on all inputs
  - clear invalid styling on both radio fieldsets
- remove any reset logic related to sold-unit/customer-section visibility

## Patch Group 12 — Front-End Acceptance Check Before Worker Work

### Objective
Verify that the browser-side artifact is correct before backend changes are layered in.

### Static Acceptance Checks
- no `is_sold_unit` field exists in markup or JS
- no `dealer_first_name` or `dealer_last_name` field exists in markup or JS
- no `labor_hours` field exists in markup or JS
- customer form includes hidden `claim_submitted_by=customer`
- customer form includes hidden `category=Warranty`
- customer form includes honeypot `website`
- section order matches the build spec exactly
- all row-explicit layout expectations are reflected in DOM order and grid usage

### Behavior Acceptance Checks
- unanswered `original_owner` shows the correct fieldset-level error/state
- unanswered `warranty_registration_complete` shows the correct fieldset-level error/state
- missing dealer/customer required fields show dealer-style invalid outlines
- invalid dealer/customer emails show the correct invalid-email message
- invalid VIN shows the correct VIN message
- missing attachments show the correct attachment-required message
- too many files shows the correct max-file-count message
- oversize file shows the correct per-file-size message
- submit button disables and spinner appears during submit
- success path resets the form and restores hidden values correctly

## Out of Scope / Do Not Patch Here

Do **not** use this front-end patch plan to introduce:
- Worker branching logic
- HubSpot routing logic
- UTM/source hidden fields
- new file-type restrictions
- response-truthfulness redesign
- inline field-by-field error-message UI
- a merged dealer/customer universal form

## Handoff Note

After this front-end patch plan is accepted, the next coordinated artifact should be the **Worker Patch Plan**, which will implement the backend/customer-branch changes required by the locked Worker branching spec.
