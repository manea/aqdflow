import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

function sha256Hex(value) {
  return crypto.createHash('sha256').update(String(value ?? '')).digest('hex');
}

function makeError(message, code, statusCode) {
  const err = new Error(message);
  err.code = code;
  err.statusCode = statusCode;
  return err;
}

export function slugify(input, fallback = 'proposal') {
  const cleaned = String(input ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
  return cleaned || fallback;
}

function parseJsonSafe(raw, fallback) {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function openAqdFlowDatabase(dataDir) {
  const resolvedDataDir = path.resolve(dataDir);
  fs.mkdirSync(resolvedDataDir, { recursive: true });

  const dbPath = path.join(resolvedDataDir, 'aqdflow.sqlite');
  const db = new DatabaseSync(dbPath);

  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = FULL;
    PRAGMA busy_timeout = 5000;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS proposals (
      id TEXT PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL,
      proposal_json TEXT NOT NULL,
      view_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_proposals_status ON proposals(status);
    CREATE INDEX IF NOT EXISTS idx_proposals_updated ON proposals(updated_at DESC);

    CREATE TABLE IF NOT EXISTS approvals (
      proposal_id TEXT PRIMARY KEY REFERENCES proposals(id) ON DELETE CASCADE,
      selected_tier_id TEXT NOT NULL,
      selected_addon_ids_json TEXT NOT NULL,
      signer_name TEXT NOT NULL,
      signer_title TEXT,
      signer_email TEXT,
      signature_type TEXT NOT NULL,
      signature_data_url TEXT,
      scope_digest_hex TEXT NOT NULL,
      ip_hash TEXT,
      user_agent_hash TEXT,
      approved_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS invoices (
      invoice_number TEXT PRIMARY KEY,
      proposal_id TEXT NOT NULL UNIQUE REFERENCES proposals(id) ON DELETE CASCADE,
      classification TEXT NOT NULL,
      currency TEXT NOT NULL,
      total_amount REAL NOT NULL,
      tax_amount REAL NOT NULL,
      zatca_qr_base64 TEXT,
      invoice_json TEXT NOT NULL,
      issued_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_invoices_issued ON invoices(issued_at DESC);

    CREATE TABLE IF NOT EXISTS invoice_counters (
      year INTEGER PRIMARY KEY,
      last_seq INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS audit_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      proposal_id TEXT NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
      event_type TEXT NOT NULL,
      actor TEXT NOT NULL,
      meta_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_audit_proposal ON audit_events(proposal_id, id);
  `);

  const stmtFindSlug = db.prepare('SELECT id FROM proposals WHERE slug = ? LIMIT 1');
  const stmtFindById = db.prepare('SELECT * FROM proposals WHERE id = ? LIMIT 1');
  const stmtFindBySlug = db.prepare('SELECT * FROM proposals WHERE slug = ? LIMIT 1');
  const stmtApprovalByProposal = db.prepare('SELECT * FROM approvals WHERE proposal_id = ? LIMIT 1');
  const stmtInvoiceByProposal = db.prepare('SELECT * FROM invoices WHERE proposal_id = ? LIMIT 1');
  const stmtAuditByProposal = db.prepare(
    'SELECT id, proposal_id, event_type, actor, meta_json, created_at FROM audit_events WHERE proposal_id = ? ORDER BY id ASC',
  );
  const stmtInsertAudit = db.prepare(
    'INSERT INTO audit_events (proposal_id, event_type, actor, meta_json, created_at) VALUES (?, ?, ?, ?, ?)',
  );

  function ensureUniqueSlug(desiredSlug, excludeId = null) {
    const base = slugify(desiredSlug);
    let candidate = base;
    for (let attempt = 0; attempt < 20; attempt++) {
      const existing = stmtFindSlug.get(candidate);
      if (!existing || (excludeId && existing.id === excludeId)) {
        return candidate;
      }
      candidate = `${base}-${crypto.randomBytes(2).toString('hex')}`;
    }
    return `${base}-${Date.now().toString(36)}`;
  }

  function appendAudit(proposalId, eventType, actor, meta = {}, createdAt = new Date().toISOString()) {
    stmtInsertAudit.run(
      String(proposalId),
      String(eventType),
      String(actor),
      JSON.stringify(meta ?? {}),
      String(createdAt),
    );
  }

  function hydrateApprovalRow(row) {
    if (!row) return null;
    return {
      proposalId: String(row.proposal_id),
      selectedTierId: String(row.selected_tier_id),
      selectedAddonIds: parseJsonSafe(row.selected_addon_ids_json, []),
      signerName: String(row.signer_name),
      signerTitle: row.signer_title ? String(row.signer_title) : undefined,
      signerEmail: row.signer_email ? String(row.signer_email) : undefined,
      signatureType: String(row.signature_type),
      signatureDataUrl: row.signature_data_url ? String(row.signature_data_url) : undefined,
      scopeAccepted: true,
      scopeDigestHex: String(row.scope_digest_hex),
      ipHash: row.ip_hash ? String(row.ip_hash) : undefined,
      userAgentHash: row.user_agent_hash ? String(row.user_agent_hash) : undefined,
      approvedAt: String(row.approved_at),
    };
  }

  function hydrateProposalBundle(row, { includeAudit = true } = {}) {
    if (!row) return null;
    const proposal = parseJsonSafe(row.proposal_json, null);
    if (!proposal) return null;

    proposal.id = String(row.id);
    proposal.slug = String(row.slug);
    proposal.status = String(row.status);
    proposal.createdAt = String(row.created_at);
    proposal.updatedAt = String(row.updated_at);

    const approvalRow = stmtApprovalByProposal.get(row.id);
    const invoiceRow = stmtInvoiceByProposal.get(row.id);
    const approval = hydrateApprovalRow(approvalRow);
    const invoice = invoiceRow ? parseJsonSafe(invoiceRow.invoice_json, null) : null;
    const auditEvents = includeAudit
      ? stmtAuditByProposal.all(row.id).map((ev) => ({
          id: Number(ev.id),
          proposalId: String(ev.proposal_id),
          eventType: String(ev.event_type),
          actor: String(ev.actor),
          meta: parseJsonSafe(ev.meta_json, {}),
          createdAt: String(ev.created_at),
        }))
      : [];

    return {
      proposal,
      viewCount: Number(row.view_count ?? 0),
      approval,
      invoice,
      auditEvents,
    };
  }

  function getProposalById(id) {
    const row = stmtFindById.get(String(id));
    return hydrateProposalBundle(row);
  }

  function getProposalBySlug(slug) {
    const row = stmtFindBySlug.get(String(slug));
    return hydrateProposalBundle(row);
  }

  function listProposals() {
    const rows = db
      .prepare(
        `SELECT p.*, i.invoice_number, i.total_amount AS invoice_total, i.issued_at AS invoice_issued_at
         FROM proposals p
         LEFT JOIN invoices i ON i.proposal_id = p.id
         ORDER BY p.updated_at DESC`,
      )
      .all();

    return rows.map((row) => {
      const proposal = parseJsonSafe(row.proposal_json, {});
      return {
        id: String(row.id),
        slug: String(row.slug),
        status: String(row.status),
        viewCount: Number(row.view_count ?? 0),
        createdAt: String(row.created_at),
        updatedAt: String(row.updated_at),
        invoiceNumber: row.invoice_number ? String(row.invoice_number) : null,
        invoiceTotal: row.invoice_total !== null && row.invoice_total !== undefined ? Number(row.invoice_total) : null,
        invoiceIssuedAt: row.invoice_issued_at ? String(row.invoice_issued_at) : null,
        proposal: {
          ...proposal,
          id: String(row.id),
          slug: String(row.slug),
          status: String(row.status),
        },
      };
    });
  }

  function createProposal(proposalInput) {
    const now = new Date().toISOString();
    const id = proposalInput.id ? String(proposalInput.id) : `prop_${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}`;
    const uniqueSlug = ensureUniqueSlug(proposalInput.slug || proposalInput.titleEn || proposalInput.titleAr || id);
    const initialStatus = proposalInput.status === 'sent' ? 'sent' : 'draft';
    const createdAt = proposalInput.createdAt ? String(proposalInput.createdAt) : now;
    const updatedAt = now;

    const record = {
      ...proposalInput,
      id,
      slug: uniqueSlug,
      status: initialStatus,
      createdAt,
      updatedAt,
    };

    db.prepare(
      `INSERT INTO proposals (id, slug, status, proposal_json, view_count, created_at, updated_at)
       VALUES (?, ?, ?, ?, 0, ?, ?)`,
    ).run(id, uniqueSlug, initialStatus, JSON.stringify(record), createdAt, updatedAt);

    appendAudit(id, 'proposal_created', 'studio', { slug: uniqueSlug, status: initialStatus }, now);
    return getProposalById(id);
  }

  function updateProposal(id, patch) {
    const row = stmtFindById.get(String(id));
    if (!row) return null;

    if (row.status === 'approved' || row.status === 'invoiced') {
      throw makeError(
        'Cannot edit a proposal after client approval and scope lock',
        'PROPOSAL_LOCKED',
        409,
      );
    }

    const current = parseJsonSafe(row.proposal_json, {});
    const now = new Date().toISOString();
    const nextSlug =
      patch.slug !== undefined && String(patch.slug).trim() !== String(row.slug)
        ? ensureUniqueSlug(String(patch.slug), row.id)
        : String(row.slug);

    const requestedStatus = patch.status === 'sent' ? 'sent' : patch.status === 'draft' ? 'draft' : String(row.status);
    const nextRecord = {
      ...current,
      ...patch,
      seller: { ...(current.seller ?? {}), ...(patch.seller ?? {}) },
      client: { ...(current.client ?? {}), ...(patch.client ?? {}) },
      paymentChannels: { ...(current.paymentChannels ?? {}), ...(patch.paymentChannels ?? {}) },
      id: String(row.id),
      slug: nextSlug,
      status: requestedStatus,
      createdAt: String(row.created_at),
      updatedAt: now,
    };

    db.prepare(
      `UPDATE proposals
       SET slug = ?, status = ?, proposal_json = ?, updated_at = ?
       WHERE id = ?`,
    ).run(nextSlug, requestedStatus, JSON.stringify(nextRecord), now, String(row.id));

    appendAudit(row.id, 'proposal_updated', 'studio', { slug: nextSlug }, now);
    return getProposalById(row.id);
  }

  function publishProposal(id) {
    const row = stmtFindById.get(String(id));
    if (!row) return null;

    if (row.status === 'approved' || row.status === 'invoiced') {
      throw makeError('Proposal is already approved and locked', 'PROPOSAL_LOCKED', 409);
    }
    if (row.status === 'sent') {
      return getProposalById(row.id);
    }

    const now = new Date().toISOString();
    const current = parseJsonSafe(row.proposal_json, {});
    const updated = { ...current, status: 'sent', updatedAt: now };

    db.prepare('UPDATE proposals SET status = ?, proposal_json = ?, updated_at = ? WHERE id = ?').run(
      'sent',
      JSON.stringify(updated),
      now,
      String(row.id),
    );
    appendAudit(row.id, 'proposal_published', 'studio', { slug: row.slug }, now);
    return getProposalById(row.id);
  }

  function duplicateProposal(id) {
    const sourceBundle = getProposalById(id);
    if (!sourceBundle) return null;

    const now = new Date().toISOString();
    const newId = `prop_${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}`;
    const newSlug = ensureUniqueSlug(`${sourceBundle.proposal.slug}-copy`);

    const cloned = {
      ...sourceBundle.proposal,
      id: newId,
      slug: newSlug,
      status: 'draft',
      createdAt: now,
      updatedAt: now,
    };

    db.prepare(
      `INSERT INTO proposals (id, slug, status, proposal_json, view_count, created_at, updated_at)
       VALUES (?, ?, 'draft', ?, 0, ?, ?)`,
    ).run(newId, newSlug, JSON.stringify(cloned), now, now);

    appendAudit(newId, 'proposal_duplicated', 'studio', { sourceId: String(id) }, now);
    return getProposalById(newId);
  }

  function deleteProposal(id) {
    const row = stmtFindById.get(String(id));
    if (!row) return false;

    const existingInvoice = stmtInvoiceByProposal.get(String(row.id));
    if (row.status === 'approved' || row.status === 'invoiced' || existingInvoice) {
      throw makeError('Cannot delete an approved or invoiced proposal', 'PROPOSAL_LOCKED', 409);
    }

    db.prepare('DELETE FROM proposals WHERE id = ?').run(String(row.id));
    return true;
  }

  function recordPublicView(slug, ipHash, userAgentHash) {
    const row = stmtFindBySlug.get(String(slug));
    if (!row || row.status === 'draft') return null;

    const now = new Date().toISOString();
    db.prepare('UPDATE proposals SET view_count = view_count + 1 WHERE id = ?').run(String(row.id));
    appendAudit(
      row.id,
      'proposal_viewed',
      'client',
      {
        ipHash: ipHash || null,
        userAgentHash: userAgentHash || null,
      },
      now,
    );
    return getProposalById(row.id);
  }

  function approveProposalAtomic({ slug, approval, ipHash = '', userAgentHash = '', invoiceBuilder }) {
    let inTx = false;
    let proposalId = '';
    try {
      db.exec('BEGIN IMMEDIATE');
      inTx = true;

      const row = stmtFindBySlug.get(String(slug));
      if (!row || row.status === 'draft') {
        throw makeError('Published proposal not found', 'NOT_FOUND', 404);
      }

      const existingApproval = stmtApprovalByProposal.get(row.id);
      const existingInvoice = stmtInvoiceByProposal.get(row.id);
      if (row.status !== 'sent' || existingApproval || existingInvoice) {
        throw makeError('Proposal has already been approved and locked', 'ALREADY_APPROVED', 409);
      }

      proposalId = String(row.id);
      const parsedProposal = parseJsonSafe(row.proposal_json, {});
      const approvedAt = String(approval.approvedAt || new Date().toISOString());
      const year = new Date(approvedAt).getUTCFullYear() || new Date().getUTCFullYear();

      db.prepare('INSERT OR IGNORE INTO invoice_counters (year, last_seq) VALUES (?, 0)').run(year);
      db.prepare('UPDATE invoice_counters SET last_seq = last_seq + 1 WHERE year = ?').run(year);
      const seqRow = db.prepare('SELECT last_seq FROM invoice_counters WHERE year = ?').get(year);
      const nextSeq = Number(seqRow?.last_seq ?? 1);
      const invoiceNumber = `INV-${year}-${String(nextSeq).padStart(4, '0')}`;

      const updatedProposal = {
        ...parsedProposal,
        id: proposalId,
        slug: String(row.slug),
        status: 'invoiced',
        selectedTierId: String(approval.selectedTierId),
        selectedAddonIds: [...(approval.selectedAddonIds ?? [])],
        updatedAt: approvedAt,
      };

      const invoice = invoiceBuilder(updatedProposal, invoiceNumber);

      db.prepare(
        `INSERT INTO approvals (
          proposal_id, selected_tier_id, selected_addon_ids_json,
          signer_name, signer_title, signer_email, signature_type, signature_data_url,
          scope_digest_hex, ip_hash, user_agent_hash, approved_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        proposalId,
        String(approval.selectedTierId),
        JSON.stringify(approval.selectedAddonIds ?? []),
        String(approval.signerName),
        approval.signerTitle ? String(approval.signerTitle) : null,
        approval.signerEmail ? String(approval.signerEmail) : null,
        String(approval.signatureType),
        approval.signatureDataUrl ? String(approval.signatureDataUrl) : null,
        String(approval.scopeDigestHex),
        ipHash || null,
        userAgentHash || null,
        approvedAt,
      );

      db.prepare(
        `INSERT INTO invoices (
          invoice_number, proposal_id, classification, currency,
          total_amount, tax_amount, zatca_qr_base64, invoice_json, issued_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        invoice.invoiceNumber,
        proposalId,
        invoice.classification,
        invoice.currency,
        Number(invoice.totalAmount),
        Number(invoice.taxAmount),
        invoice.zatcaQrBase64 ?? null,
        JSON.stringify(invoice),
        String(invoice.issuedAt),
      );

      db.prepare('UPDATE proposals SET status = ?, proposal_json = ?, updated_at = ? WHERE id = ?').run(
        'invoiced',
        JSON.stringify(updatedProposal),
        approvedAt,
        proposalId,
      );

      appendAudit(
        proposalId,
        'proposal_approved',
        approval.signerName,
        {
          selectedTierId: approval.selectedTierId,
          selectedAddonIds: approval.selectedAddonIds ?? [],
          scopeDigestHex: approval.scopeDigestHex,
        },
        approvedAt,
      );
      appendAudit(
        proposalId,
        'invoice_issued',
        'system',
        {
          invoiceNumber: invoice.invoiceNumber,
          classification: invoice.classification,
          totalAmount: invoice.totalAmount,
          currency: invoice.currency,
        },
        approvedAt,
      );

      db.exec('COMMIT');
      inTx = false;
    } catch (err) {
      if (inTx) {
        try {
          db.exec('ROLLBACK');
        } catch {
          // ignore rollback errors
        }
      }
      throw err;
    }

    return getProposalById(proposalId);
  }

  function listInvoices() {
    const rows = db
      .prepare('SELECT invoice_json FROM invoices ORDER BY issued_at DESC, invoice_number DESC')
      .all();
    return rows.map((row) => parseJsonSafe(row.invoice_json, null)).filter(Boolean);
  }

  function getInvoiceByNumber(invoiceNumber) {
    const row = db
      .prepare('SELECT invoice_json FROM invoices WHERE invoice_number = ? LIMIT 1')
      .get(String(invoiceNumber));
    return row ? parseJsonSafe(row.invoice_json, null) : null;
  }

  function getStats() {
    const rows = db.prepare('SELECT status, COUNT(*) AS cnt FROM proposals GROUP BY status').all();
    const counts = { total: 0, draft: 0, sent: 0, approved: 0, invoiced: 0 };
    for (const r of rows) {
      const s = String(r.status);
      const cnt = Number(r.cnt ?? 0);
      counts.total += cnt;
      if (s in counts) counts[s] = cnt;
    }
    const invRow = db.prepare('SELECT COUNT(*) AS cnt FROM invoices').get();
    return {
      ...counts,
      invoicesCount: Number(invRow?.cnt ?? 0),
    };
  }

  function close() {
    try {
      db.close();
    } catch {
      // already closed
    }
  }

  return {
    listProposals,
    getProposalById,
    getProposalBySlug,
    createProposal,
    updateProposal,
    publishProposal,
    duplicateProposal,
    deleteProposal,
    recordPublicView,
    approveProposalAtomic,
    listInvoices,
    getInvoiceByNumber,
    getStats,
    close,
    sha256Hex,
  };
}
