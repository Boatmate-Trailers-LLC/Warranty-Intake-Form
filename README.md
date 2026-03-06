# Boatmate Warranty Intake — Forms + Worker

## What this repo is
This repository is a **development workspace** for Boatmate’s warranty intake system:

- **HTML forms** (legacy reference form + split dealer/customer forms)
- A **serverless Worker** backend that validates submissions, generates a **sequential claim number**, and creates records in the CRM
- Optional: **file uploads** (stored privately) and a **Note** attached to the created ticket
- Optional: **confirmation email** when configured

> Nothing in this repo should be considered “live” by default. This is in-progress development.

---

## Current dev status
- **Legacy/original form (reference only):**
  - `forms/_legacy/warranty_form.html`
- **Split forms (active development targets):**
  - `forms/dealer_warranty_form.html`
  - `forms/customer_warranty_form.html`
- **Worker (current implementation):**
  - `worker/warranty-form-handler.js`

**Important:** The Worker currently enforces **dealer-only submissions** (`claim_submitted_by=dealer`). The customer form is being built in parallel, and Worker support will be extended when the customer flow is ready.

---

## Non-negotiable business rules (do not drift)
- **“Ship To” is removed entirely**
  - It must not be collected, parsed, validated, stored, or mapped anywhere.
- **Labor rate is not part of this project**
  - Do not collect or send labor rate.
- **Attachments**
  - Multi-file uploads are supported
  - Enforce the declared limits in the form UI and in the Worker (count/size)
- **Honeypot anti-spam**
  - Honeypot field name: `website` (bots fill; humans never see)

---

## Repo layout
- `docs/`
  - Design references (PDFs)
  - Example: `docs/Customer Warranty Intake Form Frontend Design.pdf`
- `forms/`
  - `dealer_warranty_form.html` (split dealer form)
  - `customer_warranty_form.html` (split customer form)
  - `_legacy/`
    - `warranty_form.html` (original single form; reference only)
- `worker/`
  - `warranty-form-handler.js` (serverless Worker)
  - `wrangler.toml` (Worker + Durable Object config)

---

## Data flow (high level)
1. User submits a form (`multipart/form-data`).
2. Worker validates payload and attachment limits.
3. Worker requests the next sequential claim number from `ClaimCounter` (Durable Object).
4. Worker upserts/creates a Contact (currently keyed by dealer email for dealer submissions).
5. Worker creates a Ticket in the Warranty pipeline/stage.
6. If attachments exist:
   - uploads files (PRIVATE)
   - creates a Note associated to the Ticket with attachment IDs
7. Optionally sends a confirmation email.

---

## Forms

### Dealer form (current baseline)
- Submits `claim_submitted_by=dealer` as a hidden input.
- Worker enforces dealer-only submissions at this stage.

#### Required — Dealer Information
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

#### Customer Information (current dealer flow: name-only)
- `customer_first_name`
- `customer_last_name`

#### Required — Warranty Claim Information
- `vin` (validated as 17 chars, no I/O/Q)
- `date_of_occurrence`
- `warranty_symptoms`
- `warranty_request`

#### Optional
- `labor_hours`
- `attachments` (multiple)

#### Hidden fields
- `claim_submitted_by=dealer`
- `category=Warranty`
- honeypot: `website`

### Customer form (in progress)
Customer form fields and validation will be finalized against the design PDF in `docs/` and the Worker will be updated to support `claim_submitted_by=customer` when ready.

---

## Worker
- Location: `worker/warranty-form-handler.js`
- Config: `worker/wrangler.toml`
- Current enforcement: dealer-only (`claim_submitted_by=dealer`)

---

## Local development

### Run the Worker locally
From `/worker`:
- `wrangler dev`

Or from repo root:
- `wrangler -c worker/wrangler.toml dev`

### Serve the forms locally
Use any static server (VS Code Live Server works fine).
If you see CORS errors, confirm the Worker allowlist includes your local origin (e.g., Live Server default).

---

## Worker response format

### Success (example)
{
  "ok": true,
  "claimNumber": 100123,
  "ref": "uuid",
  "contactId": "123",
  "ticketId": "456",
  "noteId": "789",
  "emailStatus": "sent|failed|skipped",
  "message": "Submitted. Confirmation email sent.",
  "attachmentFileNames": ["a.jpg"],
  "attachmentFileIds": ["999"],
  "attachmentsError": null
}