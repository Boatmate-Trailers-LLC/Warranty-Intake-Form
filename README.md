# Boatmate Warranty Intake — Cloudflare Worker

Backend service for the Boatmate warranty intake form.

This Worker:

* Accepts warranty claim submissions from `boatmateparts.com`.
* Validates core fields (VIN, email).
* Issues a strictly incrementing warranty Claim # via a Durable Object.
* Upserts a HubSpot **Contact** based on dealer / customer info.
* Creates a HubSpot **Ticket** in the Warranty pipeline with mapped custom properties.
* Uploads attached photos/documents to HubSpot **Files**.
* Creates a HubSpot **Note** associated to the Ticket with `hs_attachment_ids` so files show as ticket attachments.
* Optionally sends a structured **confirmation email** via Brevo to the submitter.

---

## Tech Stack

* **Runtime:** Cloudflare Workers (modules syntax)
* **Persistence:** Cloudflare Durable Object (SQLite-backed) for Claim # sequence
* **CRM:** HubSpot (Contacts, Tickets, Companies, Notes, Files, Associations)
* **Email:** Brevo (formerly Sendinblue) transactional API
* **Config:** `wrangler.toml` + Cloudflare environment variables / secrets

---

## High-Level Flow

1. **Browser form → Worker**

   * Form posts to the Worker endpoint as either:

     * `application/json` (dev/testing), or
     * `multipart/form-data` (production) for file uploads.
   * CORS is enforced so only known `boatmateparts.com` origins are allowed.

2. **Parsing & Validation**

   * Worker extracts:

     * Who is submitting: `claim_submitted_by` (`"dealer"` or `"customer"`)
     * Original owner flag: `original_owner` (`"yes"` / `"no"`)
     * Dealer info, customer info, warranty fields, attachments.
   * VIN must match a 17-character VIN pattern (`^[A-HJ-NPR-Z0-9]{17}$`).
   * Email must be syntactically valid.
   * If validation fails, the Worker returns `400` with `ok: false` and error messages.

3. **Claim # Generation**

   * Worker calls the `ClaimCounter` Durable Object to retrieve the next Claim #.
   * Counter is strictly incrementing and stored in Durable Object state.

4. **HubSpot Contact Upsert**

   * Primary email is chosen based on `claim_submitted_by`:

     * If `"customer"` → customer email.
     * If `"dealer"` → dealer email.
     * Fallback to whichever is available (or legacy `email` field).
   * Contact is looked up by email. If not found, a new contact is created.
   * Custom contact properties (dealer + customer fields) are populated.

5. **HubSpot Ticket Creation**

   * Ticket is created in the configured Warranty pipeline & stage.
   * Subject line includes:

     * `Claim #`
     * Dealer or trailer owner name
     * Trailer number / short VIN (10th VIN character + last 4 digits).
   * Ticket body (`content`) is a human-readable summary of:

     * Claim summary
     * Dealer information
     * Customer information
     * Warranty claim details and optional labor details.
   * Custom ticket properties are set (VIN, date of occurrence, etc.).
   * Ticket is associated to:

     * The Contact (always).
     * The primary Company associated with that Contact (if any).

6. **Attachments → HubSpot Files & Note**

   * Each uploaded file is sent to the HubSpot Files API.
   * A Note is created and associated to the Ticket with `hs_attachment_ids`
     so attachments show under the ticket in HubSpot.

7. **Confirmation Email (Brevo)**

   * If email is enabled and configured, the Worker sends a confirmation email to the submitter.
   * Email includes:

     * Optional Boatmate logo (from `EMAIL_LOGO_URL`).
     * Claim summary (Claim #, Trailer #, VIN, Submitted By, Original Owner, Date Submitted).
     * Dealer and customer blocks with full addresses.
     * Warranty claim details (date of occurrence, ship to, symptoms, request, labor, attachments).
   * Includes both **HTML** and **plain-text** versions.

8. **JSON Response to Client**

   * On success, returns:

     ```json
     {
       "ok": true,
       "claimNumber": 100123,
       "ref": "uuid-...",
       "contactId": "12345",
       "ticketId": "67890",
       "noteId": "98765",
       "emailStatus": "sent",
       "message": "Submitted. Confirmation email sent.",
       "ticketError": null,
       "attachmentFileNames": [...],
       "attachmentFileIds": [...],
       "attachmentsError": null
     }
     ```

---

## Worker Endpoint

> **Method:** `POST`
> **Content Types:**
>
> * `application/json` (dev / testing)
> * `multipart/form-data` (production, to support file uploads)

### Allowed Origins (CORS)

In code:

```js
const ALLOWED_ORIGINS = new Set([
  "http://127.0.0.1:5500",
  "https://boatmateparts.com",
  "https://www.boatmateparts.com",
  "http://boatmateparts.com",
  "http://www.boatmateparts.com"
]);
```

Only these origins will receive `Access-Control-Allow-Origin`. Others will be blocked.

---

## Request Fields

### Core / meta

* `vin` — **required**, 17-char VIN (no I, O, Q).
* `category` — optional; defaults to `"Warranty"`.

### Who is submitting

* `claim_submitted_by` — `"dealer"` or `"customer"` (case-insensitive).
* `original_owner` — `"yes"` or `"no"` (free-text but normalized for display).

### Dealer fields

* `dealer_name`
* `dealer_first_name`
* `dealer_last_name`
* `dealer_address`
* `dealer_city`
* `dealer_region` (state / province)
* `dealer_postal_code`
* `dealer_country`
* `dealer_phone`
* `dealer_email`

### Customer fields

* `customer_first_name`
* `customer_last_name`
* `customer_address`
* `customer_city`
* `customer_region`
* `customer_postal_code`
* `customer_country`
* `customer_phone`
* `customer_email`

### Warranty fields

* `date_of_occurrence`
* `ship_to`
* `warranty_symptoms` (multi-line text allowed)
* `warranty_request` (multi-line text allowed)
* `labor_rate` (optional)
* `labor_hours` (optional)

### Attachments

For `multipart/form-data`:

* `attachments` — one or more `File` inputs using the same field name `attachments`.

These are collected and uploaded to HubSpot Files.

---

## Durable Object: `ClaimCounter`

The Durable Object ensures a globally incrementing claim number.

### Definition

* Class name: `ClaimCounter`
* Binding name: `CLAIM_COUNTER`

In `wrangler.toml`:

```toml
[[durable_objects.bindings]]
name = "CLAIM_COUNTER"
class_name = "ClaimCounter"

[[migrations]]
tag = "v1"
new_sqlite_classes = ["ClaimCounter"]
```

### Behavior

* Storage key `"n"` holds the current counter.
* On each `POST /next`, it:

  * Reads `n` (default `100000` if unset).
  * Increments to `n + 1`.
  * Persists and returns `{ "n": <new value> }`.
* Worker uses `CLAIM_COUNTER` to get the next claim number and injects it into:

  * Ticket subject
  * Ticket content
  * Confirmation email
  * Note body for attachments
  * JSON response to the client

---

## HubSpot Integration

### Private App Scopes

The `HUBSPOT_TOKEN` must belong to a private app with permissions to:

* Read/write **Contacts**
* Read/write **Tickets**
* Read **Companies**
* Write **Notes**
* Write **Files**
* Read/write **Associations**

(Exact scope names depend on HubSpot’s UI, but the token must be able to perform all above operations.)

### Contact Upsert

The Worker:

1. Picks a **primary email** (customer > dealer > legacy `email`).
2. Searches for an existing Contact by email.
3. If found, uses that `contactId`.
4. If not, creates a new contact with properties such as:

   * `email`
   * `dealer`, `dealer_first_name`, `dealer_last_name`
   * `dealer_address`, `dealer_city`, `dealer_state`, `dealer_zip`, `dealer_country`
   * `dealer_phone`, `dealer_email`
   * `customer_first_name`, `customer_last_name`
   * `customer_address`, `customer_city`, `customer_state`, `customer_zip`, `customer_country`
   * `customer_phone`, `customer_email`

> **Important:** These must exist as contact properties in HubSpot (usually created as custom properties).

### Ticket Creation

Ticket properties include:

* `hs_pipeline` — Warranty pipeline ID (configurable).
* `hs_pipeline_stage` — initial stage (e.g., *New*).
* `subject` — `Warranty Claim #<n> - <Name> - <TrailerNumber>`.
* `content` — multi-line summary text.
* `trailer_vin`
* `warranty_date_of_occurrence`
* `warranty_ship_to`
* `warranty_symptoms`
* `warranty_request`
* `warranty_labor_rate`
* `warranty_labor_hours`
* `hs_file_upload` — comma-separated filenames.
* `hs_ticket_category` — category string (e.g., `"Warranty"`).
* `claim_submitted_by`
* `original_owner`

> **Important:** All custom ticket properties must exist in HubSpot before using this Worker.

### Associations

After creating the ticket:

* Ticket ↔ Contact: default association (`/crm/v4/objects/ticket/{ticketId}/associations/default/contact/{contactId}`).
* Ticket ↔ Company:

  * The Worker queries `/crm/v4/objects/contact/{contactId}/associations/company`.
  * It prefers the **Primary** company (`typeId === 1`), or falls back to the first.
  * If found, associates the Ticket with that Company (default association).

### Files & Notes

* Each uploaded `attachments` file is sent to HubSpot Files (`files/v3/files`) into a folder:

  * `HS_FILES_FOLDER_PATH` (default `/warranty-intake`).
* File IDs are collected into `attachmentFileIds`.
* A Note is created with:

  * `hs_note_body`: e.g., *"Warranty attachments uploaded via intake form for Claim #123456 (VIN ...)"*.
  * `hs_attachment_ids`: semicolon-separated list of file IDs.
* Note is associated to the Ticket via the HubSpot-defined Note↔Ticket association type.

---

## Confirmation Email (Brevo)

### When it sends

Email is sent only if:

* `EMAIL_ENABLED === "true"`, **and**
* `EMAIL_API_ENDPOINT`, `EMAIL_API_KEY`, and `FROM_EMAIL` are configured.

### Subject line

* If trailer number (short VIN) is derivable:

  * `Boatmate Warranty Claim #<Claim#> received for <TrailerNumber>`
* Else:

  * `Boatmate Warranty Claim #<Claim#> received`

### HTML Body

Includes:

* Optional logo at the top (if `EMAIL_LOGO_URL` is set).
* Intro text explaining this is a **record**, not an approval/denial.
* **Claim Summary**
* **Dealer Information** (name, email, phone, full address)
* **Customer Information** (name, email, phone, full address)
* **Warranty Claim Details**:

  * Date of Occurrence
  * Ship To
  * Warranty Symptoms (with line breaks preserved)
  * Warranty Request (with line breaks preserved)
  * Optional Labor Rate / Labor Hours (if provided)
* **Attached Files** (list of filenames or `None`)
* Closing text with instructions and reminder to reference Claim # in future communications.

### Plain-Text Body

Mirrors the HTML content in a text-friendly format:

* Heading-style sections:

  * `Claim Summary`
  * `Dealer Information`
  * `Customer Information`
  * `Warranty Claim Details`
* Flat key/value style lines:

  * `Date of Occurrence: ...`
  * `Warranty Symptoms: ...`
  * `Warranty Request: ...`
  * `Labor Rate: ...` / `Labor Hours: ...` (if present)
* Attachments:

  * `Attached Files:` followed by `* filename.ext` lines, or `Attached Files: None`.

---

## Configuration

All secrets and env vars should be stored in Cloudflare (Dashboard or `wrangler secret/vars`).

### HubSpot

* `HUBSPOT_TOKEN` — **required**. HubSpot private app token with required scopes.

* `HS_TICKET_PIPELINE` — optional; Warranty pipeline ID as string.

  * Defaults to `"760934225"` if not set.

* `HS_TICKET_STAGE` — optional; initial stage ID.

  * Defaults to `"1108043102"` (*New*).

* `HS_FILES_FOLDER_PATH` — optional; path for Files API uploads.

  * Default: `"/warranty-intake"`.

### Email (Brevo)

* `EMAIL_ENABLED` — `"true"` to enable sending; anything else disables.
* `EMAIL_API_ENDPOINT` — Brevo API endpoint (usually `https://api.brevo.com/v3/smtp/email`).
* `EMAIL_API_KEY` — Brevo transactional API key.
* `FROM_EMAIL` — verified Brevo sender address.
* `FROM_NAME` — optional; friendly sender name.
* `REPLY_TO` — optional reply-to email address.
* `EMAIL_LOGO_URL` — optional; HTTPS URL to a Boatmate logo image used in the email header.

---

## Deployment

Use `wrangler` to deploy.

### `wrangler.toml` (excerpt)

```toml
name = "boatmate-warranty-intake"
main = "warranty-form-handler.js"
compatibility_date = "2024-11-01"
workers_dev = true
account_id = "808eaf14ab4188158744569e38766ce2"

[[durable_objects.bindings]]
name = "CLAIM_COUNTER"
class_name = "ClaimCounter"

[[migrations]]
tag = "v1"
new_sqlite_classes = ["ClaimCounter"]

# Optional: routes for production
# routes = [
#   { pattern = "boatmateparts.com/warranty-intake", zone_name = "boatmateparts.com" },
#   { pattern = "www.boatmateparts.com/warranty-intake", zone_name = "boatmateparts.com" }
# ]
```

### Commands

* Deploy (production / workers.dev):

  ```bash
  wrangler deploy
  ```

* Local dev:

  ```bash
  wrangler dev
  ```

  Then hit the dev URL in the browser or with `curl` to test.

---

## Error Handling & Responses

### Validation errors (400)

If VIN or email are invalid:

```json
{
  "ok": false,
  "errors": [
    "VIN must be 17 chars (no I, O, Q).",
    "Email is invalid."
  ]
}
```

No Claim # is reserved when validation fails.

### HubSpot / Brevo errors

* Contact/Ticket/Files/Notes failures are logged with `console.error`.
* On ticket failure, `ticketError` is set in the JSON response.
* On attachment note failure, `attachmentsError` is set.
* On email failure, `emailStatus` is `"failed"` and the `message` explains that email delivery is unavailable, but the claim is still accepted.

---

## Logging & Observability

The Worker logs key events:

* Successful contact upsert: `HS contactId`
* Ticket creation: `HS ticketId`
* Attachment note creation: `HS noteId (attachments)`
* Failures for:

  * Contact upsert
  * Ticket creation
  * Ticket↔Contact associations
  * Ticket↔Company associations
  * File uploads
  * Note creation
  * Email sending

Use Cloudflare’s Workers dashboard or `wrangler tail` to view logs:

```bash
wrangler tail boatmate-warranty-intake
```

---

## Security Notes / Future Enhancements

Current protections:

* **CORS:** Only known `boatmateparts.com` origins allowed.
* **Server-side validation:** VIN and email are strictly validated.
* **Secrets:** HubSpot/Brevo tokens are kept in environment variables, not in code.

Recommended future hardening (not yet implemented in this Worker):

* Add a secret header/token that only the front-end form knows.
* Add a bot-check (e.g., hCaptcha or Cloudflare Turnstile) to the form.
* Add basic rate limiting or abuse detection at the Worker or zone level.

---

## License / Ownership

This Worker is intended for internal use by Boatmate Trailers LLC as part of the BoatmateParts.com warranty intake system. All configuration (HubSpot properties, pipelines, Brevo sender, etc.) is specific to Boatmate’s environment.
