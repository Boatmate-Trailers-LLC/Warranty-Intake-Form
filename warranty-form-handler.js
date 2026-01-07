// warranty-form-handler.js
/**
 * Boatmate — Warranty Intake (Dealer Form Only) — Cloudflare Worker
 * ================================================================
 *
 * STATUS
 * - Stable (Dealer form live / hard changeover)
 *
 * LAST UPDATED
 * - 2026-01-06
 *
 * PURPOSE
 * - Receive dealer-submitted warranty claims from the Dealer Warranty Intake HTML form.
 * - Validate inputs + attachments.
 * - Generate a sequential Claim # (Durable Object).
 * - Create/Upsert HubSpot CRM records (Contact + Ticket).
 * - Upload attachments to HubSpot Files (PRIVATE) + attach via a Note.
 * - Optionally send a confirmation email via Brevo.
 *
 * HARD BUSINESS RULES (DO NOT DRIFT)
 * - Dealer-only submissions:
 *    • claim_submitted_by MUST equal "dealer"
 * - Sold Unit toggle drives Customer requirements:
 *    • is_sold_unit MUST be "yes" or "no"
 *    • Customer first/last are REQUIRED ONLY when is_sold_unit === "yes"
 * - Customer Information is name-only:
 *    • NO customer address/phone/email on dealer form
 * - "Ship To" is removed entirely:
 *    • Do not parse, validate, store, or map it anywhere
 * - Labor rate is NOT part of this project:
 *    • Do not parse, validate, store, or map labor_rate
 *
 * ANTI-SPAM
 * - Honeypot supported field names: "honeypot", "_hp", "website"
 * - If honeypot is filled, respond OK without processing (silent drop)
 *
 * REQUEST CONTRACT
 * - Primary: multipart/form-data
 * - Supported: application/json
 * - Attachments: input name="attachments" (multiple), max 10 files, max 10MB each
 *
 * RESPONSE CONTRACT (JSON)
 * - Success: { ok:true, claimNumber, ... }
 * - Error:   { ok:false, errors:[...], ... } (HTTP 400 for validation)
 */

const ALLOWED_ORIGINS = new Set([
  "http://127.0.0.1:5500",
  "https://boatmateparts.com",
  "https://www.boatmateparts.com",
  "http://boatmateparts.com",
  "http://www.boatmateparts.com"
]);

// If true, returns "*" for Access-Control-Allow-Origin when origin is not in ALLOWED_ORIGINS.
// Keep false for production safety.
const DEV_FALLBACK_STAR = false;

// Attachment limits (should match your front-end)
const MAX_ATTACHMENT_FILES = 10;
const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024; // 10MB per file

// HubSpot API base
const HS_BASE = "https://api.hubapi.com";

/* -------------------------------------------------------------------------- */
/* Durable Object: ClaimCounter                                                */
/* -------------------------------------------------------------------------- */
/**
 * Stores an integer counter and returns the next value.
 * - Storage key: "n"
 * - Starts at 100000, returns 100001+ sequentially
 */
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

/* -------------------------------------------------------------------------- */
/* Worker                                                                       */
/* -------------------------------------------------------------------------- */
export default {
  async fetch(request, env) {
    // Correlation ID for log tracing across steps
    const ref = crypto.randomUUID();

    // CORS preflight
    if (request.method === "OPTIONS") return handlePreflight(request);

    // Only POST supported
    if (request.method !== "POST") {
      return new Response("Method Not Allowed", {
        status: 405,
        headers: corsHeaders(request)
      });
    }

    const contentType = (request.headers.get("content-type") || "").toLowerCase();

    // Parsed payload values (initialize everything explicitly)
    const parsed = initParsedPayload();

    // File collection (from multipart)
    const attachments = {
      files: [],
      fileNames: [],
      errors: []
    };

    /* -------------------- Parse incoming request -------------------- */
    try {
      if (contentType.includes("application/json")) {
        const body = await request.json().catch(() => ({}));
        parseJsonBodyInto(parsed, body);
      } else {
        const form = await request.formData();
        parseFormDataInto(parsed, form, attachments);
      }
    } catch (err) {
      console.error("Invalid request body", { ref, error: err });
      return jsonResponse(request, { ok: false, errors: ["Invalid request body"] }, 400);
    }

    /* -------------------- Honeypot: silent drop -------------------- */
    if (parsed.honeypot) {
      console.warn("Honeypot triggered; dropping submission", {
        ref,
        vin: parsed.vin,
        dealer_email: parsed.dealer_email
      });
      return jsonResponse(request, { ok: true, message: "Submitted." });
    }

    /* -------------------- Validate (hard changeover; dealer-only) -------------------- */
    const errors = validateDealerSubmission(parsed);

    // Attachments are REQUIRED for dealer submissions
    if (attachments.files.length === 0) {
      errors.push("At least one attachment is required.");
    }

    // Multipart validation can add errors during parsing (size, count, etc.)
    if (errors.length || attachments.errors.length) {
      return jsonResponse(
        request,
        { ok: false, errors: [...errors, ...attachments.errors] },
        400
      );
    }

    // Canonical submission email (dealer email is the only email on this form)
    const submissionEmail = parsed.dealer_email.toLowerCase();

    /* -------------------- Claim number via Durable Object -------------------- */
    let claimNumber;
    try {
      claimNumber = await nextClaimNumber(env);
      console.log("Claim number generated", { ref, claimNumber, vin: parsed.vin });
    } catch (err) {
      console.error("Claim number generation failed", { ref, error: err });
      return jsonResponse(request, { ok: false, errors: ["Unable to generate claim number"] }, 500);
    }

    /* -------------------- HubSpot: upsert Contact (by dealer email) -------------------- */
    let contactId = null;
    try {
      const contactProps = compactProps({
        email: submissionEmail,

        // HubSpot contact properties (align to your portal’s naming)
        dealer: parsed.dealer_name,
        dealer_first_name: parsed.dealer_first_name,
        dealer_last_name: parsed.dealer_last_name,
        dealer_address: parsed.dealer_address,
        dealer_city: parsed.dealer_city,
        dealer_state: parsed.dealer_region,
        dealer_zip: parsed.dealer_postal_code,
        dealer_country: parsed.dealer_country,
        dealer_phone: parsed.dealer_phone,
        dealer_email: submissionEmail,

        // Customer name only (by design; may be blank if sold-unit = no)
        customer_first_name: parsed.customer_first_name,
        customer_last_name: parsed.customer_last_name
      });

      contactId = await hsUpsertContact(env, submissionEmail, contactProps);
      console.log("HS contactId", { ref, claimNumber, contactId });
    } catch (err) {
      // Non-fatal — ticket can still be created
      console.error("HS contact upsert failed", { ref, claimNumber, error: err });
    }

    /* -------------------- HubSpot: create Ticket -------------------- */
    let ticketId = null;
    let ticketError = null;

    const trailerNumber = getTrailerNumberFromVin(parsed.vin);
    const dealerContactName = joinName(parsed.dealer_first_name, parsed.dealer_last_name);
    const customerName = joinName(parsed.customer_first_name, parsed.customer_last_name);

    const subjectLine = `Warranty Claim #${claimNumber} - ${
      parsed.dealer_name || dealerContactName || "Dealer"
    } - ${trailerNumber}`;

    const ticketContent = buildTicketContent({
      claimNumber,
      vin: parsed.vin,
      dealer: {
        name: parsed.dealer_name,
        contactName: dealerContactName,
        email: submissionEmail,
        phone: parsed.dealer_phone,
        address: joinAddress([
          parsed.dealer_address,
          parsed.dealer_city,
          parsed.dealer_region,
          parsed.dealer_postal_code,
          parsed.dealer_country
        ])
      },
      customerName,
      claim: {
        date_of_occurrence: parsed.date_of_occurrence,
        warranty_symptoms: parsed.warranty_symptoms,
        warranty_request: parsed.warranty_request,
        labor_hours: parsed.labor_hours
      }
    });

    try {
      const pipeline = env.HS_TICKET_PIPELINE || "760934225";
      const stage = env.HS_TICKET_STAGE || "1108043102"; // New

      const ticketProps = compactProps({
        hs_pipeline: pipeline,
        hs_pipeline_stage: stage,

        subject: subjectLine,
        content: ticketContent,

        // Ticket properties your portal expects
        trailer_vin: parsed.vin,
        warranty_date_of_occurrence: parsed.date_of_occurrence,
        warranty_symptoms: parsed.warranty_symptoms,
        warranty_request: parsed.warranty_request,
        warranty_labor_hours: parsed.labor_hours || undefined,

        hs_file_upload: attachments.fileNames.join(", "),
        hs_ticket_category: parsed.category,

        // Internal classification
        claim_submitted_by: parsed.claim_submitted_by
      });

      ticketId = await hsCreateTicket(env, ticketProps);
      console.log("HS ticketId", { ref, claimNumber, ticketId });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("HS ticket create failed", { ref, claimNumber, error: msg });
      ticketError = msg;
    }

    /* -------------------- HubSpot: associate Ticket to Contact + Company -------------------- */
    if (ticketId && contactId && env.HUBSPOT_TOKEN) {
      // Ticket ↔ Contact
      try {
        await hsAssociateTicketToContact(env, ticketId, contactId);
        console.log("Associated ticket to contact", { ref, claimNumber, ticketId, contactId });
      } catch (err) {
        console.error("Ticket<->contact association failed", { ref, claimNumber, error: err });
      }

      // Ticket ↔ Primary Company (if contact has one)
      try {
        const companyId = await hsGetPrimaryCompanyIdForContact(env, contactId);
        if (companyId) {
          await hsAssociateTicketToCompany(env, ticketId, companyId);
          console.log("Associated ticket to company", { ref, claimNumber, ticketId, companyId });
        }
      } catch (err) {
        console.error("Ticket<->company association failed", { ref, claimNumber, error: err });
      }
    }

    /* -------------------- HubSpot: upload attachments + create a Note -------------------- */
    let noteId = null;
    const attachmentFileIds = [];
    let attachmentsError = null;

    if (ticketId && attachments.files.length && env.HUBSPOT_TOKEN) {
      try {
        for (const file of attachments.files) {
          const uploaded = await hsUploadFile(env, file);
          if (uploaded?.id) attachmentFileIds.push(String(uploaded.id));
        }

        if (attachmentFileIds.length) {
          noteId = await hsCreateNoteWithAttachments(env, ticketId, claimNumber, attachmentFileIds, parsed.vin);
          console.log("HS noteId (attachments)", { ref, claimNumber, noteId });
        }
      } catch (err) {
        console.error("Attachment upload / note create failed", { ref, claimNumber, error: err });
        attachmentsError = err?.message
          ? `HubSpot error: ${err.message}`
          : "Unknown error while creating attachment note";
      }
    }

    /* -------------------- Confirmation Email (Brevo) -------------------- */
    const emailConfigured =
      env.EMAIL_ENABLED === "true" &&
      Boolean(env.EMAIL_API_ENDPOINT && env.EMAIL_API_KEY && env.FROM_EMAIL);

    let emailStatus = "skipped";

    if (emailConfigured) {
      try {
        const emailPayload = buildConfirmationEmail({
          env,
          claimNumber,
          trailerNumber,
          vin: parsed.vin,
          date_of_occurrence: parsed.date_of_occurrence,
          dealer: {
            name: parsed.dealer_name,
            contactName: dealerContactName,
            email: submissionEmail,
            phone: parsed.dealer_phone,
            address: joinAddress([
              parsed.dealer_address,
              parsed.dealer_city,
              parsed.dealer_region,
              parsed.dealer_postal_code,
              parsed.dealer_country
            ])
          },
          customerName,
          warranty_symptoms: parsed.warranty_symptoms,
          warranty_request: parsed.warranty_request,
          labor_hours: parsed.labor_hours,
          attachmentFileNames: attachments.fileNames
        });

        await sendEmail(env, emailPayload);
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

    /* -------------------- Response -------------------- */
    return jsonResponse(request, {
      ok: true,
      claimNumber,
      ref,
      contactId,
      ticketId,
      noteId,
      emailStatus,
      message,
      ticketError,
      attachmentFileNames: attachments.fileNames,
      attachmentFileIds,
      attachmentsError
    });
  }
};

/* -------------------------------------------------------------------------- */
/* Parsing                                                                      */
/* -------------------------------------------------------------------------- */

function initParsedPayload() {
  return {
    // Core
    vin: "",
    category: "Warranty",
    claim_submitted_by: "",

    // Sold Unit toggle (yes/no)
    is_sold_unit: "",

    // Honeypot (supports aliases)
    honeypot: "",

    // Dealer
    dealer_name: "",
    dealer_first_name: "",
    dealer_last_name: "",
    dealer_address: "",
    dealer_city: "",
    dealer_region: "",
    dealer_postal_code: "",
    dealer_country: "",
    dealer_phone: "",
    dealer_email: "",

    // Customer (name only)
    customer_first_name: "",
    customer_last_name: "",

    // Warranty
    date_of_occurrence: "",
    warranty_symptoms: "",
    warranty_request: "",
    labor_hours: ""
  };
}

/**
 * JSON parsing (application/json)
 * - Keep this aligned with the form-data parsing below.
 */
function parseJsonBodyInto(out, b) {
  out.vin = toUpperTrim(b.vin);
  out.category = toTrim(b.category) || "Warranty";
  out.claim_submitted_by = toLowerTrim(b.claim_submitted_by);

  // Sold Unit toggle
  out.is_sold_unit = toLowerTrim(b.is_sold_unit);

  // Dealer
  out.dealer_name = toTrim(b.dealer_name);
  out.dealer_first_name = toTrim(b.dealer_first_name);
  out.dealer_last_name = toTrim(b.dealer_last_name);
  out.dealer_address = toTrim(b.dealer_address);
  out.dealer_city = toTrim(b.dealer_city);
  out.dealer_region = toTrim(b.dealer_region);
  out.dealer_postal_code = toTrim(b.dealer_postal_code);
  out.dealer_country = toTrim(b.dealer_country);
  out.dealer_phone = toTrim(b.dealer_phone);
  out.dealer_email = toLowerTrim(b.dealer_email);

  // Customer (name only)
  out.customer_first_name = toTrim(b.customer_first_name);
  out.customer_last_name = toTrim(b.customer_last_name);

  // Warranty
  out.date_of_occurrence = toTrim(b.date_of_occurrence);
  out.warranty_symptoms = toTrim(b.warranty_symptoms);
  out.warranty_request = toTrim(b.warranty_request);
  out.labor_hours = toTrim(b.labor_hours);

  // Honeypot aliases
  out.honeypot = toTrim(b.honeypot || b._hp || b.website);
}

/**
 * FormData parsing (multipart/form-data)
 * - Primary submission format from the HTML dealer intake form.
 * - Also collects attachments under name="attachments".
 */
function parseFormDataInto(out, f, attachments) {
  out.vin = toUpperTrim(f.get("vin"));
  out.category = toTrim(f.get("category")) || "Warranty";
  out.claim_submitted_by = toLowerTrim(f.get("claim_submitted_by"));

  // Sold Unit toggle
  out.is_sold_unit = toLowerTrim(f.get("is_sold_unit"));

  // Honeypot aliases
  out.honeypot = toTrim(f.get("honeypot") || f.get("_hp") || f.get("website"));

  // Dealer
  out.dealer_name = toTrim(f.get("dealer_name"));
  out.dealer_first_name = toTrim(f.get("dealer_first_name"));
  out.dealer_last_name = toTrim(f.get("dealer_last_name"));
  out.dealer_address = toTrim(f.get("dealer_address"));
  out.dealer_city = toTrim(f.get("dealer_city"));
  out.dealer_region = toTrim(f.get("dealer_region"));
  out.dealer_postal_code = toTrim(f.get("dealer_postal_code"));
  out.dealer_country = toTrim(f.get("dealer_country"));
  out.dealer_phone = toTrim(f.get("dealer_phone"));
  out.dealer_email = toLowerTrim(f.get("dealer_email"));

  // Customer (name only)
  out.customer_first_name = toTrim(f.get("customer_first_name"));
  out.customer_last_name = toTrim(f.get("customer_last_name"));

  // Warranty
  out.date_of_occurrence = toTrim(f.get("date_of_occurrence"));
  out.warranty_symptoms = toTrim(f.get("warranty_symptoms"));
  out.warranty_request = toTrim(f.get("warranty_request"));
  out.labor_hours = toTrim(f.get("labor_hours"));

  // Attachments
  // NOTE: We only accept <input name="attachments" type="file" multiple>.
  const all = f.getAll("attachments") || [];
  for (const value of all) {
    if (!looksLikeFile(value)) continue;

    if (attachments.files.length >= MAX_ATTACHMENT_FILES) {
      attachments.errors.push(
        `Too many attachments. Maximum is ${MAX_ATTACHMENT_FILES} files per submission.`
      );
      break;
    }

    if (typeof value.size === "number" && value.size > MAX_ATTACHMENT_SIZE_BYTES) {
      attachments.errors.push(
        `Attachment "${value.name}" is too large. Maximum size is 10 MB per file.`
      );
      break;
    }

    attachments.files.push(value);
    if (value.name) attachments.fileNames.push(value.name);
  }
}

/* -------------------------------------------------------------------------- */
/* Validation                                                                   */
/* -------------------------------------------------------------------------- */
/**
 * Server-side validation is authoritative.
 * - The front-end disables hidden conditional fields so they won't submit.
 * - The Worker must enforce conditional rules based on `is_sold_unit`.
 */
function validateDealerSubmission(p) {
  const errors = [];

  // Dealer-only hard changeover
  if (p.claim_submitted_by !== "dealer") {
    errors.push("claim_submitted_by must be 'dealer'.");
  }

  // VIN format (no checksum)
  if (!isValidVin(p.vin)) {
    errors.push("VIN must be 17 chars (no I, O, Q).");
  }

  // Dealer required
  if (!p.dealer_name) errors.push("Dealership is required.");
  if (!p.dealer_first_name) errors.push("Dealer first name is required.");
  if (!p.dealer_last_name) errors.push("Dealer last name is required.");
  if (!p.dealer_address) errors.push("Dealer address is required.");
  if (!p.dealer_city) errors.push("Dealer city is required.");
  if (!p.dealer_region) errors.push("Dealer state/region is required.");
  if (!p.dealer_postal_code) errors.push("Dealer postal/ZIP code is required.");
  if (!p.dealer_country) errors.push("Dealer country is required.");
  if (!p.dealer_phone) errors.push("Dealer phone is required.");

  if (!p.dealer_email) {
    errors.push("Dealer email is required.");
  } else if (!isValidEmail(p.dealer_email)) {
    errors.push("Dealer email is invalid.");
  }

  // Sold Unit selection (must be yes/no)
  if (p.is_sold_unit !== "yes" && p.is_sold_unit !== "no") {
    errors.push('Please select "Yes" or "No" for "Is this a sold unit?"');
  }

  // Customer name is required ONLY when sold-unit = yes
  if (p.is_sold_unit === "yes") {
    if (!p.customer_first_name) errors.push("Customer first name is required.");
    if (!p.customer_last_name) errors.push("Customer last name is required.");
  }

  // Warranty required
  if (!p.date_of_occurrence) errors.push("Date of occurrence is required.");
  if (!p.warranty_symptoms) errors.push("Warranty symptoms are required.");
  if (!p.warranty_request) errors.push("Warranty request is required.");
  if (!p.labor_hours) errors.push("Warranty labor hours is required.");

  return errors;
}

/* -------------------------------------------------------------------------- */
/* Claim Number                                                                 */
/* -------------------------------------------------------------------------- */

async function nextClaimNumber(env) {
  const id = env.CLAIM_COUNTER.idFromName("global");
  const stub = env.CLAIM_COUNTER.get(id);

  const res = await stub.fetch("https://counter/next", { method: "POST" });
  const data = await res.json();

  if (!data || typeof data.n !== "number") {
    throw new Error("ClaimCounter returned invalid payload");
  }

  return data.n;
}

/* -------------------------------------------------------------------------- */
/* Ticket + Email Content Builders                                              */
/* -------------------------------------------------------------------------- */

function buildTicketContent({ claimNumber, vin, dealer, customerName, claim }) {
  const lines = [
    "Warranty intake via website dealer form.",
    "",
    `Claim #: ${claimNumber}`,
    `VIN: ${vin}`,
    "",
    "=== Dealer Information ===",
    `Dealership: ${dealer.name || "N/A"}`,
    `Dealer Contact: ${dealer.contactName || "N/A"}`,
    `Email: ${dealer.email || "N/A"}`,
    `Phone: ${dealer.phone || "N/A"}`,
    `Address: ${dealer.address || "N/A"}`,
    "",
    "=== Customer Information ===",
    `Name: ${customerName || "N/A"}`,
    "",
    "=== Warranty Claim Information ===",
    `Date of Occurrence: ${claim.date_of_occurrence || "N/A"}`,
    "Warranty Symptoms:",
    claim.warranty_symptoms || "N/A",
    "Warranty Request:",
    claim.warranty_request || "N/A"
  ];

  if (claim.labor_hours) lines.push(`Labor Hours: ${claim.labor_hours}`);

  return lines.join("\n");
}

function buildConfirmationEmail({
  env,
  claimNumber,
  trailerNumber,
  vin,
  date_of_occurrence,
  dealer,
  customerName,
  warranty_symptoms,
  warranty_request,
  labor_hours,
  attachmentFileNames
}) {
  // Convert YYYY-MM-DD -> MM-DD-YYYY (safe, no timezone surprises)
  function formatYMDToMDY(ymd) {
    const s = String(ymd || "").trim();
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return s;
    return `${m[2]}-${m[3]}-${m[1]}`;
  }

  const dateSubmitted = formatYMDToMDY(new Date().toISOString().slice(0, 10));
  const occurrenceDate = formatYMDToMDY(date_of_occurrence);

  const subject = trailerNumber
    ? `Boatmate Warranty Claim #${claimNumber} Received for ${trailerNumber}`
    : `Boatmate Warranty Claim #${claimNumber} Received`;

  const symptomsHtml = escapeHtml(warranty_symptoms).replace(/\n/g, "<br/>");
  const requestHtml = escapeHtml(warranty_request).replace(/\n/g, "<br/>");

  const htmlParts = [];

  // Optional: inline logo in the email body (NOT related to Gmail avatar)
  if (env.EMAIL_LOGO_URL) {
    htmlParts.push(
      `<p><img src="${escapeHtml(env.EMAIL_LOGO_URL)}" alt="Boatmate Trailers" style="max-width:200px;height:auto;" /></p>`
    );
  }

  htmlParts.push(
    "<p>Hello,</p>",
    "<p>This message confirms receipt of your Boatmate warranty claim submission. The details below reflect the information received at the time of submission and are provided for your records.</p>",
    "<p>Our warranty team will review the claim and contact you if additional information or documentation is required. Receipt of this submission does not constitute approval or denial of coverage.</p>",
    `<p>Please reference <strong>Claim #${claimNumber}</strong> in all future correspondence regarding this claim.</p>`,
    "<p>Sincerely,<br>Boatmate Warranty Team</p>",

    `<p><strong>Claim Summary</strong><br/>
      Claim #: ${claimNumber}<br/>
      ${trailerNumber ? `Trailer #: ${escapeHtml(trailerNumber)}<br/>` : ""}
      VIN: ${escapeHtml(vin)}<br/>
      Date Submitted: ${escapeHtml(dateSubmitted)}</p>`,

    `<p><strong>Dealer Information</strong><br/>
      Dealership: ${escapeHtml(dealer.name)}<br/>
      Contact: ${escapeHtml(dealer.contactName)}<br/>
      Email: ${escapeHtml(dealer.email)}<br/>
      Phone: ${escapeHtml(dealer.phone)}<br/>
      Address: ${escapeHtml(dealer.address)}</p>`,

    `<p><strong>Customer Information</strong><br/>
      Name: ${escapeHtml(customerName)}</p>`,

    `<p><strong>Warranty Claim Details</strong><br/>
      Date of Occurrence: ${escapeHtml(occurrenceDate)}<br/>
      Warranty Symptoms: ${symptomsHtml}<br/>
      Warranty Request: ${requestHtml}${
        labor_hours ? `<br/>Labor Hours: ${escapeHtml(labor_hours)}` : ""
      }</p>`
  );

  if (attachmentFileNames?.length) {
    const items = attachmentFileNames.map((n) => `<li>${escapeHtml(n)}</li>`).join("");
    htmlParts.push("<p><strong>Attached Files</strong></p>", `<ul>${items}</ul>`);
  } else {
    htmlParts.push("<p><strong>Attached Files</strong><br/>None</p>");
  }

  const textLines = [
    "Thanks for submitting your Boatmate warranty request.",
    "This email is your record of the information we received. It is not an approval or denial of coverage.",
    "",
    "Our team will review the claim and follow up with next steps.",
    `Please reference Claim #${claimNumber} in any future communication.`,
    "",
    "Claim Summary",
    `Claim #: ${claimNumber}`,
    trailerNumber ? `Trailer #: ${trailerNumber}` : "Trailer #: N/A",
    `VIN: ${vin}`,
    `Date Submitted: ${dateSubmitted}`,
    "",
    "Dealer Information",
    `Dealership: ${dealer.name}`,
    `Contact: ${dealer.contactName}`,
    `Email: ${dealer.email}`,
    `Phone: ${dealer.phone}`,
    `Address: ${dealer.address}`,
    "",
    "Customer Information",
    `Name: ${customerName}`,
    "",
    "Warranty Claim Details",
    `Date of Occurrence: ${occurrenceDate}`,
    `Warranty Symptoms: ${warranty_symptoms}`,
    `Warranty Request: ${warranty_request}`
  ];

  if (labor_hours) textLines.push(`Labor Hours: ${labor_hours}`);

  if (attachmentFileNames?.length) {
    textLines.push("Attached Files:", ...attachmentFileNames.map((n) => `* ${n}`));
  } else {
    textLines.push("Attached Files: None");
  }

  return {
    to: dealer.email,
    from: env.FROM_EMAIL,
    subject,
    html: htmlParts.join("\n"),
    text: textLines.join("\n")
  };
}

/* -------------------------------------------------------------------------- */
/* HTTP / CORS                                                                  */
/* -------------------------------------------------------------------------- */

function handlePreflight(request) {
  const reqMethod = request.headers.get("Access-Control-Request-Method") || "POST";
  const reqHeaders = request.headers.get("Access-Control-Request-Headers") || "content-type";
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
  const reqHeaders = request.headers.get("Access-Control-Request-Headers") || "content-type";

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

function jsonResponse(request, body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      ...corsHeaders(request)
    }
  });
}

/* -------------------------------------------------------------------------- */
/* Email (Brevo)                                                                */
/* -------------------------------------------------------------------------- */

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
    headers: {
      "Content-Type": "application/json",
      "api-key": apiKey
    },
    body: JSON.stringify(payload)
  });

  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    throw new Error(`Brevo send failed ${resp.status}: ${body.slice(0, 300)}`);
  }
}

/* -------------------------------------------------------------------------- */
/* HubSpot Helpers                                                              */
/* -------------------------------------------------------------------------- */

async function hsRequest(env, path, init = {}) {
  if (!env.HUBSPOT_TOKEN) throw new Error("HUBSPOT_TOKEN missing");

  const url = `${HS_BASE}${path}`;
  const headers = new Headers(init.headers || {});
  headers.set("Authorization", `Bearer ${env.HUBSPOT_TOKEN}`);
  headers.set("Content-Type", "application/json");

  const resp = await fetch(url, { ...init, headers });
  const text = await resp.text();

  let data = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = {};
    }
  }

  if (!resp.ok) {
    const code = data?.status || resp.status;
    const msg = data?.message || data?.error || `HTTP ${resp.status}`;
    throw new Error(`HubSpot ${code}: ${msg}`);
  }

  return data;
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

  const hit = Array.isArray(res?.results) ? res.results[0] : null;
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

/* ----------------------------- Associations ------------------------------ */

async function hsAssociateTicketToContact(env, ticketId, contactId) {
  if (!ticketId || !contactId) throw new Error("ticketId and contactId required");

  await hsRequest(
    env,
    `/crm/v4/objects/ticket/${ticketId}/associations/default/contact/${contactId}`,
    { method: "PUT" }
  );
}

async function hsGetPrimaryCompanyIdForContact(env, contactId) {
  if (!contactId) return null;

  const res = await hsRequest(env, `/crm/v4/objects/contact/${contactId}/associations/company`, {
    method: "GET"
  });

  const results = Array.isArray(res?.results) ? res.results : [];
  if (!results.length) return null;

  // If there's a "primary" association, prefer it. Otherwise choose the first company.
  const primary =
    results.find(
      (r) =>
        Array.isArray(r.associationTypes) &&
        r.associationTypes.some((t) => t.category === "HUBSPOT_DEFINED" && t.typeId === 1)
    ) || null;

  const picked = primary || results[0];
  const companyId = picked?.toObjectId;
  return companyId ? String(companyId) : null;
}

async function hsAssociateTicketToCompany(env, ticketId, companyId) {
  if (!ticketId || !companyId) throw new Error("ticketId and companyId required");

  await hsRequest(
    env,
    `/crm/v4/objects/ticket/${ticketId}/associations/default/company/${companyId}`,
    { method: "PUT" }
  );
}

/* ------------------------------ Files API ------------------------------- */

async function hsUploadFile(env, file) {
  if (!env.HUBSPOT_TOKEN) throw new Error("HUBSPOT_TOKEN missing for Files API");

  const fd = new FormData();
  fd.append("file", file, file.name || "attachment");
  fd.append("options", JSON.stringify({ access: "PRIVATE" }));

  const folderPath = env.HS_FILES_FOLDER_PATH || "/warranty-intake";
  fd.append("folderPath", folderPath);

  // Files endpoint expects multipart/form-data; do NOT set Content-Type manually.
  const resp = await fetch("https://api.hubapi.com/files/v3/files", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.HUBSPOT_TOKEN}` },
    body: fd
  });

  const text = await resp.text().catch(() => "");
  let data = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = {};
    }
  }

  if (!resp.ok) {
    const msg = data?.message || text.slice(0, 300);
    throw new Error(`HubSpot Files ${resp.status}: ${msg}`);
  }

  return data;
}

/* ------------------------------ Notes API ------------------------------- */

let cachedNoteTicketAssociationTypeId = null;

async function hsGetNoteTicketAssociationTypeId(env) {
  if (cachedNoteTicketAssociationTypeId !== null) return cachedNoteTicketAssociationTypeId;

  const res = await hsRequest(env, "/crm/v4/associations/notes/tickets/labels", { method: "GET" });
  const results = Array.isArray(res?.results) ? res.results : [];
  if (!results.length) throw new Error("No association labels returned for notes<->tickets");

  // Prefer HUBSPOT_DEFINED label when present
  const label = results.find((r) => r.category === "HUBSPOT_DEFINED") || results[0];

  const typeId =
    (typeof label.typeId === "number" && label.typeId) ||
    (typeof label.associationTypeId === "number" && label.associationTypeId) ||
    null;

  if (!typeId) throw new Error("No numeric typeId/associationTypeId found for notes<->tickets");

  cachedNoteTicketAssociationTypeId = typeId;
  return typeId;
}

async function hsCreateNoteWithAttachments(env, ticketId, claimNumber, fileIds, vin) {
  if (!ticketId) throw new Error("ticketId required");
  if (!fileIds?.length) throw new Error("fileIds required");

  const nowIso = new Date().toISOString();
  const hs_attachment_ids = fileIds.join(";");

  const associationTypeId = await hsGetNoteTicketAssociationTypeId(env);

  const body = {
    properties: {
      hs_timestamp: nowIso,
      hs_note_body: `Warranty attachments uploaded via dealer intake form for Claim #${claimNumber} (VIN ${vin}).`,
      hs_attachment_ids
    },
    associations: [
      {
        to: { id: ticketId },
        types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId }]
      }
    ]
  };

  const res = await hsRequest(env, "/crm/v3/objects/notes", {
    method: "POST",
    body: JSON.stringify(body)
  });

  return res?.id || null;
}

/* -------------------------------------------------------------------------- */
/* Small Utilities                                                              */
/* -------------------------------------------------------------------------- */

function toTrim(v) {
  return String(v ?? "").trim();
}

function toLowerTrim(v) {
  return toTrim(v).toLowerCase();
}

function toUpperTrim(v) {
  return toTrim(v).toUpperCase();
}

function compactProps(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj || {})) {
    if (v === undefined || v === null) continue;
    if (typeof v === "string" && v.trim() === "") continue;
    out[k] = v;
  }
  return out;
}

function escapeHtml(str = "") {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function looksLikeFile(value) {
  // Cloudflare provides File objects, but we keep this runtime-safe.
  return (
    value &&
    typeof value === "object" &&
    typeof value.name === "string" &&
    typeof value.size === "number" &&
    typeof value.arrayBuffer === "function"
  );
}

function isValidVin(vin) {
  return /^[A-HJ-NPR-Z0-9]{17}$/.test(String(vin || "").toUpperCase());
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").toLowerCase());
}

function joinName(first, last) {
  return [first, last]
    .map((s) => String(s || "").trim())
    .filter(Boolean)
    .join(" ");
}

function joinAddress(parts) {
  return (parts || [])
    .map((p) => String(p || "").trim())
    .filter(Boolean)
    .join(", ");
}

function getTrailerNumberFromVin(vin) {
  // Original logic: 10th char + last 4 (if VIN is 17)
  if (typeof vin === "string" && vin.length === 17) {
    return vin.charAt(9) + vin.slice(13);
  }
  return vin || "";
}