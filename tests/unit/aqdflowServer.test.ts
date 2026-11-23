import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAqdFlowServer } from '../../server/app.mjs';
import {
  buildScopeLockCanonicalText,
  computeScopeDigestHex,
} from '../../src/core/taxAndPricing.ts';
import type { Proposal } from '../../src/core/types.ts';
import { decodeZatcaTlvBase64 } from '../../src/core/zatca.ts';

describe('AqdFlow HTTP Server & SQLite WAL Integration', () => {
  let tmpDir = '';
  let server: http.Server;
  let closeDb: () => void;
  let baseUrl = '';
  const currentYear = new Date().getUTCFullYear();

  beforeAll(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aqdflow-srv-test-'));
    const instance = createAqdFlowServer({ dataDir: tmpDir });
    closeDb = instance.close;
    server = http.createServer(instance.handler);
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve());
    });
    const addr = server.address();
    if (!addr || typeof addr === 'string') {
      throw new Error('Failed to bind ephemeral port');
    }
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  afterAll(async () => {
    if (closeDb) closeDb();
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    if (tmpDir && fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  async function apiJson(route: string, init?: RequestInit) {
    const res = await fetch(`${baseUrl}${route}`, init);
    const data = (await res.json()) as Record<string, unknown>;
    return { res, data };
  }

  it('serves health check with security headers and lists 4 bilingual templates', async () => {
    const health = await apiJson('/api/health');
    expect(health.res.status).toBe(200);
    expect(health.res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(health.res.headers.get('x-frame-options')).toBe('SAMEORIGIN');
    expect(health.data.ok).toBe(true);
    expect(health.data.service).toBe('aqdflow');
    expect(health.data.proposalsCount).toBe(0);

    const templates = await apiJson('/api/templates');
    expect(templates.res.status).toBe(200);
    expect(Array.isArray(templates.data.templates)).toBe(true);
    expect(templates.data.templates).toHaveLength(4);
  });

  it('handles draft lifecycle, hides drafts from public portal, and publishes with view count tracking', async () => {
    const created = await apiJson('/api/proposals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        templateId: 'saas-mvp',
        overrides: { slug: 'ksa-cloud-mvp' },
      }),
    });
    expect(created.res.status).toBe(201);
    const createdProposal = created.data.proposal as Proposal;
    expect(createdProposal.status).toBe('draft');
    expect(createdProposal.slug).toBe('ksa-cloud-mvp');

    // Draft must not be visible publicly
    const publicDraft = await apiJson('/api/public/proposals/ksa-cloud-mvp');
    expect(publicDraft.res.status).toBe(404);

    // Update draft via PATCH
    const updated = await apiJson(`/api/proposals/${createdProposal.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        notesAr: 'ملاحظة اختبارية محدثة قبل الإرسال',
      }),
    });
    expect(updated.res.status).toBe(200);
    expect((updated.data.proposal as Proposal).notesAr).toBe('ملاحظة اختبارية محدثة قبل الإرسال');

    // Publish -> sent
    const published = await apiJson(`/api/proposals/${createdProposal.id}/publish`, {
      method: 'POST',
    });
    expect(published.res.status).toBe(200);
    expect((published.data.proposal as Proposal).status).toBe('sent');
    expect(published.data.portalUrl).toBe(`${baseUrl}/p/ksa-cloud-mvp`);

    // Public portal fetch increments viewCount
    const publicView1 = await apiJson('/api/public/proposals/ksa-cloud-mvp', {
      headers: { 'User-Agent': 'AqdFlow-TestBrowser/1.0' },
    });
    expect(publicView1.res.status).toBe(200);
    expect(publicView1.data.viewCount).toBe(1);

    const publicView2 = await apiJson('/api/public/proposals/ksa-cloud-mvp');
    expect(publicView2.res.status).toBe(200);
    expect(publicView2.data.viewCount).toBe(2);
  });

  it('validates client approval, enforces scope lock, issues KSA invoice + SVG QR, blocks mutation/re-approval, and supports duplicate', async () => {
    const listRes = await apiJson('/api/proposals');
    const items = listRes.data.proposals as Array<{ id: string; slug: string }>;
    const ksaSummary = items.find((p) => p.slug === 'ksa-cloud-mvp');
    expect(ksaSummary).toBeDefined();

    const detail = await apiJson(`/api/proposals/${ksaSummary!.id}`);
    const ksaProposal = detail.data.proposal as Proposal;

    // 1) Reject scopeAccepted !== true
    const missingScope = await apiJson('/api/public/proposals/ksa-cloud-mvp/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        selectedTierId: 'tier-mvp',
        selectedAddonIds: [],
        signerName: 'فهد القحطاني',
        signatureType: 'typed',
        scopeAccepted: false,
      }),
    });
    expect(missingScope.res.status).toBe(400);

    // 2) Reject non-existent tier
    const badTier = await apiJson('/api/public/proposals/ksa-cloud-mvp/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        selectedTierId: 'tier-does-not-exist',
        selectedAddonIds: [],
        signerName: 'فهد القحطاني',
        signatureType: 'typed',
        scopeAccepted: true,
      }),
    });
    expect(badTier.res.status).toBe(400);

    // 3) Reject invalid drawn signature without data:image/png;base64, prefix
    const badSignature = await apiJson('/api/public/proposals/ksa-cloud-mvp/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        selectedTierId: 'tier-mvp',
        selectedAddonIds: ['addon-landing'],
        signerName: 'فهد القحطاني',
        signatureType: 'drawn',
        signatureDataUrl: 'https://example.com/fake.png',
        scopeAccepted: true,
      }),
    });
    expect(badSignature.res.status).toBe(400);

    // 4) Valid approval -> 201 Created
    const expectedDigest = await computeScopeDigestHex(
      buildScopeLockCanonicalText(ksaProposal, 'tier-mvp', ['addon-landing']),
    );
    const approveRes = await apiJson('/api/public/proposals/ksa-cloud-mvp/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        selectedTierId: 'tier-mvp',
        selectedAddonIds: ['addon-landing'],
        signerName: 'فهد القحطاني',
        signerTitle: 'المدير التنفيذي',
        signatureType: 'typed',
        scopeAccepted: true,
      }),
    });
    expect(approveRes.res.status).toBe(201);

    const approval = approveRes.data.approval as { scopeDigestHex: string; signerName: string };
    const invoice = approveRes.data.invoice as {
      invoiceNumber: string;
      totalAmount: number;
      taxAmount: number;
      zatcaQrBase64?: string;
    };
    expect(approval.scopeDigestHex).toHaveLength(64);
    expect(approval.scopeDigestHex).toBe(expectedDigest);
    expect(invoice.invoiceNumber).toBe(`INV-${currentYear}-0001`);
    // 18500 + 2500 = 21000 + 15% = 24150; 40% deposit = 9660.00 (VAT 1260.00)
    expect(invoice.totalAmount).toBe(9660);
    expect(invoice.taxAmount).toBe(1260);
    expect(invoice.zatcaQrBase64).toBeTruthy();

    const decodedQr = decodeZatcaTlvBase64(invoice.zatcaQrBase64!);
    expect(decodedQr[2]).toBe('300000000000003');
    expect(decodedQr[4]).toBe('9660.00');
    expect(decodedQr[5]).toBe('1260.00');

    // 5) Re-approval rejected with 409
    const reApprove = await apiJson('/api/public/proposals/ksa-cloud-mvp/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        selectedTierId: 'tier-mvp',
        selectedAddonIds: [],
        signerName: 'مستخدم آخر',
        signatureType: 'typed',
        scopeAccepted: true,
      }),
    });
    expect(reApprove.res.status).toBe(409);

    // 6) PATCH on locked proposal rejected with 409
    const lockedPatch = await apiJson(`/api/proposals/${ksaProposal.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notesAr: 'محاولة تعديل بعد القفل' }),
    });
    expect(lockedPatch.res.status).toBe(409);

    // 7) DELETE on invoiced proposal rejected with 409
    const lockedDelete = await apiJson(`/api/proposals/${ksaProposal.id}`, {
      method: 'DELETE',
    });
    expect(lockedDelete.res.status).toBe(409);

    // 8) SVG QR endpoint returns actual SVG XML
    const qrSvgRes = await fetch(`${baseUrl}/api/public/invoices/${invoice.invoiceNumber}/qr.svg`);
    expect(qrSvgRes.status).toBe(200);
    expect(qrSvgRes.headers.get('content-type')).toContain('image/svg+xml');
    const svgText = await qrSvgRes.text();
    expect(svgText).toContain('<svg');

    // 9) Duplicate locked proposal creates fresh editable draft with unique slug
    const dupRes = await apiJson(`/api/proposals/${ksaProposal.id}/duplicate`, {
      method: 'POST',
    });
    expect(dupRes.res.status).toBe(201);
    const dupProposal = dupRes.data.proposal as Proposal;
    expect(dupProposal.status).toBe('draft');
    expect(dupProposal.id).not.toBe(ksaProposal.id);
    expect(dupProposal.slug).not.toBe(ksaProposal.slug);

    const patchDup = await apiJson(`/api/proposals/${dupProposal.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ titleAr: 'نسخة محدثة قابلة للتعديل' }),
    });
    expect(patchDup.res.status).toBe(200);
    expect((patchDup.data.proposal as Proposal).titleAr).toBe('نسخة محدثة قابلة للتعديل');

    // Draft duplicate can also be deleted cleanly
    const delDup = await apiJson(`/api/proposals/${dupProposal.id}`, {
      method: 'DELETE',
    });
    expect(delDup.res.status).toBe(200);
  });

  it('issues UAE Full Tax Invoice above AED 10,000 for VAT-registered B2B client, increments sequence, and returns 404 on qr.svg', async () => {
    const created = await apiJson('/api/proposals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        templateId: 'web-commerce',
        overrides: {
          slug: 'uae-b2b-commerce',
          client: {
            nameAr: 'مجموعة الإمارات للتجزئة',
            nameEn: 'Emirates Retail Group LLC',
            addressAr: 'أبوظبي، الإمارات',
            addressEn: 'Abu Dhabi, UAE',
            trn: '100444444444443',
            vatRegistered: true,
          },
        },
      }),
    });
    expect(created.res.status).toBe(201);
    const uaeProposal = created.data.proposal as Proposal;

    await apiJson(`/api/proposals/${uaeProposal.id}/publish`, { method: 'POST' });

    // tier-enterprise = 14,500 AED + 5% VAT = 15,225 AED (> 10,000 AED, vatRegistered=true)
    const approveRes = await apiJson('/api/public/proposals/uae-b2b-commerce/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        selectedTierId: 'tier-enterprise',
        selectedAddonIds: [],
        signerName: 'خالد المنصوري',
        signatureType: 'typed',
        scopeAccepted: true,
      }),
    });
    expect(approveRes.res.status).toBe(201);
    const invoice = approveRes.data.invoice as {
      invoiceNumber: string;
      classification: string;
      totalAmount: number;
      taxAmount: number;
      zatcaQrBase64?: string;
    };
    expect(invoice.classification).toBe('uae_full_tax_invoice');
    expect(invoice.invoiceNumber).toBe(`INV-${currentYear}-0002`);
    // 50% deposit of 15,225 = 7,612.50 AED (net 7,250.00 + VAT 362.50)
    expect(invoice.totalAmount).toBe(7612.5);
    expect(invoice.taxAmount).toBe(362.5);
    expect(invoice.zatcaQrBase64).toBeUndefined();

    // No ZATCA QR on UAE invoice -> 404
    const qrRes = await fetch(`${baseUrl}/api/public/invoices/${invoice.invoiceNumber}/qr.svg`);
    expect(qrRes.status).toBe(404);

    // Invoices listing & detail endpoints
    const allInvoices = await apiJson('/api/invoices');
    expect(allInvoices.res.status).toBe(200);
    expect((allInvoices.data.invoices as unknown[]).length).toBe(2);

    const invDetail = await apiJson(`/api/invoices/${invoice.invoiceNumber}`);
    expect(invDetail.res.status).toBe(200);
    expect((invDetail.data.invoice as { invoiceNumber: string }).invoiceNumber).toBe(
      invoice.invoiceNumber,
    );
  });

  it('supports subpath hosting (BASE_PATH=/aqdflow) for health, HTML asset injection, and portalUrl generation', async () => {
    const subDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aqdflow-subpath-data-'));
    const subDistDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aqdflow-subpath-dist-'));
    fs.writeFileSync(
      path.join(subDistDir, 'index.html'),
      '<!doctype html><html><head><link rel="icon" href="/favicon.svg" /><script type="module" src="/assets/app.js"></script></head><body><div id="root"></div></body></html>',
      'utf8',
    );
    const subInstance = createAqdFlowServer({
      dataDir: subDataDir,
      distDir: subDistDir,
      appOrigin: 'https://example.test/aqdflow',
      basePath: '/aqdflow',
    });
    const subServer = http.createServer(subInstance.handler);
    await new Promise<void>((resolve) => subServer.listen(0, '127.0.0.1', () => resolve()));

    try {
      const addr = subServer.address();
      if (!addr || typeof addr === 'string') {
        throw new Error('Failed to bind subpath test server');
      }
      const subBaseUrl = `http://127.0.0.1:${addr.port}`;

      // Both prefixed (/aqdflow/api/health) and proxy-stripped (/api/health) requests work cleanly
      const prefixedHealth = await fetch(`${subBaseUrl}/aqdflow/api/health`);
      expect(prefixedHealth.status).toBe(200);
      const prefixedHealthJson = (await prefixedHealth.json()) as { ok: boolean; basePath: string };
      expect(prefixedHealthJson.ok).toBe(true);
      expect(prefixedHealthJson.basePath).toBe('/aqdflow');

      const strippedHealth = await fetch(`${subBaseUrl}/api/health`);
      expect(strippedHealth.status).toBe(200);
      const strippedHealthJson = (await strippedHealth.json()) as { basePath: string };
      expect(strippedHealthJson.basePath).toBe('/aqdflow');

      // HTML injects __AQDFLOW_BASE__ and prefixes root asset URLs cleanly
      const htmlRes = await fetch(`${subBaseUrl}/aqdflow/`);
      expect(htmlRes.status).toBe(200);
      const html = await htmlRes.text();
      expect(html).toContain('window.__AQDFLOW_BASE__="/aqdflow"');
      expect(html).toContain('src="/aqdflow/assets/app.js"');
      expect(html).toContain('href="/aqdflow/favicon.svg"');

      // Publishing generates the subpath portalUrl using appOrigin
      const createRes = await fetch(`${subBaseUrl}/aqdflow/api/proposals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId: 'web-commerce', overrides: { slug: 'subpath-test' } }),
      });
      expect(createRes.status).toBe(201);
      const createdJson = (await createRes.json()) as { proposal: { id: string } };

      const pubRes = await fetch(`${subBaseUrl}/aqdflow/api/proposals/${createdJson.proposal.id}/publish`, {
        method: 'POST',
      });
      expect(pubRes.status).toBe(200);
      const pubJson = (await pubRes.json()) as { portalUrl: string };
      expect(pubJson.portalUrl).toBe('https://example.test/aqdflow/p/subpath-test');
    } finally {
      subInstance.close();
      await new Promise<void>((resolve) => subServer.close(() => resolve()));
      fs.rmSync(subDataDir, { recursive: true, force: true });
      fs.rmSync(subDistDir, { recursive: true, force: true });
    }
  });
});
