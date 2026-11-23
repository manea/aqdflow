import {
  buildScopeLockCanonicalText,
  computeProposalTotals,
  computeScopeDigestHex,
  generateDepositInvoice,
} from '../core/taxAndPricing.ts';
import { withBase } from './basePath.ts';
import {
  PROPOSAL_TEMPLATES,
  createProposalFromTemplate,
  type ProposalTemplatePreset,
} from '../core/templates.ts';
import type {
  ClientApproval,
  ComputedTotals,
  GeneratedInvoice,
  Proposal,
} from '../core/types.ts';

export interface AuditEventItem {
  id: number;
  proposalId: string;
  eventType: string;
  actor: string;
  meta: Record<string, unknown>;
  createdAt: string;
}

export interface ProposalSummary {
  id: string;
  slug: string;
  status: Proposal['status'];
  viewCount: number;
  createdAt: string;
  updatedAt: string;
  invoiceNumber: string | null;
  invoiceTotal: number | null;
  invoiceIssuedAt: string | null;
  proposal: Proposal;
  totals: ComputedTotals;
}

export interface ProposalBundle {
  proposal: Proposal;
  totals: ComputedTotals;
  viewCount: number;
  approval: ClientApproval | null;
  invoice: GeneratedInvoice | null;
  auditEvents?: AuditEventItem[];
  portalUrl?: string;
}

export interface DashboardStats {
  total: number;
  draft: number;
  sent: number;
  approved: number;
  invoiced: number;
  invoicesCount: number;
}

export interface TemplateMeta {
  id: ProposalTemplatePreset['id'];
  nameAr: string;
  nameEn: string;
  badgeAr: string;
  badgeEn: string;
  defaultCurrency: Proposal['currency'];
  defaultTaxRegime: Proposal['taxRegime'];
}

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const LOCAL_STORE_KEY = 'aqdflow_local_store_v1';

interface LocalStoreShape {
  proposals: Proposal[];
  approvals: Record<string, ClientApproval>;
  invoices: Record<string, GeneratedInvoice>;
  views: Record<string, number>;
  seq: number;
}

function readLocalStore(): LocalStoreShape {
  try {
    const raw = window.localStorage.getItem(LOCAL_STORE_KEY);
    if (raw) {
      return JSON.parse(raw) as LocalStoreShape;
    }
  } catch {
    // ignore storage errors
  }
  const starter = createProposalFromTemplate('web-commerce', { slug: 'demo-ecommerce' });
  const initial: LocalStoreShape = {
    proposals: [starter],
    approvals: {},
    invoices: {},
    views: {},
    seq: 0,
  };
  writeLocalStore(initial);
  return initial;
}

function writeLocalStore(store: LocalStoreShape): void {
  try {
    window.localStorage.setItem(LOCAL_STORE_KEY, JSON.stringify(store));
  } catch {
    // ignore storage errors
  }
}

async function requestApi<T>(url: string, init: RequestInit | undefined, fallbackFn: () => Promise<T>): Promise<T> {
  try {
    const res = await fetch(withBase(url), init);
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      // Pure static deployment (no backend API running) -> fall back cleanly to local mode
      return fallbackFn();
    }
    const data = (await res.json()) as Record<string, unknown>;
    if (!res.ok) {
      throw new ApiError(
        typeof data.error === 'string' ? data.error : `HTTP ${res.status}`,
        res.status,
        typeof data.code === 'string' ? data.code : undefined,
      );
    }
    return data as T;
  } catch (err) {
    if (err instanceof ApiError) {
      throw err;
    }
    return fallbackFn();
  }
}

function buildLocalBundle(store: LocalStoreShape, proposal: Proposal): ProposalBundle {
  return {
    proposal,
    totals: computeProposalTotals(proposal),
    viewCount: store.views[proposal.id] ?? 0,
    approval: store.approvals[proposal.id] ?? null,
    invoice: store.invoices[proposal.id] ?? null,
  };
}

export async function fetchTemplates(): Promise<TemplateMeta[]> {
  const data = await requestApi<{ templates: TemplateMeta[] }>('/api/templates', undefined, async () => ({
    templates: PROPOSAL_TEMPLATES.map(
      ({ id, nameAr, nameEn, badgeAr, badgeEn, defaultCurrency, defaultTaxRegime }) => ({
        id,
        nameAr,
        nameEn,
        badgeAr,
        badgeEn,
        defaultCurrency,
        defaultTaxRegime,
      }),
    ),
  }));
  return data.templates;
}

export async function listProposals(): Promise<{ proposals: ProposalSummary[]; stats: DashboardStats }> {
  return requestApi('/api/proposals', undefined, async () => {
    const store = readLocalStore();
    const proposals: ProposalSummary[] = store.proposals.map((p) => {
      const inv = store.invoices[p.id];
      return {
        id: p.id,
        slug: p.slug,
        status: p.status,
        viewCount: store.views[p.id] ?? 0,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        invoiceNumber: inv ? inv.invoiceNumber : null,
        invoiceTotal: inv ? inv.totalAmount : null,
        invoiceIssuedAt: inv ? inv.issuedAt : null,
        proposal: p,
        totals: computeProposalTotals(p),
      };
    });
    return {
      proposals,
      stats: {
        total: proposals.length,
        draft: proposals.filter((p) => p.status === 'draft').length,
        sent: proposals.filter((p) => p.status === 'sent').length,
        approved: proposals.filter((p) => p.status === 'approved').length,
        invoiced: proposals.filter((p) => p.status === 'invoiced').length,
        invoicesCount: Object.keys(store.invoices).length,
      },
    };
  });
}

export async function getProposal(id: string): Promise<ProposalBundle> {
  return requestApi(`/api/proposals/${encodeURIComponent(id)}`, undefined, async () => {
    const store = readLocalStore();
    const found = store.proposals.find((p) => p.id === id);
    if (!found) throw new ApiError('Proposal not found', 404);
    return buildLocalBundle(store, found);
  });
}

export async function createProposalFromPreset(
  templateId: ProposalTemplatePreset['id'],
  overrides: Partial<Proposal> = {},
): Promise<ProposalBundle> {
  return requestApi(
    '/api/proposals',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ templateId, overrides }),
    },
    async () => {
      const store = readLocalStore();
      const created = createProposalFromTemplate(templateId, overrides);
      store.proposals = [created, ...store.proposals];
      writeLocalStore(store);
      return buildLocalBundle(store, created);
    },
  );
}

export async function updateProposal(id: string, patch: Partial<Proposal>): Promise<ProposalBundle> {
  return requestApi(
    `/api/proposals/${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    },
    async () => {
      const store = readLocalStore();
      const idx = store.proposals.findIndex((p) => p.id === id);
      if (idx === -1) throw new ApiError('Proposal not found', 404);
      const current = store.proposals[idx]!;
      if (current.status === 'approved' || current.status === 'invoiced') {
        throw new ApiError('Proposal is locked', 409, 'PROPOSAL_LOCKED');
      }
      const next: Proposal = {
        ...current,
        ...patch,
        id: current.id,
        updatedAt: new Date().toISOString(),
      };
      store.proposals[idx] = next;
      writeLocalStore(store);
      return buildLocalBundle(store, next);
    },
  );
}

export async function publishProposal(id: string): Promise<ProposalBundle> {
  return requestApi(
    `/api/proposals/${encodeURIComponent(id)}/publish`,
    { method: 'POST' },
    async () => {
      const store = readLocalStore();
      const idx = store.proposals.findIndex((p) => p.id === id);
      if (idx === -1) throw new ApiError('Proposal not found', 404);
      const current = store.proposals[idx]!;
      if (current.status === 'approved' || current.status === 'invoiced') {
        throw new ApiError('Proposal is locked', 409, 'PROPOSAL_LOCKED');
      }
      const next: Proposal = { ...current, status: 'sent', updatedAt: new Date().toISOString() };
      store.proposals[idx] = next;
      writeLocalStore(store);
      return {
        ...buildLocalBundle(store, next),
        portalUrl: `${window.location.origin}${withBase(`/p/${next.slug}`)}`,
      };
    },
  );
}

export async function duplicateProposal(id: string): Promise<ProposalBundle> {
  return requestApi(
    `/api/proposals/${encodeURIComponent(id)}/duplicate`,
    { method: 'POST' },
    async () => {
      const store = readLocalStore();
      const source = store.proposals.find((p) => p.id === id);
      if (!source) throw new ApiError('Proposal not found', 404);
      const suffix = Math.random().toString(36).slice(2, 6);
      const now = new Date().toISOString();
      const clone: Proposal = {
        ...source,
        id: `prop_${Date.now().toString(36)}_${suffix}`,
        slug: `${source.slug}-copy-${suffix}`,
        status: 'draft',
        createdAt: now,
        updatedAt: now,
      };
      store.proposals = [clone, ...store.proposals];
      writeLocalStore(store);
      return buildLocalBundle(store, clone);
    },
  );
}

export async function deleteProposal(id: string): Promise<void> {
  await requestApi(
    `/api/proposals/${encodeURIComponent(id)}`,
    { method: 'DELETE' },
    async () => {
      const store = readLocalStore();
      const target = store.proposals.find((p) => p.id === id);
      if (!target) throw new ApiError('Proposal not found', 404);
      if (target.status === 'invoiced' || target.status === 'approved') {
        throw new ApiError('Cannot delete locked proposal', 409, 'PROPOSAL_LOCKED');
      }
      store.proposals = store.proposals.filter((p) => p.id !== id);
      writeLocalStore(store);
      return { ok: true };
    },
  );
}

export async function listInvoices(): Promise<GeneratedInvoice[]> {
  const data = await requestApi<{ invoices: GeneratedInvoice[] }>('/api/invoices', undefined, async () => {
    const store = readLocalStore();
    return { invoices: Object.values(store.invoices) };
  });
  return data.invoices;
}

export async function getInvoice(invoiceNumber: string): Promise<GeneratedInvoice> {
  const data = await requestApi<{ invoice: GeneratedInvoice }>(
    `/api/invoices/${encodeURIComponent(invoiceNumber)}`,
    undefined,
    async () => {
      const store = readLocalStore();
      const found = Object.values(store.invoices).find((i) => i.invoiceNumber === invoiceNumber);
      if (!found) throw new ApiError('Invoice not found', 404);
      return { invoice: found };
    },
  );
  return data.invoice;
}

export async function getPublicProposal(slug: string): Promise<ProposalBundle> {
  return requestApi(`/api/public/proposals/${encodeURIComponent(slug)}`, undefined, async () => {
    const store = readLocalStore();
    const found = store.proposals.find((p) => p.slug === slug && p.status !== 'draft');
    if (!found) throw new ApiError('Published proposal not found', 404);
    store.views[found.id] = (store.views[found.id] ?? 0) + 1;
    writeLocalStore(store);
    return buildLocalBundle(store, found);
  });
}

export interface ApprovePublicInput {
  selectedTierId: string;
  selectedAddonIds: string[];
  signerName: string;
  signerTitle?: string;
  signerEmail?: string;
  signatureType: 'drawn' | 'typed';
  signatureDataUrl?: string;
  scopeAccepted: boolean;
}

export async function approvePublicProposal(
  slug: string,
  payload: ApprovePublicInput,
): Promise<ProposalBundle> {
  return requestApi(
    `/api/public/proposals/${encodeURIComponent(slug)}/approve`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
    async () => {
      const store = readLocalStore();
      const idx = store.proposals.findIndex((p) => p.slug === slug && p.status !== 'draft');
      if (idx === -1) throw new ApiError('Published proposal not found', 404);
      const current = store.proposals[idx]!;
      if (current.status !== 'sent' || store.approvals[current.id]) {
        throw new ApiError('Already approved', 409, 'ALREADY_APPROVED');
      }
      const canonical = buildScopeLockCanonicalText(
        current,
        payload.selectedTierId,
        payload.selectedAddonIds,
      );
      const digest = await computeScopeDigestHex(canonical);
      const approvedAt = new Date().toISOString();
      const approval: ClientApproval = {
        proposalId: current.id,
        selectedTierId: payload.selectedTierId,
        selectedAddonIds: payload.selectedAddonIds,
        signerName: payload.signerName.trim(),
        signerTitle: payload.signerTitle,
        signerEmail: payload.signerEmail,
        signatureType: payload.signatureType,
        signatureDataUrl: payload.signatureDataUrl,
        scopeAccepted: true,
        scopeDigestHex: digest,
        approvedAt,
      };
      store.seq += 1;
      const year = new Date().getUTCFullYear();
      const invNum = `INV-${year}-${String(store.seq).padStart(4, '0')}`;
      const updated: Proposal = {
        ...current,
        status: 'invoiced',
        selectedTierId: payload.selectedTierId,
        selectedAddonIds: payload.selectedAddonIds,
        updatedAt: approvedAt,
      };
      const invoice = generateDepositInvoice(updated, approval, invNum, approvedAt);
      store.proposals[idx] = updated;
      store.approvals[current.id] = approval;
      store.invoices[current.id] = invoice;
      writeLocalStore(store);
      return buildLocalBundle(store, updated);
    },
  );
}
