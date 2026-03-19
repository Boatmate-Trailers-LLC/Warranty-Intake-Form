# Change Request — Customer Warranty Form Build Spec Layout Normalization

## Change Request

**Title**  
CR-CUST-BUILD-001 — Normalize Layout Notation to Row-Explicit Placement Grammar

**Target Artifact**  
Customer Warranty Intake — Form Build Spec

**Requested Change Type**  
Clarification / formatting normalization

**Recommended Version Target**  
1.1

**Compatibility**  
Non-breaking

**Impact**  
Customer Warranty Intake — Form Build Spec only

### Context

The current build spec uses mixed layout notation.

Some field entries use shorthand such as:
- `left column`
- `right column`
- `full-width row`

Other field entries already use the stronger, row-explicit pattern such as:
- `row 1 left column`
- `row 2 right column`
- `row 3 full width`

This creates avoidable ambiguity inside the same artifact. In a multi-row two-column section, shorthand placement does not fully encode where a field belongs.

### Objective

Revise the Customer Warranty Form Build Spec so that every field-level `layout:` note includes both:
- row number
- horizontal placement

The goal is to make layout instructions fully deterministic for implementation and QA without changing payload names, validation, UX behavior, section order, or submission behavior.

### Recommendation

Approve the deltas below and revise the Customer Warranty Form Build Spec accordingly.

### Approvals

- Sponsor
- PM
- Tech Lead

---

# DELTAS

## DELTA 1 — Add canonical layout-notation rule

**Target Section:**  
`## Build-Layer Resolutions`

**Insert after:**  
`### 5) Typography should not block implementation`

**Add:**

```markdown
### 6) Canonical layout notation is row-explicit

For every field-level `layout:` note in a multi-field section, use the following canonical grammar:
- `row N left column`
- `row N right column`
- `row N full width`

Rules:
- `N` must be an explicit desktop row number within that section
- `full width` means the field occupies the entire row
- do **not** use shorthand such as `left column`, `right column`, or `full-width row` without a row number
- future edits to this build spec should preserve this grammar anywhere field layout is specified

This is a notation clarification only. It does **not** change payload names, validation, or behavior.
```

**Why**  
This prevents ambiguous layout shorthand from reappearing and gives the artifact one canonical placement grammar.

---

## DELTA 2 — Normalize Original Selling Dealer field-level layout notes

**Target Section:**  
`## 3) Original Selling Dealer` → `### Field Order and Build Rules`

**Replace the `layout:` bullets only as follows:**

- `dealer_name`
  - change `layout: full-width row`
  - to `layout: row 1 full width`

- `dealer_address`
  - change `layout: full-width row`
  - to `layout: row 2 full width`

- `dealer_city`
  - change `layout: left column`
  - to `layout: row 3 left column`

- `dealer_region`
  - change `layout: right column`
  - to `layout: row 3 right column`

- `dealer_postal_code`
  - change `layout: left column`
  - to `layout: row 4 left column`

- `dealer_country`
  - change `layout: right column`
  - to `layout: row 4 right column`

- `dealer_phone`
  - change `layout: left column`
  - to `layout: row 5 left column`

- `dealer_email`
  - change `layout: right column`
  - to `layout: row 5 right column`

**Why**  
This makes the entire Original Selling Dealer section deterministic at the field level.

---

## DELTA 3 — Normalize Customer Information field-level layout notes

**Target Section:**  
`## 4) Customer Information` → `### Field Order and Build Rules`

**Replace the `layout:` bullets only as follows:**

- `customer_first_name`
  - change `layout: left column`
  - to `layout: row 1 left column`

- `customer_last_name`
  - change `layout: right column`
  - to `layout: row 1 right column`

- `customer_address`
  - change `layout: full-width row`
  - to `layout: row 2 full width`

- `customer_city`
  - change `layout: left column`
  - to `layout: row 3 left column`

- `customer_region`
  - change `layout: right column`
  - to `layout: row 3 right column`

- `customer_postal_code`
  - change `layout: left column`
  - to `layout: row 4 left column`

- `customer_country`
  - change `layout: right column`
  - to `layout: row 4 right column`

- `customer_phone`
  - change `layout: left column`
  - to `layout: row 5 left column`

- `customer_email`
  - change `layout: right column`
  - to `layout: row 5 right column`

**Why**  
This aligns the Customer Information section to the same row-explicit grammar already used in part of the document.

---

## DELTA 4 — Normalize the remaining non-canonical field-level layout note in Warranty Claim Information

**Target Section:**  
`## 5) Warranty Claim Information` → `### Field Order and Build Rules`

**Replace:**

```markdown
- layout: full-width row below the two textareas
```

**With:**

```markdown
- layout: row 3 full width
```

**Applies To:**  
`attachments`

**Why**  
The other Warranty Claim fields are already row-explicit. This brings the last field in that section into the same grammar.

---

## DELTA 5 — Normalize Desktop Layout summary to row-explicit notation

**Target Section:**  
`## Layout Specification` → `### Desktop Layout`

**Replace the subsection bodies below with:**

```markdown
#### Top yes/no sections
- one fieldset each
- each fieldset occupies its own full-width row in vertical stack order
- radios remain inline horizontally within each fieldset on desktop

#### Original Selling Dealer
- two-column grid
- row 1: `dealer_name` full width
- row 2: `dealer_address` full width
- row 3: `dealer_city` + `dealer_region`
- row 4: `dealer_postal_code` + `dealer_country`
- row 5: `dealer_phone` + `dealer_email`

#### Customer Information
- two-column grid
- row 1: `customer_first_name` + `customer_last_name`
- row 2: `customer_address` full width
- row 3: `customer_city` + `customer_region`
- row 4: `customer_postal_code` + `customer_country`
- row 5: `customer_phone` + `customer_email`

#### Warranty Claim Information
- two-column claim grid
- row 1: `vin` + `date_of_occurrence`
- row 2: `warranty_symptoms` + `warranty_request`
- row 3: `attachments` full width
```

**Why**  
This keeps the section-level layout summary aligned with the field-level row numbering.

---

## DELTA 6 — Clarify mobile behavior relative to desktop row notation

**Target Section:**  
`## Layout Specification` → `### Mobile Layout`

**Append:**

```markdown
- desktop row numbering remains the source-of-truth ordering model
- on mobile, fields collapse to a single column while preserving the desktop row order within each section
```

**Why**  
This removes any ambiguity about whether row numbering is desktop-only notation or a broader ordering model.

---

# Recommended Actions

- Apply DELTA 1 through DELTA 6 to the current Customer Warranty Form Build Spec.
- Do not change payload names, requiredness, section order, validation rules, or submission behavior as part of this revision.
- Promote the revised artifact as version 1.1 after drift review.

# Risks & Mitigations

- **Risk:** A patcher could normalize wording but accidentally change intended row order.  
  **Mitigation:** Use the existing field order plus the Desktop Layout section as the source of truth.

- **Risk:** A future editor reintroduces shorthand layout notation.  
  **Mitigation:** Add the canonical grammar rule in Build-Layer Resolutions.

- **Risk:** Mobile layout could be misread as invalidating desktop row order.  
  **Mitigation:** Add the explicit source-of-truth note in Mobile Layout.

# Open Questions / Assumptions

- This change request is formatting-only and does not request any behavior change.
- The current row order already implied by field order is treated as correct.
- The top two radio sections remain stacked full-width fieldsets rather than being forced into a two-column placement model.
