# Customer Warranty Intake — Intended Submission Contract

## Document Purpose

This document defines the intended browser-to-Worker submission contract for the Customer Warranty Intake flow.

It is a contract artifact derived from the approved customer-flow decisions and is intended to lock:
- exact field names
- hidden/system fields
- requiredness
- section order
- field order
- control types
- validation behavior
- submission behavior
- Worker-facing content/output expectations that directly depend on the contract

This document is intended to make the Customer Warranty Intake form build deterministic and to provide the baseline for the future Worker customer-branch update.

## Baseline and Scope

This contract is future-state for the Customer Warranty Intake flow.

It is intentionally aligned as closely as possible to the existing Dealer Warranty Intake implementation where reuse reduces drift.

This document defines the customer-flow contract only. It does not redefine the existing dealer form contract.

## Contract Summary

The Customer Warranty Intake form will:
- submit as `multipart/form-data`
- post to the same Worker endpoint pattern as the dealer form
- expect JSON in response
- treat success only when the HTTP response is OK and `data.ok === true`
- use the same general form mechanics as the dealer form wherever applicable
- use `claim_submitted_by=customer`
- use `category=Warranty`
- use `website` as the honeypot field
- require all visible form fields
- require at least 1 attachment, with a maximum of 10 files and 10 MB per file

## Hidden / System Fields

The customer form will submit these hidden/system fields:
- `claim_submitted_by`
- `category`
- `website`

Locked values:
- `claim_submitted_by = customer`
- `category = Warranty`
- `website = ""` by default and treated as the honeypot field

## Section Order

The customer form section order is locked as:

1. **Are You The Original Owner?**
2. **Warranty Registration Complete?**
3. **Original Selling Dealer**
4. **Customer Information**
5. **Warranty Claim Information**

## Top-Level Question Fields

### 1) Are You The Original Owner?

- Label: **Are You The Original Owner?**
- Field name: `original_owner`
- Control type: radio group
- Allowed values: `yes`, `no`
- Required: yes
- Conditional behavior: none

### 2) Warranty Registration Complete?

- Label: **Warranty Registration Complete?**
- Field name: `warranty_registration_complete`
- Control type: radio group
- Allowed values: `yes`, `no`
- Required: yes
- Conditional behavior: none

These two fields are required captured values only.

They do not:
- show/hide any other fields
- change validation rules for other fields
- change submit behavior

## Original Selling Dealer Section

### Section Label

**Original Selling Dealer**

### Field Naming Rule

This section reuses the existing `dealer_*` field namespace to minimize drift.

Important contract rule:
- these fields retain `dealer_*` payload names
- in customer-flow human-readable content, these values must be labeled as **Original Selling Dealer**, not dealer submitter information

### Field Order

The field order inside this section is locked as:

1. `dealer_name`
2. `dealer_address`
3. `dealer_city`
4. `dealer_region`
5. `dealer_postal_code`
6. `dealer_country`
7. `dealer_phone`
8. `dealer_email`

### Field Definitions

- `dealer_name`
  - Label: Dealership
  - Control type: text input
  - Required: yes

- `dealer_address`
  - Label: Address
  - Control type: text input
  - Required: yes
  - Address pattern: single address field only

- `dealer_city`
  - Label: City
  - Control type: text input
  - Required: yes

- `dealer_region`
  - Label: State / Region
  - Control type: text input
  - Required: yes

- `dealer_postal_code`
  - Label: Postal Code
  - Control type: text input
  - Required: yes
  - Formatting rule: no strict numeric-only mask and no country-specific formatting logic

- `dealer_country`
  - Label: Country
  - Control type: text input
  - Required: yes
  - Default value: none

- `dealer_phone`
  - Label: Phone
  - Control type: text input
  - Required: yes
  - Validation approach: plain text input, no strict formatting mask, treated as a required string

- `dealer_email`
  - Label: Email
  - Control type: email input
  - Required: yes
  - Validation approach: same basic front-end email-format validation pattern as dealer form

### Explicit Exclusions

The customer form does **not** collect:
- `dealer_first_name`
- `dealer_last_name`
- `dealer_contact_name`

Dealer contact name must not appear in the customer form, ticket description, or confirmation email.

## Customer Information Section

### Section Label

**Customer Information**

### Field Order

The field order inside this section is locked as:

1. `customer_first_name`
2. `customer_last_name`
3. `customer_address`
4. `customer_city`
5. `customer_region`
6. `customer_postal_code`
7. `customer_country`
8. `customer_phone`
9. `customer_email`

### Field Definitions

- `customer_first_name`
  - Label: First Name
  - Control type: text input
  - Required: yes

- `customer_last_name`
  - Label: Last Name
  - Control type: text input
  - Required: yes

- `customer_address`
  - Label: Address
  - Control type: text input
  - Required: yes
  - Address pattern: single address field only

- `customer_city`
  - Label: City
  - Control type: text input
  - Required: yes

- `customer_region`
  - Label: State / Region
  - Control type: text input
  - Required: yes

- `customer_postal_code`
  - Label: Postal Code
  - Control type: text input
  - Required: yes
  - Formatting rule: no strict numeric-only mask and no country-specific formatting logic

- `customer_country`
  - Label: Country
  - Control type: text input
  - Required: yes
  - Default value: none

- `customer_phone`
  - Label: Phone
  - Control type: text input
  - Required: yes
  - Validation approach: plain text input, no strict formatting mask, treated as a required string

- `customer_email`
  - Label: Email
  - Control type: email input
  - Required: yes
  - Validation approach: same basic front-end email-format validation pattern as dealer form

## Warranty Claim Information Section

### Section Label

**Warranty Claim Information**

### Field Order

The field order inside this section is locked as:

1. `vin`
2. `date_of_occurrence`
3. `warranty_symptoms`
4. `warranty_request`
5. `attachments`

### Field Definitions

- `vin`
  - Label: Trailer VIN
  - Control type: text input
  - Required: yes
  - Validation rule: same as dealer form
  - Front-end normalization: trimmed and uppercased before submit
  - Format rule: exactly 17 characters
  - Regex rule: same dealer-form regex excluding `I`, `O`, and `Q`

- `date_of_occurrence`
  - Label: Date of Occurrence
  - Control type: date input
  - Required: yes

- `warranty_symptoms`
  - Label: Warranty Symptoms
  - Control type: textarea
  - Required: yes

- `warranty_request`
  - Label: Warranty Request
  - Control type: textarea
  - Required: yes

- `attachments`
  - Label: File Upload
  - Control type: multi-file upload
  - Required: yes
  - Limits:
    - minimum 1 file
    - maximum 10 files
    - maximum 10 MB per file

### Explicit Exclusions

The customer form does **not** include:
- `labor_hours`

## Requiredness Policy

All visible form fields in the customer form are required.

This includes:
- `original_owner`
- `warranty_registration_complete`
- all Original Selling Dealer fields
- all Customer Information fields
- all Warranty Claim Information fields
- at least one attachment

## Validation Contract

### Front-End Validation

The customer form will use the same general validation model as the dealer form.

Locked validation behavior:
- custom validation with `novalidate`
- same general validation mechanics as dealer form
- all visible fields required
- same basic email-format validation approach for `dealer_email` and `customer_email`
- same VIN validation rule as dealer form
- same attachment count/size enforcement as dealer form

### Non-Conditional Rule

There is no sold-unit gating and no conditional show/hide logic in the customer flow.

The following fields do not trigger conditional behavior:
- `original_owner`
- `warranty_registration_complete`

## Submission Transport Contract

### Content Type

- `multipart/form-data`

### Endpoint Pattern

- same Worker endpoint pattern as the dealer form

### Response Expectation

- JSON response expected

### Browser Success Condition

The customer form treats submission as successful only when:
- the HTTP response is OK
- the response parses as JSON
- `data.ok === true`

## Client-Side UX Contract

The customer form will keep the same UX/message mechanics as the dealer form:
- custom validation with `novalidate`
- shared status area for messages
- submit button loading state/spinner
- reset the form after success
- restore hidden/system defaults after reset
- same error message behavior and same error presentation mechanics as dealer form
- same success message pattern as dealer form

The form layout/pattern may remain generally similar to the dealer form, adjusted only for the customer-specific fields.

## Worker-Facing Routing Contract

### Canonical Submitter Value

- `claim_submitted_by = customer`

### Canonical Contact Email

For the customer flow, the canonical submitter/contact email is:
- `customer_email`

## Worker Ticket Subject Contract

The customer-flow ticket subject will remain structurally similar to dealer flow, using the customer as the primary party:

`Warranty Claim #<claimNumber> - <customer name> - <trailerNumber>`

Where:
- `<customer name>` = customer first + last name
- `<trailerNumber>` = 10th VIN character + last 4 VIN characters

Example:
- `5A7BB2325TT005252` → `T5252`

## Worker Ticket Description / Content Contract

### Content Model

The customer-flow ticket description will use this exact structure:

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

### Display Rules

- Do not include dealer contact name
- Do not include Trailer # in the body
- Show Trailer # only in the ticket subject and the confirmation email Claim Summary
- Display `original_owner` and `warranty_registration_complete` as `Yes` / `No`
- Display dates in the ticket description as `YYYY-MM-DD`

## Confirmation Email Contract

### Recipient Policy

The customer-flow confirmation email is sent to:

- `customer_email` only

### Tone / Intent

The confirmation email should be customer-facing / retail-facing and follow this model:

- receipt confirmation only
- no implication of approval or denial
- instruct customer to reference claim number in future correspondence
- signed by Boatmate Warranty Team

### Required Structure

The confirmation email should mirror this structure:

- greeting/opening
- receipt confirmation paragraph
- review / no-approval disclaimer paragraph
- claim-number reference instruction
- signature block
- Claim Summary
- Customer Information
- Original Selling Dealer
- Warranty Claim Details
- Attached Files

### Content Rules

- do not include labor-hours content
- do not include dealer contact name
- label dealer section as **Original Selling Dealer**
- display `original_owner` and `warranty_registration_complete` as `Yes` / `No`
- display dates in the confirmation email as `MM-DD-YYYY`
- include Trailer # in Claim Summary using the same derivation rule as dealer flow

## Attachment Note Contract

For the customer Worker branch, the attachment note text will be:

`Warranty attachments uploaded via customer intake form for Claim #<claimNumber> (VIN <vin>).`

## Explicit Contract Exclusions

The customer contract does **not** include:

- `is_sold_unit`
- `labor_hours`
- `dealer_first_name`
- `dealer_last_name`
- `dealer_contact_name`
- sold-unit-based conditional logic
- any other field-triggered show/hide logic

## Summary of Locked Field Inventory

### Hidden / System

- `claim_submitted_by`
- `category`
- `website`

### Top-Level Required Radios

- `original_owner`
- `warranty_registration_complete`

### Original Selling Dealer

- `dealer_name`
- `dealer_address`
- `dealer_city`
- `dealer_region`
- `dealer_postal_code`
- `dealer_country`
- `dealer_phone`
- `dealer_email`

### Customer Information

- `customer_first_name`
- `customer_last_name`
- `customer_address`
- `customer_city`
- `customer_region`
- `customer_postal_code`
- `customer_country`
- `customer_phone`
- `customer_email`

### Warranty Claim Information

- `vin`
- `date_of_occurrence`
- `warranty_symptoms`
- `warranty_request`
- `attachments`

## Recommended Next Artifact

The next artifact should be:

**Customer Warranty Intake — Worker Branching Update Spec**

That document should translate this locked contract into explicit Worker implementation changes for:

- parsing
- validation
- canonical contact routing
- ticket subject/content generation
- confirmation email generation
- attachment note generation
- customer-vs-dealer branching behavior
