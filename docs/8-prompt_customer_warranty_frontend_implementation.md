# Customer Warranty Intake Form — Front-End Implementation Prompt

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

## Role

You are a deterministic front-end patch implementer for Boatmate’s Customer Warranty Intake form.

Your job is to create the dedicated customer form artifact/page in a controlled, minimal-drift way using only the supplied governing artifacts.

You are not acting as:
- a product designer
- an architect reopening requirements
- a UX strategist changing layout intent
- a refactor bot doing opportunistic cleanup
- a backend/Worker implementer
- a full-stack redesign agent

Your job is to implement the locked front-end changes exactly as specified.

Use only the supplied artifacts.
Do not infer missing requirements from memory, prior chats, or unstated project conventions.
If a needed source artifact is missing, stop and request it.

## Required Input

Before you begin, confirm you have these 3 inputs:

1. `5-customer_warranty_intake_form_build_spec.md`
   - current authoritative FE build spec
   - governs field inventory, layout, labels, validation behavior, submit/reset behavior, and FE scope

2. `6-customer_warranty_intake_frontend_patch_plan_v1.0.md`
   - current FE patch sequence
   - governs the recommended clone/fork approach, patch order, and FE acceptance checks

3. `dealer_warranty_form.html`
   - current dealer-form source baseline
   - use this as the implementation starting point for a dedicated customer sibling form

If any of these 3 inputs are missing, stop and request them before coding.

Request message if missing:

> Please provide the current FE build spec, the FE patch plan, and the current `dealer_warranty_form.html` baseline before implementation. I should not infer or reconstruct missing source artifacts.

If all 3 inputs are present:

- follow them in this precedence order:
  1. `5-customer_warranty_intake_form_build_spec.md`
  2. `6-customer_warranty_intake_frontend_patch_plan_v1.0.md`
  3. `dealer_warranty_form.html`
- if there is any conflict, the current build spec wins
- do not invent behavior outside these artifacts

Attach these 3 files if they are not already present in the coding context:

- `5-customer_warranty_intake_form_build_spec.md`
- `6-customer_warranty_intake_frontend_patch_plan_v1.0.md`
- `dealer_warranty_form.html`

## Implementation Prompt

You are implementing the **FRONT-END ONLY** for Boatmate’s Customer Warranty Intake form.

Read and follow these attached artifacts in this precedence order:

1. `5-customer_warranty_intake_form_build_spec.md`
2. `6-customer_warranty_intake_frontend_patch_plan_v1.0.md`
3. `dealer_warranty_form.html`

If there is any conflict, the current build spec wins.
Do not invent behavior outside these artifacts.

### Objective

Create a separate dedicated customer form artifact/page from the current dealer baseline.
Recommended target filename: `customer_warranty_form.html`

### Critical Scope Rules

- FRONT-END ONLY.
- Do not modify Worker/backend logic.
- Do not add UTM/source capture.
- Do not redesign the response schema.
- Do not add a new file-type accept allowlist.
- Do not create a merged dealer/customer universal form.
- Do not mutate `dealer_warranty_form.html` unless absolutely necessary; preserve it as the baseline source file.

### Implementation Strategy

- Start from `dealer_warranty_form.html` as the source baseline.
- Fork it into a dedicated customer form file.
- Preserve the same general shell/CSS/JS architecture where practical.
- Preserve the same wrapper/card/fieldset structure, responsive grid philosophy, submit button + spinner pattern, status handling pattern, `FormData` + `fetch` model, and reset philosophy.
- Remove dealer-only and sold-unit-specific behavior.
- Add the customer-specific sections, fields, and validation flow from the current build spec.

### Top-Level DOM / System Rules

- Keep: `<form id="warranty-form" novalidate>`
- Keep the same `#form-status` region with `aria-live="polite"`
- Keep the same `#submit-btn` pattern and spinner pattern
- Keep the visually hidden honeypot wrapper and input
- Hidden inputs must be:
  - `claim_submitted_by = customer`
  - `category = Warranty`
  - `website = ""` by default
- Keep the honeypot label text exactly: `Website`

### Section Order

Render sections in this exact order:

1. Are You The Original Owner?
2. Warranty Registration Complete?
3. Original Selling Dealer
4. Customer Information
5. Warranty Claim Information
6. Actions / Status

## Section Details

### 1) Are You The Original Owner?

- Fieldset legend: `Are You The Original Owner?`
- Radio name: `original_owner`
- Values: `yes` / `no`
- Required: yes
- Recommended ids:
  - `original-owner-fieldset`
  - `original_owner_yes`
  - `original_owner_no`
- Use the same horizontal dealer-style radio-group pattern
- Apply fieldset-level invalid styling when unanswered
- Clear invalid styling immediately when either radio is selected

### 2) Warranty Registration Complete?

- Fieldset legend: `Warranty Registration Complete?`
- Radio name: `warranty_registration_complete`
- Values: `yes` / `no`
- Required: yes
- Recommended ids:
  - `registration-complete-fieldset`
  - `warranty_registration_complete_yes`
  - `warranty_registration_complete_no`
- Same radio UX/validation behavior as above

### 3) Original Selling Dealer

Fieldset legend: `Original Selling Dealer`
Build this exact field set with row-explicit layout:

**Row 1 full width**
- `dealer_name`
  - label: `Dealership`
  - type: text
  - required

**Row 2 full width**
- `dealer_address`
  - label: `Address`
  - type: text
  - required

**Row 3**
- `dealer_city`
  - label: `City`
  - type: text
  - required
  - left column
- `dealer_region`
  - label: `State/Province/Region`
  - type: text
  - required
  - right column

**Row 4**
- `dealer_postal_code`
  - label: `Zip/Postal Code`
  - type: text
  - required
  - left column
  - no numeric-only mask
  - no country-specific formatting logic
- `dealer_country`
  - label: `Country/Region`
  - type: text
  - required
  - right column
  - blank by default

**Row 5**
- `dealer_phone`
  - label: `Phone`
  - type: `tel`
  - required
  - left column
  - no strict phone mask
  - treat as a required string
- `dealer_email`
  - label: `Email`
  - type: `email`
  - required
  - right column
  - same basic email validation pattern as dealer form

#### Explicit Exclusions

Do not include:

- `dealer_first_name`
- `dealer_last_name`
- `dealer_contact_name`

### 4) Customer Information

Fieldset legend: `Customer Information`
Build this exact field set with row-explicit layout:

**Row 1**
- `customer_first_name`
  - label: `First Name`
  - type: text
  - required
  - left column
- `customer_last_name`
  - label: `Last Name`
  - type: text
  - required
  - right column

**Row 2 full width**
- `customer_address`
  - label: `Address`
  - type: text
  - required

**Row 3**
- `customer_city`
  - label: `City`
  - type: text
  - required
  - left column
- `customer_region`
  - label: `State/Province/Region`
  - type: text
  - required
  - right column

**Row 4**
- `customer_postal_code`
  - label: `Zip/Postal Code`
  - type: text
  - required
  - left column
  - no numeric-only mask
  - no country-specific formatting logic
- `customer_country`
  - label: `Country/Region`
  - type: text
  - required
  - right column
  - blank by default

**Row 5**
- `customer_phone`
  - label: `Phone`
  - type: `tel`
  - required
  - left column
  - no strict phone mask
  - treat as a required string
- `customer_email`
  - label: `Email`
  - type: `email`
  - required
  - right column
  - same basic email validation pattern as dealer form

#### Remove From Dealer Baseline

- conditional hide/show logic for customer info
- `is-hidden` default state for customer section
- disabling/enabling customer inputs based on sold-unit answer
- the old name-only customer section structure

### 5) Warranty Claim Information

Fieldset legend: `Warranty Claim Information`

**Row 1**
- `vin`
  - label: `Trailer VIN`
  - type: text
  - required
  - left column
  - `maxlength="17"`
  - keep dealer-style VIN pattern/rule
  - trim and uppercase before validation and submission
  - `autocomplete="off"`
  - `spellcheck="false"`
- `date_of_occurrence`
  - label: `Date of Occurrence`
  - type: date
  - required
  - right column
  - keep native browser date input
  - do not replace with custom masked input

**Row 2**
- `warranty_symptoms`
  - label: `Warranty Symptoms`
  - textarea
  - required
  - left column
  - same general textarea sizing as dealer form
- `warranty_request`
  - label: `Warranty Request`
  - textarea
  - required
  - right column
  - same general textarea sizing as dealer form

**Row 3 full width**
- `attachments`
  - label: `File Upload`
  - multi-file input
  - required
  - keep `multiple`
  - do not introduce a new `accept` attribute in this milestone
- helper text directly below the file input:
  - `Up to 10 files. Max 10MB each.`

#### Remove From Dealer Claim Section

- `labor_hours`
- any labor-hours helper text
- any labor-hours validation
- any labor-hours submission dependency

### CSS / Layout Rules

- Reuse the dealer form’s CSS model without broad restyling.
- Keep where possible:
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
  - `.hp`
  - mobile breakpoint behavior
- Only make small CSS adjustments if required by the two top radio fieldsets or the full-width attachments row.
- Do not expand this into a broad redesign or sitewide design-system refactor.

### Validation / JS Rules

- Keep `novalidate` and the dealer-style JS validation model.
- Validate top-to-bottom in the new customer form order.
- Preserve first-error-only status behavior.
- Preserve dealer-style invalid outlines on inputs.
- Use fieldset-level invalid styling for the two required radio groups when unanswered.
- Keep the same basic email validation pattern as the dealer form.
- Keep the dealer-style VIN validation rule.
- Keep attachment validation aligned to the existing dealer constraints:
  - at least 1 attachment required
  - maximum 10 files
  - maximum 10MB each
- Clear invalid styling immediately on correction where the dealer form already does so.
- Implement curated `FIELD_LABELS` per the current accepted build spec for user-friendly validation/error wording; do not improvise a new messaging system.

### Submit / Success / Reset Rules

- Keep the current `WARRANTY_ENDPOINT` constant pattern.
- Keep `FormData(form)` submission.
- Keep `fetch(..., { method: "POST", body: formData })`.
- Keep success condition: HTTP OK + JSON + `data.ok === true`
- Keep network failure handling pattern.
- Keep button disabling / spinner handling / `aria-busy` behavior.
- Button label rules:
  - default label: `Submit`
  - loading label: `Submitting...`
- Success status text:
  - `Claim #<claimNumber> submitted successfully.`
- After `form.reset()`:
  - restore `claim_submitted_by = customer`
  - restore `category = Warranty`
  - leave honeypot empty
  - clear invalid styling on all inputs
  - clear invalid styling on both radio fieldsets
- Do not include any reset logic related to sold-unit visibility

### Dealer-Preservation Rules

- Do not alter `dealer_warranty_form.html` behavior as part of this implementation.
- This milestone must produce a dedicated customer sibling form, not a shared hybrid.

### Deliverables

1. Create `customer_warranty_form.html`
2. Implement the full HTML/CSS/JS needed inside that file, using the dealer form as the baseline pattern
3. Keep the file implementation-ready, not pseudo-code
4. At the end, provide:
   - a short summary of what was changed
   - any assumptions made
   - a brief self-check against the acceptance checklist below

## Acceptance Checklist

### Static Checks

- no `is_sold_unit` field exists in markup or JS
- no `dealer_first_name` or `dealer_last_name` exists in markup or JS
- no `labor_hours` field exists in markup or JS
- hidden `claim_submitted_by=customer` exists
- hidden `category=Warranty` exists
- honeypot `website` exists
- section order matches the build spec exactly
- DOM/grid layout reflects the row-explicit layout rules

### Behavior Checks

- unanswered `original_owner` shows the correct fieldset-level invalid state
- unanswered `warranty_registration_complete` shows the correct fieldset-level invalid state
- missing required dealer/customer fields show dealer-style invalid outlines
- invalid dealer/customer emails show the correct invalid-email behavior
- invalid VIN shows the correct VIN behavior
- missing attachments show the correct attachment-required behavior
- too many files shows the correct max-file-count behavior
- oversize file shows the correct per-file-size behavior
- submit button disables and spinner appears during submit
- success path resets the form and restores hidden values correctly

## Important

- Do not improve deferred areas.
- Do not add UTM/source fields.
- Do not redesign the backend contract.
- Do not introduce a file-type `accept` restriction.
- Do not create a universal multi-mode form.
- Follow the attached artifacts exactly and keep drift to zero.
