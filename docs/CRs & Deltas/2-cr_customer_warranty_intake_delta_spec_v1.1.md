# Change Request — Customer Warranty Intake Delta Spec Accuracy Hardening

## Change Request

**Title**  
CR-WTY-DELTA-001 — Tighten Customer Warranty Intake Delta Spec to Source-Proven Statements

**Target Artifact**  
Customer Warranty Intake — Delta Spec

**Requested Change Type**  
Accuracy hardening / drift reduction

**Recommended Version Target**  
1.1

**Compatibility**  
Non-breaking

**Impact**  
Customer Warranty Intake — Delta Spec only

### Context

The current draft is largely accurate, but several passages move beyond source-proven delta into implementation recommendation. The customer design proves visible questions, sections, and inputs, while the dealer baseline and raw dealer files prove the current dealer contract and Worker behavior. The delta spec should distinguish clearly between:

- source-proven deltas
- implementation recommendations
- unresolved contract questions

### Objective

Revise the Customer Warranty Intake — Delta Spec so that:

- declarative statements are limited to what the source set actually proves
- implementation carry-forward ideas are labeled as recommendations, not facts
- unproven requiredness, naming, and routing decisions are moved to Open Questions or softened accordingly

### Recommendation

Approve the deltas below and revise the draft before using it to derive the submission contract.

### Approvals

- Sponsor
- PM
- Tech Lead

---

# DELTAS

## DELTA 1 — Soften the Baseline Reference certainty statement

**Replace:**

> The baseline authority is **Dealer Warranty Intake — Current-State Implementation Spec**, which describes the current dealer-only form contract, client-side behavior, Worker parsing/validation, and HubSpot routing. The raw `dealer_warranty_form.html` and `warranty-form-handler.js` reviewed here materially align with that baseline; no material baseline/code conflicts were identified in the attached source set.

**With:**

> The baseline authority for this review is **Dealer Warranty Intake — Current-State Implementation Spec**, which describes the current dealer-only form contract, client-side behavior, Worker parsing/validation, and HubSpot routing. For purposes of this delta review, the attached `dealer_warranty_form.html` and `warranty-form-handler.js` appear to align materially with that baseline. If future contract-level discrepancies are discovered, the raw HTML and Worker should take precedence.

**Why**  
This keeps the baseline confidence high without sounding more absolute than necessary.

---

## DELTA 2 — Reclassify hidden/system carry-forward statements as recommendations

**Replace:**

> `category` and `website` honeypot should be treated as unchanged shared baseline mechanics unless intentionally revised later; the customer design does not address hidden/system fields.

**With:**

> The customer design does not address hidden/system fields. Reusing current shared mechanics such as `category` and the `website` honeypot is a reasonable low-drift implementation approach, but that carry-forward is not directly proven by the customer design and should be confirmed in the submission contract artifact.

**Why**  
The PDF proves visible fields only; it does not prove hidden/system fields.

---

## DELTA 3 — Move requiredness assumptions for new yes/no questions into softer language

**Replace:**

> `original_owner`, `warranty_registration_complete`
> - **Source section/context:** Customer design.
> - **What changes:** New explicit capture points.
> - **Why it changes:** These appear as prominent yes/no questions in the customer design. The most implementation-consistent reading is that they should be required selections, but the design does not explicitly label them required.

**With:**

> `original_owner`, `warranty_registration_complete`
> - **Source section/context:** Customer design.
> - **What changes:** New explicit capture points are introduced.
> - **Why it changes:** These yes/no questions are clearly present in the customer design. The design supports inclusion of these fields, but it does not explicitly prove requiredness. Requiredness should be confirmed in the submission contract artifact.

**Why**  
The design proves presence, not requiredness.

---

## DELTA 4 — Soften requiredness statements for new customer and Original Selling Dealer subfields

**Replace:**

> Original Selling Dealer section fields and new customer address/contact fields
> - **Source section/context:** Customer design.
> - **What changes:** They are newly displayed in the customer flow.
> - **Why it changes:** The design shows them as standard inputs, but does not explicitly mark which are required vs optional. Requiredness remains an open question.

**With:**

> Original Selling Dealer section fields and new customer address/contact fields
> - **Source section/context:** Customer design.
> - **What changes:** These inputs are visually added in the customer flow.
> - **Why it changes:** The design clearly shows these inputs, but it does not prove their final required/optional policy. Requiredness should remain open until the contract artifact locks field-level validation rules.

**Why**  
This is more precise and keeps the paragraph fully source-traceable.

---

## DELTA 5 — Reclassify shared UX/mechanics carry-forward as recommendation language

**Replace:**

> The current dealer UX mechanics such as `novalidate`, custom status messaging, submit loading state, VIN normalization, and attachment size/count constraints can remain shared unless intentionally changed later; nothing in the customer design contradicts those baseline mechanics.

**With:**

> The customer design does not contradict current dealer UX mechanics such as custom validation flow, submit loading state, VIN normalization, or attachment count/size behavior. Reusing those mechanics is a reasonable low-drift implementation approach, but that reuse is an implementation recommendation rather than a design-proven fact.

**Why**  
The PDF does not prove those behaviors; it only does not contradict them.

---

## DELTA 6 — Soften front-end validation assertions for new fields

**Replace:**

> Add validation for `original_owner` and `warranty_registration_complete` selections. This is strongly implied by the design, but the requiredness policy is not explicitly labeled.
>
> Add validation for the new customer contact fields, especially `customer_email` format if that field is used for routing/confirmation. The design clearly adds the field, but exact requiredness of every customer subfield is not explicitly shown.

**With:**

> Add front-end validation rules for any newly adopted customer-flow fields once the submission contract locks requiredness. The customer design clearly introduces `original_owner`, `warranty_registration_complete`, and expanded customer contact fields, but it does not by itself prove final required/optional policy for each field.
>
> If `customer_email` becomes part of the final submitter/contact model, email-format validation should be added in parity with the current dealer email validation approach.

**Why**  
This keeps validation tied to the next artifact instead of prematurely locking policy.

---

## DELTA 7 — Soften attachment-requiredness carry-forward

**Replace:**

> **Attachment requiredness is not explicitly resolved by the source set.** The current dealer baseline requires at least one attachment, and the customer design still includes a File Upload control, but the design does not explicitly say whether zero-file submission should be allowed.

**With:**

> **Attachment requiredness remains open.** The current dealer baseline requires at least one attachment, and the customer design still includes a File Upload control, but the design alone does not prove whether attachment upload remains mandatory in the customer flow.

**Why**  
Cleaner and tighter wording; same substance.

---

## DELTA 8 — Reframe the submission contract section as provisional by design

**Replace the opening paragraph of `## Submission Contract Deltas` with:**

> The customer design does not expose literal HTML `name` attributes, hidden/system fields, or backend payload structure. Accordingly, this section is a **provisional low-drift contract proposal**, not a source-proven final contract. It is intended to identify likely payload changes that should be confirmed in the next artifact.

**Why**  
This is the biggest place where readers could mistake recommendations for settled fact.

---

## DELTA 9 — Downgrade “Likely shared Original Selling Dealer fields” to explicit proposal status

**Replace:**

> **Likely shared Original Selling Dealer fields**
> - `dealer_name`
> - `dealer_address`
> - `dealer_city`
> - `dealer_region`
> - `dealer_postal_code`
> - `dealer_country`
> - `dealer_phone`
> - `dealer_email`
>
> These are recommended reuse candidates because the customer design shows the same data points, while the current baseline already has parser/mapping support for them.

**With:**

> **Proposed low-drift reuse candidates for Original Selling Dealer**
> - `dealer_name`
> - `dealer_address`
> - `dealer_city`
> - `dealer_region`
> - `dealer_postal_code`
> - `dealer_country`
> - `dealer_phone`
> - `dealer_email`
>
> The customer design shows the same data points, and the current baseline already has parser/mapping support for these names. However, the design does not prove whether the final contract should reuse the existing `dealer_*` namespace or adopt a new Original Selling Dealer namespace.

**Why**  
Makes the recommendation status explicit.

---

## DELTA 10 — Fix classification of `customer_first_name` / `customer_last_name`

**Replace:**

> **Shared claim fields**
> - `customer_first_name`
> - `customer_last_name`
> - `vin`
> - `date_of_occurrence`
> - `warranty_symptoms`
> - `warranty_request`
> - `attachments`

**With:**

> **Shared customer/claim payload fields**
> - `customer_first_name`
> - `customer_last_name`
> - `vin`
> - `date_of_occurrence`
> - `warranty_symptoms`
> - `warranty_request`
> - `attachments`

**Why**  
Those two customer-name fields are shared, but they are not “claim fields” in the narrow sense.

---

## DELTA 11 — Soften canonical contact-key assumption in Worker Branching Deltas

**Replace:**

> Current Worker contact routing is keyed to `dealer_email`; for customer submissions, the submitting party becomes the customer, so the customer branch should use `customer_email` as the canonical submission/contact email. This is the implementation-consistent analogue of the current dealer flow, but the source set does not explicitly declare it.

**With:**

> Current Worker contact routing is keyed to `dealer_email`. For customer submissions, `customer_email` is the most likely analogue if the customer becomes the canonical submitter/contact record, but the source set does not explicitly lock that decision. The final canonical contact key should be confirmed in the submission contract and Worker branching artifacts.

**Why**  
This version is safer and more precise.

---

## DELTA 12 — Soften confirmation-email recipient assumption

**Replace:**

> Current confirmation-email behavior sends to dealer email only. For the customer branch, recipient and copy should shift to the customer submitter and should omit labor-hours references. This is strongly implied by the submitter change, but not explicitly stated in the customer design.

**With:**

> Current confirmation-email behavior sends to dealer email only. For a customer branch, customer-recipient behavior is a reasonable implementation expectation, and labor-hours references should be removed if `labor_hours` is no longer collected. However, final recipient policy is not explicitly defined by the customer design and should be confirmed in follow-on artifacts.

**Why**  
The design proves labor-hours removal and customer presence, but not final email-recipient policy.

---

## DELTA 13 — Strengthen Open Questions to absorb all unresolved assumptions

**Append these bullets to `## Known Ambiguities / Open Questions`:**

- Whether `category` and `website` should be carried forward unchanged as hidden/system fields in the customer form.
- Whether current dealer UX mechanics such as custom validation flow, loading state, and attachment enforcement should be carried forward unchanged.
- Whether `original_owner` and `warranty_registration_complete` are mandatory selections or optional captured values.
- Whether `customer_email` should become the canonical contact key for customer-submitted routing.
- Whether customer confirmation email should go only to the customer, or also to the Original Selling Dealer under any scenario.

**Why**  
These are the exact items that need to stop sounding settled before the next artifact locks them down.

---

# Recommended Actions

- Apply these deltas to the Customer Warranty Intake — Delta Spec.
- Treat the revised document as **planning-safe** but still **contract-preliminary**.
- Then generate the **Customer Warranty Intake — Intended Submission Contract** to lock:
  - exact field names
  - requiredness
  - hidden/system fields
  - canonical contact key
  - attachment requiredness
  - confirmation-email policy

---

# Risks & Mitigations

- **Risk:** Recommendations get mistaken for settled contract facts.  
  **Mitigation:** Label provisional items as proposals or open questions.

- **Risk:** The next branch reintroduces drift by inventing `name` attributes from visual labels.  
  **Mitigation:** Make the submission contract the explicit place where names are finalized.

- **Risk:** Worker assumptions get locked too early.  
  **Mitigation:** Keep canonical contact key and email-recipient policy open until the contract and branching specs are written.

---

# Open Questions / Assumptions

- This change request targets the current **Customer Warranty Intake — Delta Spec** draft.
- The deltas above are intended to preserve the draft’s strong core while tightening source discipline.
- The goal is to make the artifact safer to use as the basis for the next contract-level document.