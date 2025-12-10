/**
 * Boatmate Warranty Intake — Cloudflare Worker
 * ============================================
 * PURPOSE
 *   Backend endpoint for the Boatmate warranty intake form.
 *
 * WHAT IT DOES
 *   - Handles CORS for allowed origins (boatmateparts.com + local dev).
 *   - Accepts POSTs as JSON or multipart/form-data (for file uploads).
 *   - Normalizes and validates core fields (VIN, email, etc.).
 *   - Issues a strictly-incrementing Claim # via the ClaimCounter Durable Object.
 *   - Upserts a HubSpot Contact using dealer/customer info.
 *   - Creates a HubSpot Ticket in the Warranty pipeline with mapped properties.
 *   - Uploads any attached files to HubSpot Files API.
 *   - Creates a NOTE engagement with those file IDs and associates it to the Ticket
 *     so attachments appear on the Ticket in HubSpot.
 *   - Optionally sends a confirmation email via Brevo (controlled by EMAIL_ENABLED).
 *
 * CONFIG (env vars / bindings)
 *   - CLAIM_COUNTER         : Durable Object binding for the global claim counter.
 *   - HUBSPOT_TOKEN         : HubSpot private app token (contacts, tickets, files, engagements).
 *   - HS_TICKET_PIPELINE    : (optional) Warranty pipeline ID override.
 *   - HS_TICKET_STAGE       : (optional) Warranty stage ID override.
 *   - HS_FILES_FOLDER_PATH  : (optional) Folder path for uploaded files in HubSpot Files.
 *   - EMAIL_ENABLED         : "true" to send confirmation emails; anything else = skip.
 *   - EMAIL_API_ENDPOINT    : Brevo SMTP endpoint (defaults if unset).
 *   - EMAIL_API_KEY         : Brevo transactional API key.
 *   - FROM_EMAIL            : Verified Brevo sender email.
 *   - FROM_NAME             : (optional) Friendly sender name.
 *   - REPLY_TO              : (optional) Reply-to address.
 *   - EMAIL_LOGO_URL        : (optional) HTTPS URL for logo in confirmation email.
 *
 * NOTES
 *   - Keep secrets in env, never in code.
 *   - If HubSpot scopes change (files/tickets/contacts), update HUBSPOT_TOKEN.
 *   - Engagements API is used for attachments so no notes-specific scope is required.
 */

const ALLOWED_ORIGINS = new Set([
  "http://127.0.0.1:5500",
  "https://boatmateparts.com",
  "https://www.boatmateparts.com",
  "http://boatmateparts.com",
  "http://www.boatmateparts.com"
]);

const DEV_FALLBACK_STAR = false;

// Attachment limits
const MAX_ATTACHMENT_FILES = 10;
const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB per file

// --------------------- Durable Object: ClaimCounter ---------------------
export class ClaimCounter {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request) {
    const url = new URL(request.url);
    if (request.method !== "POST" || url.pathname !== "/next") {
      return new Response("Not found", { status: 404 });
    }

    let n = (await this.state.storage.get("n")) || 100000;
    n += 1;
    await this.state.storage.put("n", n);

    return new Response(JSON.stringify({ n }), {
      headers: { "content-type": "application/json" }
    });
  }
}

// ------------------------------ Worker ------------------------------
export default {
  async fetch(request, env) {
    // Per-request reference ID for logging / tracing
    const ref = crypto.randomUUID();

    if (request.method === "OPTIONS") {
      return handlePreflight(request);
    }

    if (request.method !== "POST") {
      return new Response("Method Not Allowed", {
        status: 405,
        headers: corsHeaders(request)
      });
    }

    const ct = (request.headers.get("content-type") || "").toLowerCase();

    // Core fields
    let vin = "";
    let category = "Warranty";
    let email = "";

    // Honeypot (bot trap)
    let honeypot = "";

    // “Who is submitting” + original owner
    let claim_submitted_by = ""; // "dealer" | "customer" | ""
    let original_owner = "";     // "yes" | "no" | ""

    // Dealer fields
    let dealer_name = "";
    let dealer_first_name = "";
    let dealer_last_name = "";
    let dealer_address = "";
    let dealer_city = "";
    let dealer_region = "";
    let dealer_postal_code = "";
    let dealer_country = "";
    let dealer_phone = "";
    let dealer_email = "";

    // Customer fields
    let customer_first_name = "";
    let customer_last_name = "";
    let customer_address = "";
    let customer_city = "";
    let customer_region = "";
    let customer_postal_code = "";
    let customer_country = "";
    let customer_phone = "";
    let customer_email = "";

    // Warranty fields
    let date_of_occurrence = "";
    let ship_to = "";
    let warranty_symptoms = "";
    let warranty_request = "";
    let labor_rate = "";
    let labor_hours = "";

    // Attachments from form
    const attachmentFiles = [];
    const attachmentFileNames = [];
    const attachmentErrors = [];

    try {
      if (ct.includes("application/json")) {
        // ---------- JSON path (dev/testing, no real File objects) ----------
        const b = await request.json().catch(() => ({}));

        vin = String(b.vin || "").trim().toUpperCase();
        category = b.category ? String(b.category).trim() : "Warranty";

        claim_submitted_by = String(b.claim_submitted_by || "").trim().toLowerCase();
        original_owner = String(b.original_owner || "").trim().toLowerCase();

        dealer_name = String(b.dealer_name || "").trim();
        dealer_first_name = String(b.dealer_first_name || "").trim();
        dealer_last_name = String(b.dealer_last_name || "").trim();
        dealer_address = String(b.dealer_address || "").trim();
        dealer_city = String(b.dealer_city || "").trim();
        dealer_region = String(b.dealer_region || "").trim();
        dealer_postal_code = String(b.dealer_postal_code || "").trim();
        dealer_country = String(b.dealer_country || "").trim();
        dealer_phone = String(b.dealer_phone || "").trim();
        dealer_email = String(b.dealer_email || "").trim().toLowerCase();

        customer_first_name = String(b.customer_first_name || "").trim();
        customer_last_name = String(b.customer_last_name || "").trim();
        customer_address = String(b.customer_address || "").trim();
        customer_city = String(b.customer_city || "").trim();
        customer_region = String(b.customer_region || "").trim();
        customer_postal_code = String(b.customer_postal_code || "").trim();
        customer_country = String(b.customer_country || "").trim();
        customer_phone = String(b.customer_phone || "").trim();
        customer_email = String(b.customer_email || "").trim().toLowerCase();

        date_of_occurrence = String(b.date_of_occurrence || "").trim();
        ship_to = String(b.ship_to || "").trim();
        warranty_symptoms = String(b.warranty_symptoms || "").trim();
        warranty_request = String(b.warranty_request || "").trim();
        labor_rate = String(b.labor_rate || "").trim();
        labor_hours = String(b.labor_hours || "").trim();

        // Honeypot (if you ever send it in JSON dev/testing)
        honeypot = String(b.honeypot || b._hp || "").trim();

        // choose primary email based on "who is submitting" (customer > dealer > legacy)
        const legacyEmail = String(b.email || "").trim().toLowerCase();
        if (claim_submitted_by === "dealer") {
          email = (dealer_email || legacyEmail || "").toLowerCase();
        } else if (claim_submitted_by === "customer") {
          email = (customer_email || legacyEmail || "").toLowerCase();
        } else {
          email = (customer_email || dealer_email || legacyEmail || "").toLowerCase();
        }
      } else {
        // ---------- multipart/form-data (real browser form with files) ----------
        const f = await request.formData();

        vin = String(f.get("vin") || "").trim().toUpperCase();
        const cat = f.get("category");
        if (cat) category = String(cat).trim();

        claim_submitted_by = String(f.get("claim_submitted_by") || "").trim().toLowerCase();
        original_owner = String(f.get("original_owner") || "").trim().toLowerCase();

        // Honeypot (real browser form)
        honeypot = String(f.get("honeypot") || f.get("_hp") || "").trim();

        dealer_name = String(f.get("dealer_name") || "").trim();
        dealer_first_name = String(f.get("dealer_first_name") || "").trim();
        dealer_last_name = String(f.get("dealer_last_name") || "").trim();
        dealer_address = String(f.get("dealer_address") || "").trim();
        dealer_city = String(f.get("dealer_city") || "").trim();
        dealer_region = String(f.get("dealer_region") || "").trim();
        dealer_postal_code = String(f.get("dealer_postal_code") || "").trim();
        dealer_country = String(f.get("dealer_country") || "").trim();
        dealer_phone = String(f.get("dealer_phone") || "").trim();
        dealer_email = String(f.get("dealer_email") || "").trim().toLowerCase();

        customer_first_name = String(f.get("customer_first_name") || "").trim();
        customer_last_name = String(f.get("customer_last_name") || "").trim();
        customer_address = String(f.get("customer_address") || "").trim();
        customer_city = String(f.get("customer_city") || "").trim();
        customer_region = String(f.get("customer_region") || "").trim();
        customer_postal_code = String(f.get("customer_postal_code") || "").trim();
        customer_country = String(f.get("customer_country") || "").trim();
        customer_phone = String(f.get("customer_phone") || "").trim();
        customer_email = String(f.get("customer_email") || "").trim().toLowerCase();

        date_of_occurrence = String(f.get("date_of_occurrence") || "").trim();
        ship_to = String(f.get("ship_to") || "").trim();
        warranty_symptoms = String(f.get("warranty_symptoms") || "").trim();
        warranty_request = String(f.get("warranty_request") || "").trim();
        labor_rate = String(f.get("labor_rate") || "").trim();
        labor_hours = String(f.get("labor_hours") || "").trim();

        // pick primary email based on "who is submitting" (customer > dealer > legacy "email")
        const legacyEmail = String(f.get("email") || "").trim().toLowerCase();
        if (claim_submitted_by === "dealer") {
          email = (dealer_email || legacyEmail || "").toLowerCase();
        } else if (claim_submitted_by === "customer") {
          email = (customer_email || legacyEmail || "").toLowerCase();
        } else {
          email = (customer_email || dealer_email || legacyEmail || "").toLowerCase();
        }

        // Collect real File objects for attachments with basic limits
        for (const [name, value] of f.entries()) {
          if (name === "attachments" && value && typeof value === "object" && "name" in value) {
            if (attachmentFiles.length >= MAX_ATTACHMENT_FILES) {
              attachmentErrors.push("Too many attachments. Maximum is 10 files per submission.");
              break;
            }

            const size = typeof value.size === "number" ? value.size : 0;
            if (size && size > MAX_ATTACHMENT_SIZE_BYTES) {
              attachmentErrors.push(
                `Attachment "${value.name}" is too large. Maximum size is 10 MB per file.`
              );
              break;
            }

            attachmentFiles.push(value);
            if (value.name) attachmentFileNames.push(value.name);
          }
        }
      }
    } catch (e) {
      console.error("Invalid request body", { ref, error: e });
      return json(request, { ok: false, errors: ["Invalid request body"] }, 400);
    }

    // Honeypot check: if the hidden field is filled, treat as spam and bail early.
    if (honeypot) {
      console.warn("Honeypot triggered; dropping submission", { ref, vin, email });
      return json(request, { ok: true, message: "Submitted." });
    }

    // --------- Server-side validation (authoritative) ---------
    // - Customer Information: always required.
    // - Warranty Claim Information: always required.
    // - Dealer Information: required only when 'claim_submitted_by' === 'dealer'.
    const errors = [];

    // VIN is always required and must pass the standard 17-char pattern (no I, O, Q)
    if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) {
      errors.push("VIN must be 17 chars (no I, O, Q).");
    }

    // Customer Information — required for all submissions
    if (!customer_first_name) errors.push("Customer first name is required.");
    if (!customer_last_name) errors.push("Customer last name is required.");
    if (!customer_address) errors.push("Customer address is required.");
    if (!customer_city) errors.push("Customer city is required.");
    if (!customer_region) errors.push("Customer state/region is required.");
    if (!customer_postal_code) errors.push("Customer postal/ZIP code is required.");
    if (!customer_country) errors.push("Customer country is required.");
    if (!customer_phone) errors.push("Customer phone is required.");

    if (!customer_email) {
      errors.push("Customer email is required.");
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer_email)) {
      errors.push("Customer email is invalid.");
    }

    // Warranty Claim Information — required for all submissions
    if (!date_of_occurrence) {
      errors.push("Date of occurrence is required.");
    }
    if (!ship_to) {
      errors.push("Ship-to information is required.");
    }
    if (!warranty_symptoms) {
      errors.push("Warranty symptoms are required.");
    }
    if (!warranty_request) {
      errors.push("Warranty request is required.");
    }
    // Note: labor_rate and labor_hours remain optional; they may not apply to all claims.

    // Dealer Information — only required when dealer is submitting the claim
    if (claim_submitted_by === "dealer") {
      if (!dealer_name) {
        errors.push("Dealership name is required when the dealer is submitting the claim.");
      }
      if (!dealer_first_name) {
        errors.push("Dealer first name is required when the dealer is submitting the claim.");
      }
      if (!dealer_last_name) {
        errors.push("Dealer last name is required when the dealer is submitting the claim.");
      }
      if (!dealer_address) {
        errors.push("Dealer address is required when the dealer is submitting the claim.");
      }
      if (!dealer_city) {
        errors.push("Dealer city is required when the dealer is submitting the claim.");
      }
      if (!dealer_region) {
        errors.push("Dealer state/region is required when the dealer is submitting the claim.");
      }
      if (!dealer_postal_code) {
        errors.push("Dealer postal/ZIP code is required when the dealer is submitting the claim.");
      }
      if (!dealer_country) {
        errors.push("Dealer country is required when the dealer is submitting the claim.");
      }
      if (!dealer_phone) {
        errors.push("Dealer phone is required when the dealer is submitting the claim.");
      }
      if (!dealer_email) {
        errors.push("Dealer email is required when the dealer is submitting the claim.");
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(dealer_email)) {
        errors.push("Dealer email is invalid.");
      }
    }

    if (errors.length || attachmentErrors.length) {
      return json(
        request,
        { ok: false, errors: [...errors, ...attachmentErrors] },
        400
      );
    }

    const submission = {
      ref,
      vin,
      email: email.toLowerCase(),
      category,
      claim_submitted_by,
      original_owner,
      contact: {
        dealer_name,
        dealer_first_name,
        dealer_last_name,
        dealer_address,
        dealer_city,
        dealer_region,
        dealer_postal_code,
        dealer_country,
        dealer_phone,
        dealer_email,
        customer_first_name,
        customer_last_name,
        customer_address,
        customer_city,
        customer_region,
        customer_postal_code,
        customer_country,
        customer_phone,
        customer_email
      },
      ticket: {
        trailer_vin: vin,
        warranty_date_of_occurrence: date_of_occurrence,
        warranty_ship_to: ship_to,
        warranty_symptoms,
        warranty_request,
        warranty_labor_rate: labor_rate,
        warranty_labor_hours: labor_hours,
        hs_file_upload: attachmentFileNames.join(", "),
        hs_ticket_category: category
      }
    };

    // 5) Claim number via Durable Object
    const doId = env.CLAIM_COUNTER.idFromName("global");
    const doStub = env.CLAIM_COUNTER.get(doId);
    const { n: claimNumber } = await doStub
      .fetch("https://counter/next", { method: "POST" })
      .then(r => r.json());

    console.log("Claim number generated", { ref, claimNumber, vin });

    // 6) Contact upsert (by primary email)
    let contactId = null;
    try {
      const contactProps = {
        email: submission.email,
        dealer: dealer_name,
        dealer_first_name,
        dealer_last_name,
        dealer_address,
        dealer_city,
        dealer_state: dealer_region,
        dealer_zip: dealer_postal_code,
        dealer_country,
        dealer_phone,
        dealer_email,
        customer_first_name,
        customer_last_name,
        customer_address,
        customer_city,
        customer_state: customer_region,
        customer_zip: customer_postal_code,
        customer_country,
        customer_phone,
        customer_email
      };
      contactId = await hsUpsertContact(env, submission.email, contactProps);
      console.log("HS contactId", { ref, claimNumber, contactId });
    } catch (e) {
      console.error("HS contact upsert failed", { ref, claimNumber, error: e });
    }

    // 7) Ticket create in Warranty pipeline
    let ticketId = null;
    let ticketError = null;

    // Friendly strings
    const friendlySubmittedBy =
      claim_submitted_by === "dealer"
        ? "Dealer"
        : claim_submitted_by === "customer"
        ? "Trailer Owner"
        : "N/A";

    const friendlyOriginalOwner =
      original_owner === "yes"
        ? "Yes"
        : original_owner === "no"
        ? "No"
        : original_owner
        ? original_owner
        : "N/A";

    // Build nicely separated content sections (no Category / Attachments section)
    const ticketContentLines = [
      "Warranty intake via website form.",
      "",
      `Claim #: ${claimNumber}`,
      `VIN: ${submission.vin}`
    ];

    if (claim_submitted_by) {
      ticketContentLines.push(`Submitted By: ${friendlySubmittedBy}`);
    }

    ticketContentLines.push(
      "",
      "=== Dealer Information ===",
      `Dealership: ${dealer_name || "N/A"}`,
      `Name: ${
        [dealer_first_name, dealer_last_name].filter(Boolean).join(" ") || "N/A"
      }`,
      `Email: ${dealer_email || "N/A"}`,
      `Phone: ${dealer_phone || "N/A"}`,
      `Address: ${
        [
          dealer_address,
          dealer_city,
          dealer_region,
          dealer_postal_code,
          dealer_country
        ]
          .filter(Boolean)
          .join(", ") || "N/A"
      }`,
      "",
      "=== Customer Information ===",
      `Name: ${
        [customer_first_name, customer_last_name].filter(Boolean).join(" ") || "N/A"
      }`,
      `Email: ${customer_email || "N/A"}`,
      `Phone: ${customer_phone || "N/A"}`,
      `Address: ${
        [
          customer_address,
          customer_city,
          customer_region,
          customer_postal_code,
          customer_country
        ]
          .filter(Boolean)
          .join(", ") || "N/A"
      }`
    );

    if (claim_submitted_by === "customer") {
      ticketContentLines.push(`Original Owner: ${friendlyOriginalOwner}`);
    }

    ticketContentLines.push(
      "",
      "=== Warranty Claim Information ===",
      `Date of Occurrence: ${date_of_occurrence || "N/A"}`,
      `Ship To: ${ship_to || "N/A"}`,
      "Warranty Symptoms:",
      warranty_symptoms || "N/A",
      "Warranty Request:",
      warranty_request || "N/A"
    );

    // Only include these lines if values are present, after Warranty Request
    if (labor_rate || labor_hours) {
      if (labor_rate) {
        ticketContentLines.push(`Labor Rate: ${labor_rate}`);
      }

      if (labor_hours) {
        ticketContentLines.push(`Labor Hours: ${labor_hours}`);
      }
    }

    const ticketContent = ticketContentLines.join("\n");

    try {
      const pipeline = env.HS_TICKET_PIPELINE || "760934225";
      const stage = env.HS_TICKET_STAGE || "1108043102"; // New

      // Trailer number / short VIN: 10th char + last 4 chars (positions 14–17)
      const trailerNumber =
        vin && vin.length === 17
          ? vin.charAt(9) + vin.slice(13) // e.g., VIN 5A7BB2221ST004529 -> S4529
          : vin; // fallback to full VIN if something is off

      // Build subject line with dealer / trailer owner name
      const dealerFullName = [dealer_first_name, dealer_last_name].filter(Boolean).join(" ");
      const customerFullName = [customer_first_name, customer_last_name].filter(Boolean).join(" ");

      let subjectName = "";

      if (claim_submitted_by === "customer") {
        // Trailer owner -> customer full name
        subjectName = customerFullName;
      } else if (claim_submitted_by === "dealer") {
        // Dealer -> dealership name
        subjectName = dealer_name;
      }

      // Fallbacks if claim_submitted_by is missing or names are blank
      if (!subjectName) {
        subjectName = customerFullName || dealer_name || dealerFullName;
      }

      const subjectLine = subjectName
        ? `Warranty Claim #${claimNumber} - ${subjectName} - ${trailerNumber}`
        : `Warranty Claim #${claimNumber} - ${trailerNumber}`;

      const ticketProps = {
        hs_pipeline: pipeline,
        hs_pipeline_stage: stage,
        subject: subjectLine,
        content: ticketContent,
        trailer_vin: submission.ticket.trailer_vin,
        warranty_date_of_occurrence: submission.ticket.warranty_date_of_occurrence,
        warranty_ship_to: submission.ticket.warranty_ship_to,
        warranty_symptoms: submission.ticket.warranty_symptoms,
        warranty_request: submission.ticket.warranty_request,
        warranty_labor_rate: submission.ticket.warranty_labor_rate,
        warranty_labor_hours: submission.ticket.warranty_labor_hours,
        hs_file_upload: submission.ticket.hs_file_upload,
        hs_ticket_category: submission.ticket.hs_ticket_category,
        claim_submitted_by,
        original_owner
      };

      ticketId = await hsCreateTicket(env, ticketProps);
      console.log("HS ticketId", { ref, claimNumber, ticketId });
    } catch (e) {
      console.error("HS ticket create failed", {
        ref,
        claimNumber,
        error: e instanceof Error ? e.message : String(e)
      });
      ticketError = e instanceof Error ? e.message : String(e);
    }

    // 7b) Associate ticket with Contact and Company (if available)
    if (ticketId && contactId && env.HUBSPOT_TOKEN) {
      try {
        await hsAssociateTicketToContact(env, ticketId, contactId);
        console.log("Associated ticket to contact", { ref, claimNumber, ticketId, contactId });
      } catch (e) {
        console.error("Ticket<->contact association failed", {
          ref,
          claimNumber,
          error: e
        });
      }

      try {
        const companyId = await hsGetPrimaryCompanyIdForContact(env, contactId);
        if (companyId) {
          await hsAssociateTicketToCompany(env, ticketId, companyId);
          console.log("Associated ticket to company", { ref, claimNumber, ticketId, companyId });
        }
      } catch (e) {
        console.error("Ticket<->company association failed", {
          ref,
          claimNumber,
          error: e
        });
      }
    }

    // 8) Upload attachments to HubSpot Files + Note with hs_attachment_ids
    let noteId = null;
    const attachmentFileIds = [];
    let attachmentsError = null;

    if (ticketId && attachmentFiles.length && env.HUBSPOT_TOKEN) {
      try {
        // 8a) Upload files to HubSpot Files
        for (const file of attachmentFiles) {
          const uploaded = await hsUploadFile(env, file);
          if (uploaded && uploaded.id) {
            attachmentFileIds.push(String(uploaded.id));
          }
        }

        // 8b) Create a Note associated to the Ticket with hs_attachment_ids
        if (attachmentFileIds.length) {
          noteId = await hsCreateNoteWithAttachments(
            env,
            ticketId,
            claimNumber,
            attachmentFileIds,
            submission.vin
          );
          console.log("HS noteId (attachments)", { ref, claimNumber, noteId });
        }
      } catch (e) {
        console.error("Attachment upload / note create failed", {
          ref,
          claimNumber,
          error: e
        });
        attachmentsError =
          e && e.message
            ? `HubSpot error: ${e.message}`
            : "Unknown error while creating attachment note";
      }
    }

    // 9) Confirmation email (Brevo)
    const emailConfigured =
      env.EMAIL_ENABLED === "true" &&
      !!(env.EMAIL_API_ENDPOINT && env.EMAIL_API_KEY && env.FROM_EMAIL);

    let emailStatus = "skipped";

    if (emailConfigured) {
      // Trailer number / short VIN: 10th char + last 4 chars (positions 14–17)
      const trailerNumber =
        vin && vin.length === 17
          ? vin.charAt(9) + vin.slice(13)
          : vin;

      const dateSubmitted = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
      const dealerFullName = [dealer_first_name, dealer_last_name].filter(Boolean).join(" ");
      const customerFullName = [customer_first_name, customer_last_name].filter(Boolean).join(" ");

      const safeTrailerNumber = trailerNumber ? escapeHtml(trailerNumber) : "";
      const safeVin = escapeHtml(vin);
      const safeEmail = escapeHtml(email);
      const safeDealerName = escapeHtml(dealer_name || "N/A");
      const safeDealerFullName = escapeHtml(dealerFullName || "N/A");
      const safeDealerEmail = escapeHtml(dealer_email || "N/A");
      const safeDealerPhone = escapeHtml(dealer_phone || "N/A");
      const safeDealerAddress = escapeHtml(
        [
          dealer_address,
          dealer_city,
          dealer_region,
          dealer_postal_code,
          dealer_country
        ]
          .filter(Boolean)
          .join(", ") || "N/A"
      );
      const safeCustomerFullName = escapeHtml(customerFullName || "N/A");
      const safeCustomerEmail = escapeHtml(customer_email || "N/A");
      const safeCustomerPhone = escapeHtml(customer_phone || "N/A");
      const safeCustomerAddress = escapeHtml(
        [
          customer_address,
          customer_city,
          customer_region,
          customer_postal_code,
          customer_country
        ]
          .filter(Boolean)
          .join(", ") || "N/A"
      );
      const safeDateOfOccurrence = escapeHtml(date_of_occurrence || "N/A");
      const safeShipTo = escapeHtml(ship_to || "N/A");

      const symptomsHtml = escapeHtml(warranty_symptoms || "N/A").replace(/\n/g, "<br/>");
      const requestHtml = escapeHtml(warranty_request || "N/A").replace(/\n/g, "<br/>");

      const subject = trailerNumber
        ? `Boatmate Warranty Claim #${claimNumber} received for ${trailerNumber}`
        : `Boatmate Warranty Claim #${claimNumber} received`;

      const htmlParts = [];

      // Optional logo at the top of the email
      if (env.EMAIL_LOGO_URL) {
        const safeLogoUrl = escapeHtml(env.EMAIL_LOGO_URL);
        htmlParts.push(
          `<p><img src="${safeLogoUrl}" alt="Boatmate Trailers" style="max-width:200px;height:auto;" /></p>`
        );
      }

      htmlParts.push(
        "<p>Hi there,</p>",
        "<p>Thanks for submitting your Boatmate warranty request. This email is your record of the information we received. It is not an approval or denial of coverage.</p>",
        `<p><strong>Claim Summary</strong><br/>
           Claim #: ${claimNumber}<br/>
           ${safeTrailerNumber ? `Trailer #: ${safeTrailerNumber}<br/>` : ""}VIN: ${safeVin}<br/>
           Submitted By: ${escapeHtml(friendlySubmittedBy)}<br/>
           Original Owner: ${escapeHtml(friendlyOriginalOwner)}<br/>
           Date Submitted: ${escapeHtml(dateSubmitted)}</p>`,
        `<p><strong>Dealer Information</strong><br/>
           Dealership: ${safeDealerName}<br/>
           Name: ${safeDealerFullName}<br/>
           Email: ${safeDealerEmail}<br/>
           Phone: ${safeDealerPhone}<br/>
           Address: ${safeDealerAddress}</p>`,
        `<p><strong>Customer Information</strong><br/>
           Name: ${safeCustomerFullName}<br/>
           Email: ${safeCustomerEmail}<br/>
           Phone: ${safeCustomerPhone}<br/>
           Address: ${safeCustomerAddress}</p>`
      );

      // --- Warranty Claim Details (HTML) ---
      const warrantyDetailsHtmlParts = [
        `<p><strong>Warranty Claim Details</strong><br/>`,
        `Date of Occurrence: ${safeDateOfOccurrence}<br/>`,
        `Ship To: ${safeShipTo}<br/>`,
        `Warranty Symptoms: ${symptomsHtml}<br/>`,
        `Warranty Request: ${requestHtml}`
      ];

      if (labor_rate || labor_hours) {
        const safeLaborRate = labor_rate ? escapeHtml(labor_rate) : "";
        const safeLaborHours = labor_hours ? escapeHtml(labor_hours) : "";

        if (safeLaborRate) {
          warrantyDetailsHtmlParts.push(`<br/>Labor Rate: ${safeLaborRate}`);
        }
        if (safeLaborHours) {
          warrantyDetailsHtmlParts.push(`<br/>Labor Hours: ${safeLaborHours}`);
        }
      }

      warrantyDetailsHtmlParts.push(`</p>`);
      htmlParts.push(warrantyDetailsHtmlParts.join(""));

      // --- Attached Files (HTML) ---
      if (attachmentFileNames.length) {
        const items = attachmentFileNames
          .map(name => `<li>${escapeHtml(name)}</li>`)
          .join("");
        htmlParts.push(
          "<p><strong>Attached Files</strong></p>",
          `<ul>${items}</ul>`
        );
      } else {
        htmlParts.push("<p><strong>Attached Files</strong><br/>None</p>");
      }

      htmlParts.push(
        "<p>This email confirms we’ve received your warranty request. Our team will review the claim and follow up with you or your dealer with next steps.</p>",
        `<p>If any of the details above are incorrect, please reply to this email or contact Boatmate Warranty Support. Please reference <strong>Claim #${claimNumber}</strong> in any future communication.</p>`
      );

      const html = htmlParts.join("\n");

      // ---------- PLAIN-TEXT VERSION ----------
      const dealerAddressText =
        [
          dealer_address,
          dealer_city,
          dealer_region,
          dealer_postal_code,
          dealer_country
        ]
          .filter(Boolean)
          .join(", ") || "N/A";

      const customerAddressText =
        [
          customer_address,
          customer_city,
          customer_region,
          customer_postal_code,
          customer_country
        ]
          .filter(Boolean)
          .join(", ") || "N/A";

      // Trailer number / short VIN: 10th char + last 4 (14–17)
      const trailerNumberText =
        vin && vin.length === 17
          ? vin.charAt(9) + vin.slice(13)
          : "";

      const textLines = [
        "Thanks for submitting your Boatmate warranty request.",
        "This email is your record of the information we received. It is not an approval or denial of coverage.",
        "",
        "Claim Summary",
        `Claim #: ${claimNumber}`,
        trailerNumberText ? `Trailer #: ${trailerNumberText}` : "Trailer #: N/A",
        `VIN: ${vin}`,
        `Submitted By: ${friendlySubmittedBy}`,
        `Original Owner: ${friendlyOriginalOwner}`,
        `Date Submitted: ${dateSubmitted}`,
        "",
        "Dealer Information",
        `Dealership: ${dealer_name || "N/A"}`,
        `Name: ${dealerFullName || "N/A"}`,
        `Email: ${dealer_email || "N/A"}`,
        `Phone: ${dealer_phone || "N/A"}`,
        `Address: ${dealerAddressText}`,
        "",
        "Customer Information",
        `Name: ${customerFullName || "N/A"}`,
        `Email: ${customer_email || "N/A"}`,
        `Phone: ${customer_phone || "N/A"}`,
        `Address: ${customerAddressText}`
      ];

      // Warranty claim details (flat, in the order you wanted)
      textLines.push(
        "",
        "Warranty Claim Details",
        `Date of Occurrence: ${date_of_occurrence || "N/A"}`,
        `Ship To: ${ship_to || "N/A"}`,
        `Warranty Symptoms: ${warranty_symptoms || "N/A"}`,
        `Warranty Request: ${warranty_request || "N/A"}`
      );

      // Optional labor fields, only if present (no extra header)
      if (labor_rate) {
        textLines.push(`Labor Rate: ${labor_rate}`);
      }

      if (labor_hours) {
        textLines.push(`Labor Hours: ${labor_hours}`);
      }

      // Attached files list
      if (attachmentFileNames.length) {
        textLines.push(
          "Attached Files:",
          ...attachmentFileNames.map(name => `* ${name}`)
        );
      } else {
        textLines.push("Attached Files: None");
      }

      textLines.push(
        "",
        "This email confirms we’ve received your warranty request. Our team will review the claim and follow up with you or your dealer with next steps.",
        `If any of the details above are incorrect, please reply to this email or contact Boatmate Warranty Support. Please reference Claim #${claimNumber} in any future communication.`
      );

      const text = textLines.join("\n");

      try {
        await sendEmail(env, { to: email, from: env.FROM_EMAIL, subject, html, text });
        emailStatus = "sent";
      } catch (err) {
        console.error("Email send failed", { ref, claimNumber, error: err });
        emailStatus = "failed";
      }
    }

    const message =
      emailStatus === "sent"
        ? "Submitted. Confirmation email sent."
        : emailStatus === "failed"
        ? "Submitted. Email delivery is currently unavailable; we’ll follow up."
        : "Submitted. (Email not configured in this environment.)";

    return json(request, {
      ok: true,
      claimNumber,
      ref,
      contactId,
      ticketId,
      noteId,
      emailStatus,
      message,
      ticketError,
      attachmentFileNames,
      attachmentFileIds,
      attachmentsError
    });
  }
};

// ------------------------ HTTP / CORS helpers ------------------------
function handlePreflight(request) {
  const reqMethod = request.headers.get("Access-Control-Request-Method") || "POST";
  const reqHeaders =
    request.headers.get("Access-Control-Request-Headers") || "content-type";
  const origin = request.headers.get("Origin") || "";

  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": allowOrigin(origin),
      "Access-Control-Allow-Methods": reqMethod,
      "Access-Control-Allow-Headers": reqHeaders,
      "Access-Control-Max-Age": "86400",
      Vary: "Origin"
    }
  });
}

function corsHeaders(request) {
  const origin = request.headers.get("Origin") || "";
  const reqHeaders =
    request.headers.get("Access-Control-Request-Headers") || "content-type";
  return {
    "Access-Control-Allow-Origin": allowOrigin(origin),
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": reqHeaders,
    "Access-Control-Max-Age": "86400",
    Vary: "Origin"
  };
}

function allowOrigin(origin) {
  if (origin && ALLOWED_ORIGINS.has(origin)) return origin;
  return DEV_FALLBACK_STAR ? "*" : "";
}

function json(request, body, status = 200) {
  const headers = { "content-type": "application/json", ...corsHeaders(request) };
  return new Response(JSON.stringify(body), { status, headers });
}

function escapeHtml(str = "") {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

// ------------------------ Email (Brevo) ------------------------
async function sendEmail(env, { to, from, subject, html, text }) {
  const endpoint = env.EMAIL_API_ENDPOINT || "https://api.brevo.com/v3/smtp/email";
  const apiKey = env.EMAIL_API_KEY;
  const fromEmail = from || env.FROM_EMAIL;
  const fromName = env.FROM_NAME || undefined;
  const replyTo = env.REPLY_TO || undefined;

  if (!apiKey || !fromEmail) {
    throw new Error("Missing EMAIL_API_KEY or FROM_EMAIL for Brevo.");
  }

  const payload = {
    sender: { email: fromEmail, ...(fromName ? { name: fromName } : {}) },
    to: [{ email: to }],
    subject,
    htmlContent: html,
    textContent: text,
    ...(replyTo ? { replyTo: { email: replyTo } } : {})
  };

  const resp = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", "api-key": apiKey },
    body: JSON.stringify(payload)
  });

  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    throw new Error(`Brevo send failed ${resp.status}: ${body.slice(0, 300)}`);
  }
}

// ------------------------ HubSpot helpers ------------------------
const HS_BASE = "https://api.hubapi.com";

// JSON-only HubSpot helper (NOT for multipart)
async function hsRequest(env, path, init = {}) {
  const url = `${HS_BASE}${path}`;
  const headers = new Headers(init.headers || {});
  headers.set("Authorization", `Bearer ${env.HUBSPOT_TOKEN}`);
  headers.set("Content-Type", "application/json");

  const resp = await fetch(url, { ...init, headers });
  const text = await resp.text();

  let json = {};
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = {};
    }
  }

  if (!resp.ok) {
    const code = json?.status || resp.status;
    const msg = json?.message || json?.error || `HTTP ${resp.status}`;
    throw new Error(`HubSpot ${code}: ${msg}`);
  }
  return json;
}

async function hsFindContactByEmail(env, email) {
  const body = {
    filterGroups: [
      { filters: [{ propertyName: "email", operator: "EQ", value: email.toLowerCase() }] }
    ],
    properties: ["email"],
    limit: 1
  };
  const res = await hsRequest(env, "/crm/v3/objects/contacts/search", {
    method: "POST",
    body: JSON.stringify(body)
  });
  const hit = Array.isArray(res?.results) && res.results[0];
  return hit ? hit.id : null;
}

async function hsCreateContact(env, props) {
  const res = await hsRequest(env, "/crm/v3/objects/contacts", {
    method: "POST",
    body: JSON.stringify({ properties: props })
  });
  return res?.id || null;
}

async function hsUpsertContact(env, email, props = {}) {
  if (!env.HUBSPOT_TOKEN) throw new Error("HUBSPOT_TOKEN missing");
  if (!email) throw new Error("Email required for contact upsert");

  const existingId = await hsFindContactByEmail(env, email);
  if (existingId) return existingId;

  const createProps = { email: email.toLowerCase(), ...props };
  const newId = await hsCreateContact(env, createProps);
  if (!newId) throw new Error("Failed to create contact");
  return newId;
}

async function hsCreateTicket(env, props) {
  const res = await hsRequest(env, "/crm/v3/objects/tickets", {
    method: "POST",
    body: JSON.stringify({ properties: props })
  });
  return res?.id || null;
}

// -------- Associations helpers: Ticket <-> Contact / Company --------
async function hsAssociateTicketToContact(env, ticketId, contactId) {
  if (!env.HUBSPOT_TOKEN) {
    throw new Error("HUBSPOT_TOKEN missing for associations");
  }
  if (!ticketId || !contactId) {
    throw new Error("ticketId and contactId required for ticket<->contact association");
  }

  // Default unlabeled association between ticket and contact
  await hsRequest(
    env,
    `/crm/v4/objects/ticket/${ticketId}/associations/default/contact/${contactId}`,
    { method: "PUT" }
  );
}

async function hsGetPrimaryCompanyIdForContact(env, contactId) {
  if (!env.HUBSPOT_TOKEN) {
    throw new Error("HUBSPOT_TOKEN missing for associations");
  }
  if (!contactId) return null;

  const res = await hsRequest(
    env,
    `/crm/v4/objects/contact/${contactId}/associations/company`,
    { method: "GET" }
  );

  const results = Array.isArray(res?.results) ? res.results : [];
  if (!results.length) return null;

  // Prefer Primary company (typeId === 1), else fall back to first
  const primary = results.find(r =>
    Array.isArray(r.associationTypes) &&
    r.associationTypes.some(
      t => t.category === "HUBSPOT_DEFINED" && t.typeId === 1
    )
  );

  const picked = primary || results[0];
  const companyId = picked && picked.toObjectId;
  return companyId ? String(companyId) : null;
}

async function hsAssociateTicketToCompany(env, ticketId, companyId) {
  if (!env.HUBSPOT_TOKEN) {
    throw new Error("HUBSPOT_TOKEN missing for associations");
  }
  if (!ticketId || !companyId) {
    throw new Error("ticketId and companyId required for ticket<->company association");
  }

  await hsRequest(
    env,
    `/crm/v4/objects/ticket/${ticketId}/associations/default/company/${companyId}`,
    { method: "PUT" }
  );
}

// Cache the note<->ticket associationTypeId so we only look it up once per worker instance
let cachedNoteTicketAssociationTypeId = null;

async function hsGetNoteTicketAssociationTypeId(env) {
  if (cachedNoteTicketAssociationTypeId !== null) {
    return cachedNoteTicketAssociationTypeId;
  }

  if (!env.HUBSPOT_TOKEN) {
    throw new Error("HUBSPOT_TOKEN missing for associations");
  }

  // Get association labels for notes <-> tickets
  const res = await hsRequest(env, "/crm/v4/associations/notes/tickets/labels", {
    method: "GET"
  });

  const results = Array.isArray(res?.results) ? res.results : [];
  if (!results.length) {
    throw new Error("No association labels returned for notes<->tickets");
  }

  // Prefer a HUBSPOT_DEFINED association (the default unlabeled association),
  // otherwise just use the first available type.
  const label =
    results.find(r => r.category === "HUBSPOT_DEFINED") ||
    results[0];

  // HubSpot returns `typeId` as the numeric identifier for the association type.
  const typeId =
    (typeof label.typeId === "number" && label.typeId) ||
    (typeof label.associationTypeId === "number" && label.associationTypeId) ||
    null;

  if (!typeId) {
    console.error("Unexpected notes<->tickets label payload:", JSON.stringify(label));
    throw new Error("No numeric typeId/associationTypeId found for notes<->tickets");
  }

  cachedNoteTicketAssociationTypeId = typeId;
  return typeId;
}

// -------- Files API: upload a single file (multipart/form-data) --------
async function hsUploadFile(env, file) {
  if (!env.HUBSPOT_TOKEN) {
    throw new Error("HUBSPOT_TOKEN missing for Files API");
  }

  const fd = new FormData();

  // File field
  fd.append("file", file, file.name || "attachment");

  // Required options: at minimum, access level
  fd.append(
    "options",
    JSON.stringify({
      access: "PRIVATE" // so it’s usable as a CRM attachment, not a public asset
    })
  );

  // Folder path is required by Files v3; use env override or default
  const folderPath = env.HS_FILES_FOLDER_PATH || "/warranty-intake";
  fd.append("folderPath", folderPath);

  const resp = await fetch("https://api.hubapi.com/files/v3/files", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.HUBSPOT_TOKEN}`
      // DO NOT set Content-Type; fetch will set proper multipart boundary
    },
    body: fd
  });

  const text = await resp.text().catch(() => "");
  let json = {};
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = {};
    }
  }

  if (!resp.ok) {
    console.error("HubSpot Files upload failed", resp.status, text);
    const msg = json?.message || text.slice(0, 300);
    throw new Error(`HubSpot Files ${resp.status}: ${msg}`);
  }

  return json; // includes id, name, url, etc.
}

// -------- Notes API: create note with hs_attachment_ids on a ticket --------
async function hsCreateNoteWithAttachments(env, ticketId, claimNumber, fileIds, vin) {
  if (!env.HUBSPOT_TOKEN) throw new Error("HUBSPOT_TOKEN missing for Notes API");
  if (!ticketId) throw new Error("ticketId required for note association");
  if (!fileIds || !fileIds.length) throw new Error("fileIds required for hs_attachment_ids");

  const nowIso = new Date().toISOString();
  const hs_attachment_ids = fileIds.join(";");

  // Look up the numeric associationTypeId for note<->ticket
  const associationTypeId = await hsGetNoteTicketAssociationTypeId(env);

  const body = {
    properties: {
      hs_timestamp: nowIso,
      hs_note_body: `Warranty attachments uploaded via intake form for Claim #${claimNumber} (VIN ${vin}).`,
      hs_attachment_ids
    },
    associations: [
      {
        to: { id: ticketId },
        types: [
          {
            associationCategory: "HUBSPOT_DEFINED",
            associationTypeId
          }
        ]
      }
    ]
  };

  const res = await hsRequest(env, "/crm/v3/objects/notes", {
    method: "POST",
    body: JSON.stringify(body)
  });

  return res?.id || null;
}
