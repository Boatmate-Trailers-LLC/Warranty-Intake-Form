# Change Request — Worker Branching Update Spec Minor Revisions

## Change Request

**Title**  
CR-WTY-WORKER-001 — Minor Clarifications and Deferred Follow-Up Additions to Worker Branching Update Spec

**Target Artifact**  
Customer Warranty Intake — Worker Branching Update Spec

**Requested Change Type**  
Minor clarification / deferred follow-up additions

**Recommended Version Target**  
1.1

**Compatibility**  
Non-breaking

**Impact**  
Customer Warranty Intake — Worker Branching Update Spec only

### Context

The current Worker Branching Update Spec is strong overall, but three minor improvements were identified during review:

- explicitly defer UTM/source capture to a later contract/spec update
- clarify that allowed file types remain unchanged from current/live behavior
- clarify that the helper name `hsUpsertContact(...)` may remain legacy even though the behavior for this update is create/find without updating existing contacts

A fourth proposed wording tweak regarding “does not accept” vs “ignored if present” was discussed but is **not** being adopted at this time.

### Objective

Revise the Worker Branching Update Spec so that it:

- captures the deferred UTM/source-capture follow-up explicitly
- removes ambiguity around file-type policy
- clarifies the legacy helper-name vs actual contact-flow behavior
- leaves the previously discussed wording around out-of-contract fields unchanged for now

### Recommendation

Approve the deltas below and revise the Worker Branching Update Spec accordingly.

### Approvals

- Sponsor
- PM
- Tech Lead

---

# DELTAS

## DELTA 1 — Add explicit deferred follow-up for UTM/source capture

**Target Section:**  
`## Deferred Follow-Up Work`

**Append:**

```markdown
4. **UTM/source capture follow-up**
   - UTM/source capture must be added to the customer and dealer intake flows in a later contract/spec update
```

**Why**  
This makes the omission explicit and prevents UTM/source capture from being silently forgotten.

---

## DELTA 2 — Clarify file-type policy in shared attachment rules

**Target Section:**  
`## Shared Validation / Formatting Rules` → `### Shared Attachment Rules`

**Replace:**

```markdown
The shared core attachment rules remain identical for both branches:
- attachments parsed from `attachments`
- minimum 1 file required
- maximum 10 files
- maximum 10 MB per file
- same PRIVATE upload behavior to HubSpot Files
- same note association pattern to the ticket
```

**With:**

```markdown
The shared core attachment rules remain identical for both branches:
- attachments parsed from `attachments`
- minimum 1 file required
- maximum 10 files
- maximum 10 MB per file
- allowed file types remain unchanged from current/live behavior
- same PRIVATE upload behavior to HubSpot Files
- same note association pattern to the ticket
```

**Why**  
This removes ambiguity without expanding scope into a new file-type policy decision.

---

## DELTA 3 — Clarify legacy helper name vs actual shared contact-flow behavior

**Target Section:**  
`## Shared Contact Flow`

**Replace:**

```markdown
The shared core contact flow remains:
- choose canonical email
- search HubSpot contact by email
- if found, reuse existing contact ID
- if not found, create contact
- do not update existing contact properties during this flow
```

**With:**

```markdown
The shared core contact flow remains:
- choose canonical email
- search HubSpot contact by email
- if found, reuse existing contact ID
- if not found, create contact
- do not update existing contact properties during this flow

Note:
- helper name may remain legacy (for example, `hsUpsertContact(...)`)
- behavior for this update is create/find without updating existing contacts
```

**Why**  
This prevents confusion between the helper’s legacy name and its actual behavior in this update.

---

## DELTA 4 — No change to out-of-contract wording at this time

**Disposition:**  
No delta requested for the previously discussed wording concern regarding phrases like “does not accept” versus “ignored if present.”

**Instruction:**  
Leave that wording unchanged in the current Worker Branching Update Spec.

**Why**  
The issue was reviewed and explained, but no wording change is being adopted in this revision.

---

# Recommended Actions

- Apply DELTA 1 through DELTA 3 to the Worker Branching Update Spec.
- Record DELTA 4 as an intentional no-change decision.
- Do not broaden this revision into a larger Worker hardening or wording cleanup pass.

# Risks & Mitigations

- **Risk:** UTM/source capture remains forgotten because it is not in current scope.  
  **Mitigation:** Add the explicit deferred follow-up bullet.

- **Risk:** File-type behavior is interpreted as newly undefined.  
  **Mitigation:** State that allowed file types remain unchanged from current/live behavior.

- **Risk:** Future implementers misunderstand `hsUpsertContact(...)` as a true update path.  
  **Mitigation:** Add explicit note that behavior remains create/find without updating existing contacts.

# Open Questions / Assumptions

- This change request targets the current **Customer Warranty Intake — Worker Branching Update Spec**.
- The proposed wording tweak around out-of-contract fields is intentionally excluded from this revision.
- No other structural or behavioral changes are requested as part of this minor revision.
