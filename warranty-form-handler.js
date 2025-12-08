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

        // Collect real File objects for attachments
        for (const [name, value] of f.entries()) {
          if (name === "attachments" && value && typeof value === "object" && "name" in value) {
            attachmentFiles.push(value);
            if (value.name) attachmentFileNames.push(value.name);
          }
        }
      }
    } catch {
      return json(request, { ok: false, errors: ["Invalid request body"] }, 400);
    }

    // --------- Server-side validation (authoritative) ---------
    const errors = [];
    if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) {
      errors.push("VIN must be 17 chars (no I, O, Q).");
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email || "")) {
      errors.push("Email is invalid.");
    }
    if (errors.length) {
      return json(request, { ok: false, errors }, 400);
    }

    const submission = {
      ref: crypto.randomUUID(),
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
      console.log("HS contactId", contactId);
    } catch (e) {
      console.error("HS contact upsert failed", e);
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
      console.log("HS ticketId", ticketId);
      } catch (e) {
        console.error("HS ticket create failed", e);
        ticketError = e instanceof Error ? e.message : String(e);
      }

      // 7b) Associate ticket with Contact and Company (if available)
      if (ticketId && contactId && env.HUBSPOT_TOKEN) {
        try {
          await hsAssociateTicketToContact(env, ticketId, contactId);
          console.log("Associated ticket to contact", { ticketId, contactId });
        } catch (e) {
          console.error("Ticket<->contact association failed", e);
        }

        try {
          const companyId = await hsGetPrimaryCompanyIdForContact(env, contactId);
          if (companyId) {
            await hsAssociateTicketToCompany(env, ticketId, companyId);
            console.log("Associated ticket to company", { ticketId, companyId });
          }
        } catch (e) {
          console.error("Ticket<->company association failed", e);
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
          console.log("HS noteId (attachments)", noteId);
        }
      } catch (e) {
        console.error("Attachment upload / note create failed", e);
        attachmentsError =
          e && e.message
            ? `HubSpot error: ${e.message}`
            : "Unknown error while creating attachment note";
      }
    }

    const ref = submission.ref;

    // 9) Confirmation email (Brevo)
    const emailConfigured =
      env.EMAIL_ENABLED === "true" &&
      !!(env.EMAIL_API_ENDPOINT && env.EMAIL_API_KEY && env.FROM_EMAIL);

    let emailStatus = "skipped";

    if (emailConfigured) {
      const subject = `Warranty request received - Claim #${claimNumber}`;
      const html = `
        <p>Thanks! We received your warranty request.</p>
        <p><strong>Claim #:</strong> ${claimNumber}</p>
        <p><strong>VIN:</strong> ${escapeHtml(vin)}<br/>
           <strong>Email:</strong> ${escapeHtml(email)}</p>
        <p>We’ll follow up shortly.</p>
      `;
      const text = `Thanks!
      Claim #: ${claimNumber}
      VIN: ${vin}
      Email: ${email}`;

      try {
        await sendEmail(env, { to: email, from: env.FROM_EMAIL, subject, html, text });
        emailStatus = "sent";
      } catch (err) {
        console.error("Email send failed", err);
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

// ------------------------ CORS helpers ------------------------
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

function escapeHtml(str = "") {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
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
