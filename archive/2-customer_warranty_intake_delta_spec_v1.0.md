# Customer Warranty Intake — Delta Spec

## Document Purpose

This document defines the **differences only** between the current Dealer Warranty Intake implementation baseline and the intended **Customer Warranty Intake** experience shown in the attached customer frontend design. It is a delta artifact for safe future build planning, not a full future-state requirements document.

## Baseline Reference

The baseline authority is **Dealer Warranty Intake — Current-State Implementation Spec**, which describes the current dealer-only form contract, client-side behavior, Worker parsing/validation, and HubSpot routing. The raw `dealer_warranty_form.html` and `warranty-form-handler.js` reviewed here materially align with that baseline; no material baseline/code conflicts were identified in the attached source set.

## Delta Summary

- The submitter context changes from **dealer-only** to **customer-submitted**. The current baseline hardcodes `claim_submitted_by=dealer`, and the current Worker rejects anything other than `dealer`, so a customer branch is required.
- The current `is_sold_unit` pattern disappears. In its place, the customer design introduces two new yes/no questions: **Are You The Original Owner?** and **Warranty Registration Complete?**
- The current dealer form’s conditional, name-only customer section becomes an **always-visible full customer contact section** with name, address, city, region, postal code, country, phone, and email.
- The current **Dealer Information** section becomes **Original Selling Dealer** in the customer design and no longer shows dealer-contact first/last name inputs.
- `labor_hours` is present and required in the current dealer baseline but is **absent** from the customer design. Shared claim fields that appear to remain are `vin`, `date_of_occurrence`, `warranty_symptoms`, `warranty_request`, and `attachments`.
- Current Worker content, note text, and confirmation-email behavior are dealer-centric; customer flow will need customer-centric routing and copy updates.

## Field-Level Deltas

### Added fields

- `original_owner`
  - **Source section/context:** Customer design, top question block: “Are You The Original Owner?” with Yes/No.
  - **What changes:** New yes/no field is added.
  - **Why it changes:** The customer design explicitly captures this value; it does not exist in the current dealer baseline.

- `warranty_registration_complete`
  - **Source section/context:** Customer design, second question block: “Warranty Registration Complete?” with Yes/No.
  - **What changes:** New yes/no field is added.
  - **Why it changes:** The customer design explicitly captures this value; it does not exist in the current dealer baseline.

- `customer_address`, `customer_city`, `customer_region`, `customer_postal_code`, `customer_country`, `customer_phone`, `customer_email`
  - **Source section/context:** Customer design, Customer Information section.
  - **What changes:** Full customer contact/address fields are added beyond current name-only fields.
  - **Why it changes:** The dealer baseline explicitly says the current form does **not** collect customer address/city/region/postal/country/phone/email, while the customer design clearly shows those inputs.

### Removed fields

- `is_sold_unit`
  - **Source section/context:** Current dealer baseline and raw dealer form.
  - **What changes:** Removed entirely from the customer flow.
  - **Why it changes:** The customer design contains no sold-unit question and no sold-unit-driven customer-section behavior.

- `dealer_first_name`
  - **Source section/context:** Current dealer baseline and raw dealer form.
  - **What changes:** Removed from the customer flow.
  - **Why it changes:** The customer design’s Original Selling Dealer section includes dealership/address/contact coordinates, but no dealer-contact first-name input.

- `dealer_last_name`
  - **Source section/context:** Current dealer baseline and raw dealer form.
  - **What changes:** Removed from the customer flow.
  - **Why it changes:** The customer design does not include dealer-contact last name.

- `labor_hours`
  - **Source section/context:** Current dealer baseline, raw dealer form, current Worker validation.
  - **What changes:** Removed from the customer flow.
  - **Why it changes:** It is present and required today, but it does not appear anywhere in the customer design.

### Renamed fields

- **No contract-level field renames are explicitly proven by the source set.**
  - The visible section label changes from **Dealer Information** to **Original Selling Dealer**, but the customer design does not expose HTML `name` attributes.
  - As an implementation recommendation, reusing the existing dealer organization/contact field names for that section is the lowest-drift option, but that is not directly proven by the design and should be confirmed in the next artifact.

### Fields retained unchanged

- `vin`
- `date_of_occurrence`
- `warranty_symptoms`
- `warranty_request`
- `attachments`

These fields exist in both the current dealer baseline and the customer design.

- `category` and `website` honeypot should be treated as unchanged shared baseline mechanics unless intentionally revised later; the customer design does not address hidden/system fields.

### Fields with changed required/optional behavior

- `customer_first_name`
  - **Source section/context:** Current dealer baseline vs customer design.
  - **What changes:** Moves from conditional-only behavior to always-present customer-flow behavior.
  - **Why it changes:** In the current dealer flow it is required only when `is_sold_unit=yes`; in the customer design the customer section is always shown. Exact requiredness is not visually marked, but the field is no longer conditionally gated.

- `customer_last_name`
  - **Source section/context:** Current dealer baseline vs customer design.
  - **What changes:** Same delta as `customer_first_name`.
  - **Why it changes:** Same rationale.

- `labor_hours`
  - **Source section/context:** Current dealer baseline and Worker.
  - **What changes:** Moves from required to not collected in customer flow.
  - **Why it changes:** Present and required today, absent from customer design.

- `original_owner`, `warranty_registration_complete`
  - **Source section/context:** Customer design.
  - **What changes:** New explicit capture points.
  - **Why it changes:** These appear as prominent yes/no questions in the customer design. The most implementation-consistent reading is that they should be required selections, but the design does not explicitly label them required.

- Original Selling Dealer section fields and new customer address/contact fields
  - **Source section/context:** Customer design.
  - **What changes:** They are newly displayed in the customer flow.
  - **Why it changes:** The design shows them as standard inputs, but does not explicitly mark which are required vs optional. Requiredness remains an open question.

### Fields with changed conditional logic

- `customer_first_name`, `customer_last_name`
  - **Source section/context:** Current dealer baseline and raw dealer form.
  - **What changes:** They are no longer controlled by `is_sold_unit`.
  - **Why it changes:** The customer design shows the Customer Information section as always visible.

- `original_owner`, `warranty_registration_complete`
  - **Source section/context:** Customer design.
  - **What changes:** Added as new yes/no values.
  - **Why it changes:** The design introduces them, but does **not** show any conditional UI tied to either value. Until a later artifact says otherwise, they should be treated as captured values, not section toggles.

## Section / UX Deltas

- The customer form structure changes from:
  - **Dealer Information**
  - **Is this a sold unit?**
  - **conditional Customer Information**
  - **Warranty Claim Information**

  to:
  - **Are You The Original Owner?**
  - **Warranty Registration Complete?**
  - **Original Selling Dealer**
  - **Customer Information**
  - **Warranty Claim Information**

- The customer flow removes the current sold-unit-driven show/hide behavior. In the dealer form, the customer section is hidden by default, shown only when `is_sold_unit=yes`, and its inputs are disabled when hidden. The customer design shows no equivalent conditional customer section.

- What is collected changes materially:
  - Current dealer flow collects the dealer submitter’s business/contact info and only optionally collects customer first/last name.
  - Customer flow collects the customer’s full contact/address details plus the Original Selling Dealer record.

- Dealer-only concepts removed from the customer UX:
  - dealer submitter first/last name
  - sold-unit gating
  - labor hours

- Retail/customer-specific concepts added to the customer UX:
  - original owner status
  - warranty registration complete status
  - full customer contact block

- The current dealer UX mechanics such as `novalidate`, custom status messaging, submit loading state, VIN normalization, and attachment size/count constraints can remain shared unless intentionally changed later; nothing in the customer design contradicts those baseline mechanics.

## Validation Deltas

### Front-end validation deltas

- Remove validation for `is_sold_unit` and remove the corresponding fieldset-invalid UX tied to that radio group.
- Remove conditional validation that only checks customer fields when `is_sold_unit=yes`; replace it with direct validation for the expanded customer section.
- Remove required validation for `labor_hours`.
- Add validation for `original_owner` and `warranty_registration_complete` selections. This is strongly implied by the design, but the requiredness policy is not explicitly labeled.
- Add validation for the new customer contact fields, especially `customer_email` format if that field is used for routing/confirmation. The design clearly adds the field, but exact requiredness of every customer subfield is not explicitly shown.
- Retain current VIN normalization/format validation and the current attachment count/size limits unless deliberately changed later.

### Worker validation deltas

- The Worker must stop treating `claim_submitted_by !== "dealer"` as an automatic validation failure for customer submissions. The current Worker is explicitly dealer-only.
- The customer branch must stop requiring:
  - `is_sold_unit`
  - `dealer_first_name`
  - `dealer_last_name`
  - `labor_hours`
- The customer branch must add parsing/validation for:
  - `original_owner`
  - `warranty_registration_complete`
  - expanded customer contact fields, including `customer_email` if used for contact/email routing.
- The current Worker’s VIN regex, honeypot handling, and attachment size/count enforcement can remain shared logic.
- **Attachment requiredness is not explicitly resolved by the source set.** The current dealer baseline requires at least one attachment, and the customer design still includes a File Upload control, but the design does not explicitly say whether zero-file submission should be allowed.

## Submission Contract Deltas

The customer design does **not** expose actual HTML `name` attributes, so the exact contract below is a **recommended contract shape** aligned to the current dealer naming conventions and intended to minimize Worker drift. These names should be locked in a follow-up contract artifact.

- **Hidden / system fields**
  - `claim_submitted_by = customer` instead of `dealer`
  - `category = Warranty` unchanged
  - `website` honeypot unchanged

- **Newly sent customer-flow fields**
  - `original_owner`
  - `warranty_registration_complete`
  - `customer_address`
  - `customer_city`
  - `customer_region`
  - `customer_postal_code`
  - `customer_country`
  - `customer_phone`
  - `customer_email`

- **Likely shared Original Selling Dealer fields**
  - `dealer_name`
  - `dealer_address`
  - `dealer_city`
  - `dealer_region`
  - `dealer_postal_code`
  - `dealer_country`
  - `dealer_phone`
  - `dealer_email`

  These are recommended reuse candidates because the customer design shows the same data points, while the current baseline already has parser/mapping support for them.

- **Shared claim fields**
  - `customer_first_name`
  - `customer_last_name`
  - `vin`
  - `date_of_occurrence`
  - `warranty_symptoms`
  - `warranty_request`
  - `attachments`

- **Fields no longer sent in customer flow**
  - `is_sold_unit`
  - `dealer_first_name`
  - `dealer_last_name`
  - `labor_hours`

- **Shared transport assumption**
  - `multipart/form-data` remains the practical live browser contract because attachments remain part of the flow.

## Worker Branching Deltas

- Introduce explicit submission-type branching so the current dealer branch remains stable and a new customer branch handles customer submissions. The current Worker is hard-coded around dealer-only validation and dealer-centric routing.
- In the customer branch, parse and validate the new customer-only fields and remove dependency on `is_sold_unit`. There is no evidence that original-owner or registration-complete answers should toggle UI or branching beyond validation/storage.
- The customer branch should no longer expect dealer rep name fields or `labor_hours`. If the Original Selling Dealer section reuses existing `dealer_*` org/contact fields, the parser can keep much of the current dealer-address/contact structure while changing the submitter model.
- Current Worker contact routing is keyed to `dealer_email`; for customer submissions, the submitting party becomes the customer, so the customer branch should use `customer_email` as the canonical submission/contact email. This is the implementation-consistent analogue of the current dealer flow, but the source set does not explicitly declare it.
- Current ticket/body/note strings are dealer-specific. The Worker currently builds content such as “Warranty intake via website dealer form” and note text that says the files were uploaded via the dealer intake form. Customer submissions need customer-specific wording and fuller customer contact detail in ticket content.
- Current confirmation-email behavior sends to dealer email only. For the customer branch, recipient and copy should shift to the customer submitter and should omit labor-hours references. This is strongly implied by the submitter change, but not explicitly stated in the customer design.
- Shared logic that appears reusable:
  - claim number generation
  - honeypot handling
  - attachment upload pattern
  - HubSpot ticket creation pattern
  - association attempts
  - JSON response flow

## HubSpot Mapping Deltas

- **Contact property differences**
  - Current Worker contact creation is dealer-centric: it uses dealer email as the canonical contact key and stores `dealer_*` properties, with only `customer_first_name` and `customer_last_name` added from the customer side.
  - Customer flow does not fit that shape. The customer design adds full customer address/contact data, so customer submissions likely need a customer-centric contact keyed by `customer_email`, with matching `customer_*` property storage. Exact HubSpot internal property names for those new customer fields are **not** present in the source set.

- **Ticket property differences**
  - These shared ticket properties can remain:
    - `trailer_vin`
    - `warranty_date_of_occurrence`
    - `warranty_symptoms`
    - `warranty_request`
    - `hs_file_upload`
    - `hs_ticket_category`
    - `claim_submitted_by`
  - `warranty_labor_hours` should be omitted or left blank for customer submissions because `labor_hours` is not in the customer design.
  - `original_owner` and `warranty_registration_complete` need a destination, but the source set does not define whether they belong in dedicated ticket properties or only in ticket content. That mapping remains open.
  - Original Selling Dealer details and the customer’s expanded contact details also need either dedicated ticket properties or richer ticket content. Current Worker ticket content includes dealer info and only customer name, not full customer contact detail.

- **Other mapping/content deltas**
  - Attachment note body must stop referencing the dealer intake form.
  - Confirmation email content must stop assuming the dealer is the submitter/recipient.
  - Ticket subject/body builders should reflect customer-submitted intake and include the new customer/original-selling-dealer data model.

## Known Ambiguities / Open Questions

- The customer design does not provide literal HTML `name` attributes for the new fields. Exact contract names need to be confirmed.
- It is not explicitly stated whether the Original Selling Dealer section should reuse current `dealer_*` field names or use a new `original_selling_dealer_*` namespace.
- Requiredness of each Original Selling Dealer subfield and each new customer address/contact subfield is not visually specified in the design.
- The source set does not explicitly resolve whether file upload remains mandatory for customer submissions or simply available.
- The source set does not show any downstream behavior tied to `original_owner` or `warranty_registration_complete`; whether those should trigger branching is unresolved.
- Exact HubSpot internal property names for new customer contact fields and for the two new yes/no values are not present in the attached materials.
- Whether customer submissions should create/associate only a customer contact, or also try to associate an Original Selling Dealer company/contact, is not defined by the source set.
- Whether the customer confirmation email should go only to `customer_email` or also to the Original Selling Dealer is not explicitly answered by the attached materials.

## Recommended Next Artifact

**Customer Warranty Intake — Current-State / Intended Submission Contract**

That should be the next artifact because the biggest unresolved items are contract-level: exact field names, requiredness, shared-vs-customer-only payload fields, and the final canonical email/contact key for customer submissions. Locking that contract first will make both the **Worker Branching Update Spec** and the **Customer Warranty Form Build Spec** deterministic.