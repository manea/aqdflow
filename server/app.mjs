import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import QRCode from 'qrcode';
import {
  buildScopeLockCanonicalText,
  computeProposalTotals,
  computeScopeDigestHex,
  generateDepositInvoice,
} from '../src/core/taxAndPricing.ts';
import {
  PROPOSAL_TEMPLATES,
  createProposalFromTemplate,
} from '../src/core/templates.ts';
import { openAqdFlowDatabase } from './db.mjs';

const __serverDir = path.dirname(fileURLToPath(import.meta.url));
let APP_VERSION = '0.4.0';
try {
  const pkgJson = JSON.parse(
    fs.readFileSync(path.resolve(__serverDir, '../package.json'), 'utf8'),
  );
  if (typeof pkgJson.version === 'string' && pkgJson.version.trim()) {
    APP_VERSION = pkgJson.version.trim();
  }
} catch {
  // fallback version when package.json cannot be read
}

const MAX_JSON_BODY = 1024 * 1024; // 1 MB
const MAX_SIGNATURE_DATA_URL_LEN = 512 * 1024;

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'same-origin',
  'X-Frame-Options': 'SAMEORIGIN',
};

const MIME_BY_EXT = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.pdf': 'application/pdf',
  '.ico': 'image/x-icon',
};

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...SECURITY_HEADERS,
  });
  res.end(JSON.stringify(payload));
}

function sendSvg(res, statusCode, svgBody) {
  res.writeHead(statusCode, {
    'Content-Type': 'image/svg+xml; charset=utf-8',
    'Cache-Control': 'public, max-age=3600',
    ...SECURITY_HEADERS,
  });
  res.end(svgBody);
}

async function readJsonBody(req) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > MAX_JSON_BODY) {
      const err = new Error('JSON body exceeds 1 MB limit');
      err.statusCode = 413;
      err.code = 'PAYLOAD_TOO_LARGE';
      throw err;
    }
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks).toString('utf8').trim();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    const err = new Error('Invalid JSON payload');
    err.statusCode = 400;
    err.code = 'INVALID_JSON';
    throw err;
  }
}

function normalizeBasePath(raw) {
  if (!raw || typeof raw !== 'string') return '';
  let trimmed = raw.trim();
  if (!trimmed || trimmed === '/') return '';
  if (!trimmed.startsWith('/')) trimmed = `/${trimmed}`;
  return trimmed.replace(/\/+$/, '');
}

function resolveBaseUrl(req, normalizedAppOrigin, normalizedBasePath = '') {
  if (normalizedAppOrigin) return normalizedAppOrigin;
  const protoHeader = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim().toLowerCase();
  const proto = protoHeader || (req.socket?.encrypted ? 'https' : 'http');
  const hostHeader = String(req.headers['x-forwarded-host'] || req.headers.host || '127.0.0.1:4179')
    .split(',')[0]
    .trim();
  return `${proto}://${hostHeader}${normalizedBasePath}`;
}

function extractClientFingerprints(req, sha256Hex) {
  const ipRaw = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '')
    .split(',')[0]
    .trim();
  const uaRaw = String(req.headers['user-agent'] || '').trim();
  return {
    ipHash: ipRaw ? sha256Hex(ipRaw) : '',
    userAgentHash: uaRaw ? sha256Hex(uaRaw) : '',
  };
}

function enrichBundle(bundle) {
  return {
    ...bundle,
    totals: computeProposalTotals(bundle.proposal),
  };
}

function validateAndNormalizeCreatePayload(body) {
  if (typeof body.templateId === 'string' && body.templateId.trim()) {
    const matchedTemplate = PROPOSAL_TEMPLATES.find((t) => t.id === body.templateId);
    if (!matchedTemplate) {
      const err = new Error(`Unknown templateId: ${body.templateId}`);
      err.statusCode = 400;
      err.code = 'VALIDATION_ERROR';
      throw err;
    }
    const overrides =
      body.overrides && typeof body.overrides === 'object' && !Array.isArray(body.overrides)
        ? body.overrides
        : {};
    return createProposalFromTemplate(matchedTemplate.id, overrides);
  }

  const candidate =
    body.proposal && typeof body.proposal === 'object' ? body.proposal : body;
  const titleAr = String(candidate.titleAr ?? '').trim();
  const titleEn = String(candidate.titleEn ?? '').trim();
  if (!titleAr && !titleEn) {
    const err = new Error('Proposal titleAr or titleEn is required');
    err.statusCode = 400;
    err.code = 'VALIDATION_ERROR';
    throw err;
  }

  if (!Array.isArray(candidate.tiers) || candidate.tiers.length === 0) {
    const err = new Error('Proposal must include at least one pricing tier');
    err.statusCode = 400;
    err.code = 'VALIDATION_ERROR';
    throw err;
  }

  const firstTierId = String(candidate.tiers[0].id || 'tier-1');
  return {
    ...candidate,
    status: candidate.status === 'sent' ? 'sent' : 'draft',
    defaultLocale: candidate.defaultLocale === 'en' ? 'en' : 'ar',
    currency: candidate.currency || 'AED',
    taxRegime: candidate.taxRegime || 'uae_fta_5',
    titleAr: titleAr || titleEn,
    titleEn: titleEn || titleAr,
    subtitleAr: String(candidate.subtitleAr ?? ''),
    subtitleEn: String(candidate.subtitleEn ?? ''),
    seller: {
      nameAr: '',
      nameEn: '',
      addressAr: '',
      addressEn: '',
      ...(candidate.seller ?? {}),
    },
    client: {
      nameAr: '',
      nameEn: '',
      addressAr: '',
      addressEn: '',
      ...(candidate.client ?? {}),
    },
    tiers: candidate.tiers,
    selectedTierId: String(candidate.selectedTierId || firstTierId),
    addons: Array.isArray(candidate.addons) ? candidate.addons : [],
    selectedAddonIds: Array.isArray(candidate.selectedAddonIds) ? candidate.selectedAddonIds : [],
    deliverables: Array.isArray(candidate.deliverables) ? candidate.deliverables : [],
    revisionRounds: Number.isFinite(Number(candidate.revisionRounds)) ? Number(candidate.revisionRounds) : 2,
    validityDays: Number.isFinite(Number(candidate.validityDays)) ? Number(candidate.validityDays) : 14,
    depositPercent: Number.isFinite(Number(candidate.depositPercent)) ? Number(candidate.depositPercent) : 50,
    paymentChannels: candidate.paymentChannels ?? {},
  };
}

function validateApprovalPayload(body, proposal) {
  if (!body || typeof body !== 'object') {
    return { error: 'Approval payload must be a JSON object' };
  }

  const selectedTierId = typeof body.selectedTierId === 'string' ? body.selectedTierId.trim() : '';
  if (!selectedTierId || !proposal.tiers.some((t) => t.id === selectedTierId)) {
    return { error: 'selectedTierId must reference a valid pricing tier on this proposal' };
  }

  const rawAddonIds = body.selectedAddonIds === undefined ? [] : body.selectedAddonIds;
  if (!Array.isArray(rawAddonIds)) {
    return { error: 'selectedAddonIds must be an array of add-on IDs' };
  }
  const validAddonMap = new Set(proposal.addons.map((a) => a.id));
  const selectedAddonIds = [];
  const seenAddons = new Set();
  for (const rawId of rawAddonIds) {
    if (typeof rawId !== 'string' || !validAddonMap.has(rawId)) {
      return { error: `Invalid add-on id in selectedAddonIds: ${String(rawId)}` };
    }
    if (!seenAddons.has(rawId)) {
      seenAddons.add(rawId);
      selectedAddonIds.push(rawId);
    }
  }

  const signerName = typeof body.signerName === 'string' ? body.signerName.trim() : '';
  if (signerName.length < 2) {
    return { error: 'signerName must be at least 2 characters' };
  }

  if (body.scopeAccepted !== true) {
    return { error: 'scopeAccepted must be explicitly true to lock proposal scope' };
  }

  const signatureType = body.signatureType;
  if (signatureType !== 'drawn' && signatureType !== 'typed') {
    return { error: "signatureType must be 'drawn' or 'typed'" };
  }

  let signatureDataUrl;
  if (signatureType === 'drawn') {
    if (
      typeof body.signatureDataUrl !== 'string' ||
      !body.signatureDataUrl.startsWith('data:image/png;base64,') ||
      body.signatureDataUrl.length > MAX_SIGNATURE_DATA_URL_LEN
    ) {
      return {
        error: 'Drawn signatureDataUrl must be a valid PNG base64 data URL within 512 KB',
      };
    }
    signatureDataUrl = body.signatureDataUrl;
  } else if (typeof body.signatureDataUrl === 'string') {
    signatureDataUrl = body.signatureDataUrl.slice(0, 1024);
  }

  return {
    value: {
      selectedTierId,
      selectedAddonIds,
      signerName,
      signerTitle: typeof body.signerTitle === 'string' ? body.signerTitle.trim() : undefined,
      signerEmail: typeof body.signerEmail === 'string' ? body.signerEmail.trim() : undefined,
      signatureType,
      signatureDataUrl,
    },
  };
}

function serveStaticAsset(res, pathname, resolvedDist, method = 'GET', normalizedBasePath = '') {
  if (!resolvedDist || !fs.existsSync(resolvedDist)) {
    sendJson(res, 404, { error: 'Not found' });
    return;
  }

  let decodedPath = '/';
  try {
    decodedPath = decodeURIComponent(pathname || '/');
  } catch {
    sendJson(res, 400, { error: 'Malformed path' });
    return;
  }

  const cleanRel = decodedPath.replace(/^\/+/, '');
  const candidate = path.resolve(resolvedDist, cleanRel || 'index.html');
  if (candidate !== resolvedDist && !candidate.startsWith(resolvedDist + path.sep)) {
    sendJson(res, 403, { error: 'Forbidden' });
    return;
  }

  let fileToServe = null;
  if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
    fileToServe = candidate;
  } else {
    const indexFallback = path.join(resolvedDist, 'index.html');
    if (fs.existsSync(indexFallback) && fs.statSync(indexFallback).isFile()) {
      fileToServe = indexFallback;
    }
  }

  if (!fileToServe) {
    sendJson(res, 404, { error: 'Static asset not found' });
    return;
  }

  const ext = path.extname(fileToServe).toLowerCase();
  const contentType = MIME_BY_EXT[ext] || 'application/octet-stream';

  if (ext === '.html' && normalizedBasePath) {
    let html = fs.readFileSync(fileToServe, 'utf8');
    html = html
      .replaceAll('href="/', `href="${normalizedBasePath}/`)
      .replaceAll('src="/', `src="${normalizedBasePath}/`);
    const baseScript = `<script>window.__AQDFLOW_BASE__=${JSON.stringify(normalizedBasePath)};</script>`;
    html = html.includes('</head>') ? html.replace('</head>', `${baseScript}</head>`) : `${baseScript}${html}`;
    const bodyBuf = Buffer.from(html, 'utf8');
    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': bodyBuf.byteLength,
      'Cache-Control': 'no-cache',
      ...SECURITY_HEADERS,
    });
    if (method === 'HEAD') {
      res.end();
      return;
    }
    res.end(bodyBuf);
    return;
  }

  res.writeHead(200, {
    'Content-Type': contentType,
    'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable',
    ...SECURITY_HEADERS,
  });
  if (method === 'HEAD') {
    res.end();
    return;
  }
  fs.createReadStream(fileToServe).pipe(res);
}

export function createAqdFlowServer({ dataDir, distDir = '', appOrigin = '', basePath = '' }) {
  const db = openAqdFlowDatabase(dataDir);
  const resolvedDist = distDir ? path.resolve(distDir) : null;
  const normalizedAppOrigin = String(appOrigin || '').replace(/\/+$/, '');
  const normalizedBasePath = normalizeBasePath(basePath);

  async function handleApiRequest(req, res, method, pathname) {
    // 1. Health & Templates
    if (method === 'GET' && pathname === '/api/health') {
      const stats = db.getStats();
      return sendJson(res, 200, {
        ok: true,
        service: 'aqdflow',
        version: APP_VERSION,
        basePath: normalizedBasePath || '/',
        proposalsCount: stats.total,
        invoicesCount: stats.invoicesCount,
        timestamp: new Date().toISOString(),
      });
    }

    if (method === 'GET' && pathname === '/api/templates') {
      return sendJson(res, 200, {
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
      });
    }

    // 2. Proposals Collection
    if (method === 'GET' && pathname === '/api/proposals') {
      const items = db.listProposals().map((item) => ({
        ...item,
        totals: computeProposalTotals(item.proposal),
      }));
      return sendJson(res, 200, { proposals: items, stats: db.getStats() });
    }

    if (method === 'POST' && pathname === '/api/proposals') {
      const body = await readJsonBody(req);
      const normalized = validateAndNormalizeCreatePayload(body);
      const bundle = db.createProposal(normalized);
      return sendJson(res, 201, enrichBundle(bundle));
    }

    // 3. Proposal Actions (/api/proposals/:id/*)
    const publishMatch = pathname.match(/^\/api\/proposals\/([^/]+)\/publish$/);
    if (method === 'POST' && publishMatch) {
      const id = decodeURIComponent(publishMatch[1] ?? '');
      const bundle = db.publishProposal(id);
      if (!bundle) return sendJson(res, 404, { error: 'Proposal not found' });
      const portalUrl = `${resolveBaseUrl(req, normalizedAppOrigin, normalizedBasePath)}/p/${bundle.proposal.slug}`;
      return sendJson(res, 200, { ...enrichBundle(bundle), portalUrl });
    }

    const duplicateMatch = pathname.match(/^\/api\/proposals\/([^/]+)\/duplicate$/);
    if (method === 'POST' && duplicateMatch) {
      const id = decodeURIComponent(duplicateMatch[1] ?? '');
      const bundle = db.duplicateProposal(id);
      if (!bundle) return sendJson(res, 404, { error: 'Proposal not found' });
      return sendJson(res, 201, enrichBundle(bundle));
    }

    const proposalItemMatch = pathname.match(/^\/api\/proposals\/([^/]+)$/);
    if (proposalItemMatch) {
      const id = decodeURIComponent(proposalItemMatch[1] ?? '');
      if (method === 'GET') {
        const bundle = db.getProposalById(id);
        if (!bundle) return sendJson(res, 404, { error: 'Proposal not found' });
        return sendJson(res, 200, enrichBundle(bundle));
      }
      if (method === 'PATCH') {
        const patch = await readJsonBody(req);
        if (patch.tiers !== undefined && (!Array.isArray(patch.tiers) || patch.tiers.length === 0)) {
          return sendJson(res, 400, {
            error: 'tiers must be a non-empty array',
            code: 'VALIDATION_ERROR',
          });
        }
        const bundle = db.updateProposal(id, patch);
        if (!bundle) return sendJson(res, 404, { error: 'Proposal not found' });
        return sendJson(res, 200, enrichBundle(bundle));
      }
      if (method === 'DELETE') {
        const deleted = db.deleteProposal(id);
        if (!deleted) return sendJson(res, 404, { error: 'Proposal not found' });
        return sendJson(res, 200, { ok: true, deletedId: id });
      }
    }

    // 4. Invoices Endpoints
    if (method === 'GET' && pathname === '/api/invoices') {
      return sendJson(res, 200, { invoices: db.listInvoices() });
    }

    const invoiceDetailMatch = pathname.match(/^\/api\/invoices\/([^/]+)$/);
    if (method === 'GET' && invoiceDetailMatch) {
      const invoiceNumber = decodeURIComponent(invoiceDetailMatch[1] ?? '');
      const invoice = db.getInvoiceByNumber(invoiceNumber);
      if (!invoice) return sendJson(res, 404, { error: 'Invoice not found' });
      return sendJson(res, 200, { invoice });
    }

    // 5. Public Client Portal & QR Endpoints
    const publicApproveMatch = pathname.match(/^\/api\/public\/proposals\/([^/]+)\/approve$/);
    if (method === 'POST' && publicApproveMatch) {
      const slug = decodeURIComponent(publicApproveMatch[1] ?? '');
      const existing = db.getProposalBySlug(slug);
      if (!existing || existing.proposal.status === 'draft') {
        return sendJson(res, 404, { error: 'Published proposal not found' });
      }
      if (existing.proposal.status !== 'sent' || existing.approval || existing.invoice) {
        return sendJson(res, 409, {
          error: 'Proposal has already been approved and locked',
          code: 'ALREADY_APPROVED',
        });
      }

      const body = await readJsonBody(req);
      const checked = validateApprovalPayload(body, existing.proposal);
      if ('error' in checked) {
        return sendJson(res, 400, { error: checked.error, code: 'VALIDATION_ERROR' });
      }

      const { selectedTierId, selectedAddonIds, signerName, signerTitle, signerEmail, signatureType, signatureDataUrl } =
        checked.value;
      const canonicalText = buildScopeLockCanonicalText(
        existing.proposal,
        selectedTierId,
        selectedAddonIds,
      );
      const scopeDigestHex = await computeScopeDigestHex(canonicalText);
      const approvedAt = new Date().toISOString();

      const approvalRecord = {
        proposalId: existing.proposal.id,
        selectedTierId,
        selectedAddonIds,
        signerName,
        signerTitle,
        signerEmail,
        signatureType,
        signatureDataUrl,
        scopeAccepted: true,
        scopeDigestHex,
        approvedAt,
      };

      const { ipHash, userAgentHash } = extractClientFingerprints(req, db.sha256Hex);
      const approvedBundle = db.approveProposalAtomic({
        slug,
        approval: approvalRecord,
        ipHash,
        userAgentHash,
        invoiceBuilder: (updatedProposal, invoiceNumber) =>
          generateDepositInvoice(updatedProposal, approvalRecord, invoiceNumber, approvedAt),
      });

      return sendJson(res, 201, {
        proposal: approvedBundle.proposal,
        totals: computeProposalTotals(approvedBundle.proposal),
        approval: approvedBundle.approval,
        invoice: approvedBundle.invoice,
      });
    }

    const publicProposalMatch = pathname.match(/^\/api\/public\/proposals\/([^/]+)$/);
    if (method === 'GET' && publicProposalMatch) {
      const slug = decodeURIComponent(publicProposalMatch[1] ?? '');
      const { ipHash, userAgentHash } = extractClientFingerprints(req, db.sha256Hex);
      const bundle = db.recordPublicView(slug, ipHash, userAgentHash);
      if (!bundle) {
        return sendJson(res, 404, { error: 'Published proposal not found' });
      }
      return sendJson(res, 200, {
        proposal: bundle.proposal,
        totals: computeProposalTotals(bundle.proposal),
        approval: bundle.approval,
        invoice: bundle.invoice,
        viewCount: bundle.viewCount,
      });
    }

    const qrSvgMatch = pathname.match(/^\/api\/public\/invoices\/([^/]+)\/qr\.svg$/);
    if (method === 'GET' && qrSvgMatch) {
      const invoiceNumber = decodeURIComponent(qrSvgMatch[1] ?? '');
      const invoice = db.getInvoiceByNumber(invoiceNumber);
      if (!invoice || !invoice.zatcaQrBase64) {
        return sendJson(res, 404, { error: 'ZATCA QR code not available for this invoice' });
      }
      const svg = await QRCode.toString(invoice.zatcaQrBase64, {
        type: 'svg',
        errorCorrectionLevel: 'M',
        margin: 2,
      });
      return sendSvg(res, 200, svg);
    }

    return sendJson(res, 404, { error: 'API endpoint not found' });
  }

  async function handler(req, res) {
    try {
      const parsedUrl = new URL(req.url || '/', 'http://localhost');
      let pathname = parsedUrl.pathname;
      if (
        normalizedBasePath &&
        (pathname === normalizedBasePath || pathname.startsWith(`${normalizedBasePath}/`))
      ) {
        pathname = pathname.slice(normalizedBasePath.length) || '/';
      }
      const method = String(req.method || 'GET').toUpperCase();

      if (pathname.startsWith('/api/')) {
        await handleApiRequest(req, res, method, pathname);
        return;
      }

      if (method !== 'GET' && method !== 'HEAD') {
        sendJson(res, 405, { error: 'Method not allowed' });
        return;
      }

      serveStaticAsset(res, pathname, resolvedDist, method, normalizedBasePath);
    } catch (err) {
      const statusCode = Number(err?.statusCode) || 500;
      const payload = {
        error: err?.message || 'Internal server error',
        ...(err?.code ? { code: err.code } : {}),
      };
      if (!res.headersSent) {
        sendJson(res, statusCode, payload);
      } else {
        res.end();
      }
    }
  }

  return {
    handler,
    close: () => db.close(),
  };
}
