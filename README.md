# Boatmate Warranty Intake (Dealer Form) — README

## What this is
This repo contains the **Dealer Warranty Intake** system used by Boatmate:

- A **front-end HTML form** that posts `multipart/form-data`
- A **Cloudflare Worker** backend that validates submissions, generates a **sequential claim number**, and creates records in **HubSpot**
- Optional: **file uploads** to HubSpot Files + a **Note** attached to the Ticket
- Optional: a **confirmation email** to the dealer (via Brevo) when configured

This is a **hard changeover** implementation (no legacy compatibility).

---

## Current business rules (do not drift)
- **Dealer-only form**
  - The form submits `claim_submitted_by=dealer` as a hidden input.
  - The Worker enforces this and will reject anything else.
- **Customer Information is name-only**
  - Only `customer_first_name` and `customer_last_name` are collected/required.
- **“Ship To” is removed entirely**
  - It is not collected, parsed, validated, stored, or mapped anywhere.
- **Labor rate is not part of this project**
  - Do not collect or send labor rate.

---

## Files in this repo
- `dealer-warranty-intake.html`
  - The Dealer Warranty Intake form
  - Client-side validation (required fields, VIN format, attachment size/count)
  - Submitting UI state (disables button + shows spinner)
- `warranty-form-handler.js`
  - Cloudflare Worker (module syntax)
  - Durable Object claim counter
  - HubSpot integration (Contact upsert, Ticket create, associations, file uploads, note w/ attachments)
  - Optional Brevo email
- `wrangler.toml`
  - Cloudflare Worker + Durable Object config

---

## Data flow (high level)
1. Dealer fills out the form and submits.
2. Worker validates the payload and attachment limits.
3. Worker requests the next sequential claim number from `ClaimCounter` (Durable Object).
4. Worker upserts a HubSpot Contact (keyed by **dealer email**).
5. Worker creates a HubSpot Ticket in the Warranty pipeline/stage.
6. If attachments exist:
   - uploads files to HubSpot Files (PRIVATE)
   - creates a Note associated to the Ticket with `hs_attachment_ids`
7. Optionally sends a confirmation email to the dealer.

---

## Form fields (dealer form)
### Required — Dealer Information
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

### Required — Customer Information (name only)
- `customer_first_name`
- `customer_last_name`

### Required — Warranty Claim Information
- `vin` (validated as 17 chars, no I/O/Q)
- `date_of_occurrence`
- `warranty_symptoms`
- `warranty_request`

### Optional
- `labor_hours`
- `attachments` (multiple)

### Hidden fields
- `claim_submitted_by` = `dealer`
- `category` = `Warranty`
- honeypot field: `website` (bots fill; humans never see)

---

## Worker response format
### Success
Returns JSON similar to:
```json
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