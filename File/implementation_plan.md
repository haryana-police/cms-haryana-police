# Implementation Plan: HC Reply Module Completion

This document outlines the steps to finalize the "HC Reply Module" under Ankush's assignment. The plan bridges the gap between the existing codebase and a production-grade, integration-ready legal drafting utility.

## State of the Existing Repository

### What Already Exists:
1. **Database layer:** 9 core tables defined in `hc-reply.schema.js`.
2. **Backend Architecture:** Zod-backed express routes passing to controllers -> services -> SQLite repo.
3. **Frontend Architecture:** `App.jsx`, generic `Dashboard.jsx`, simple Tabs in `ReplyDetail.jsx`.

### What is Missing:
1. **Backend:** Strict state-machine guardrails, automatic `hc_reply_versions` tracking hooks, explicit RBAC, deeply structured template-engine mapping. Assignment mapping (`assigned_to`, `due_date`), and extensive Annexure tracking flags inside the Attachments table.
2. **Frontend Sub-Routes:** Granular hub routing mapping `/:id/facts` to `/:id/export`.
3. **Frontend UIs:** Practical text-comparator Editor features, structured split-pane para-builders mapping statuses, and UIs for `Comments`, `Audit Logs`, and `Export/PDF`.

### What Needs Refactor:
1. **Frontend:** Demolish strict tabs in `ReplyDetail.jsx` and build the sub-routing layout hierarchy. Convert `ParaWiseBuilder.jsx` to a real split-pane interface. Customize Dashboard inputs explicitly.
2. **Backend:** Re-wire generic AI mocks into structural `hc-reply.template-engine.js`. Update initialization schema to inject `ALTER TABLE` columns ensuring backwards compatibility for new Assignment/Annexure fields.

---

## 1. WORKFLOW STATE MACHINE, ROLES & PERMISSIONS

To ensure absolute safety, we enforce an explicit RBAC Role Matrix combined with a strict state machine inside `hc-reply.service.js`. 

### Role Matrix Definitions:
- **`creator` (IO / Station Officer):** Allowed to create replies, run facts extract, generate drafts, edit text, transition `draft` -> `under_review`.
- **`reviewer` (SHO / Legal Desk):** Allowed to transition `under_review` -> `approved` or `sent_back`. They CANNOT finalize. 
- **`approver` (DSP / Supreme Admin):** Allowed to transition `approved` -> `finalized`. 

| Current State | Allowed Next State | Permitted Roles | Audit Triggered | Comment Req? |
| :--- | :--- | :--- | :--- | :--- |
| `draft` | `under_review` | `creator`, `admin` | `SUBMITTED_FOR_REVIEW` | No |
| `under_review` | `approved` | `reviewer`, `approver`, `admin` | `APPROVED` | No |
| `under_review` | `sent_back` | `reviewer`, `approver`, `admin` | `SENT_BACK` | **YES** |
| `sent_back` | `draft` | `creator`, `admin` | `REVERTED_TO_DRAFT` | No |
| `sent_back` | `under_review` | `creator`, `admin` | `SUBMITTED_FOR_REVIEW` | **YES** (Fix notes) |
| `approved` | `finalized` | `approver`, `admin` | `FINALIZED` | No |

---

## 2. DATABASE & ORM EXTENDED STRATEGY

We use strictly raw **`better-sqlite3`**. To make this production-ready, we will reinforce the schema (`hc-reply.schema.js`) with explicit extensions:

### Relational integrity & Indexing Requirements
- **Foreign Keys:** Tables mapping to `hc_replies` include `ON DELETE CASCADE`.
- **Indexes:** `petition_no`, `fir_id`, `status`, `hearing_date`, `due_date`.

### Structural Additions
1. **`hc_replies` alterations:** Add `assigned_to` (TEXT), `due_date` (TEXT ISO 8601), `priority` (TEXT: urgent, normal), `assigned_at` (DATETIME).
2. **`hc_reply_attachments` alterations:** Add `attachment_type` (TEXT), `annexure_flag` (INTEGER 0/1), `annexure_number` (TEXT).

---

## 3. FRONTEND ROUTE ARCHITECTURE & ANNEXURES

- `/hc-reply` : **A. Dashboard** (Live APIs, multi-filters).
- `/hc-reply/new` : **B. Create New HC Reply**.
- `/hc-reply/templates` : **H. Templates Management Page**.
- `/hc-reply/:id` : **C. Detail View / Hub** (Header wrap).
- `/hc-reply/:id/facts` : **D. Fact Summary Review Page**
- `/hc-reply/:id/para-wise` : **E. Para-wise Builder** (Split panel UI hooked to paragraphs APIs).
- `/hc-reply/:id/editor` : **F. Draft Editor Page** (Main legal text viewer, Autosave enabled, Compare Modes).
- `/hc-reply/:id/review` : **G. Review & Approval Page** (Comments, Version diffs, Audits).
- `/hc-reply/:id/export` : **I. Export / Final Output Page** (`@media print` styled legal print).
- `/hc-reply/:id/attachments` : **J. Attachments / Annexures Management** (Manage flags & numbers).

---

## 4. VERIFICATION PLAN (3-LAYER APPROACH)

### Layer 1: API Tests
Verify basic CRUD endpoints, Zod schema constraints, and database referential integrity directly using test scripts/calls before tying it to the user interface.

### Layer 2: UI Flow Tests
Test the explicit end-to-end workflow on the frontend:
1. `Create Draft` -> `Add Facts` -> `Generate Draft`
2. `Add Para Replies` -> `Submit for Review`
3. `Reviewer Comment` -> `Send Back` -> `Revise`
4. `Approve` -> `Finalize`

### Layer 3: Legal Formatting Check
Trigger the `Export Preview` functionality. Evaluate the output specifically for proper `print CSS`, required page break rules mapped to proper sections, annexure index creation, right-aligned signature blocks, and centered court headings.

---

## 5. FINAL DELIVERABLES

Upon completion of the implementation, two handover documents will be provided:

1. **`walkthrough.md`** -> The technical report summarizing architecture, DB mapping, paths, and fully implemented logic overviews.
2. **`hc-reply-assumptions.md`** -> Assumptions, placeholders, and pending integrations mapping (e.g., where external dependencies like an OCR engine or PDF utility would hook in).

---

Proceed with implementation in phases without blocking on missing external dependencies. For unavailable integrations, use clearly isolated adapters/placeholders and document them in the final report.
