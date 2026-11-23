import { expect, test, type Page } from '@playwright/test';

async function assertNoHorizontalOverflow(page: Page) {
  const dims = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  expect(dims.scrollWidth).toBeLessThanOrEqual(dims.innerWidth);
}

test.describe('AqdFlow — Bilingual Proposal, Scope Lock, E-Sign & Tax Invoice E2E', () => {
  test('persists Arabic RTL / Warm Alabaster and toggles Obsidian Dark + English LTR cleanly', async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');

    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'alabaster');
    await page.screenshot({
      path: 'test-results/qa-screenshots/01-studio-ar-alabaster.png',
    });

    await page.getByTestId('toggle-theme-btn').click();
    await page.getByTestId('toggle-locale-btn').click();

    await expect(page.locator('html')).toHaveAttribute('data-theme', 'obsidian');
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await page.screenshot({
      path: 'test-results/qa-screenshots/02-studio-en-obsidian.png',
    });

    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'obsidian');
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');

    await page.getByTestId('toggle-theme-btn').click();
    await page.getByTestId('toggle-locale-btn').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'alabaster');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar');

    expect(errors).toEqual([]);
  });

  test('executes full UAE FTA 5% proposal lifecycle: draft -> publish -> package selection -> typed e-sign -> immutable full tax invoice', async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    const year = new Date().getUTCFullYear();
    const expectedInvNum = `INV-${year}-0001`;

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');

    await page.getByTestId('create-template-web-commerce').click();
    await expect(page.getByTestId('proposal-editor')).toBeVisible();

    await page.getByTestId('input-title-ar').fill('متجر رواء الإماراتي — عرض معتمد');
    await page.getByTestId('save-draft-btn').click();
    await expect(page.getByTestId('save-draft-btn')).toContainText('تم الحفظ');

    await page.getByTestId('preview-portal-btn').click();
    await expect(page.getByTestId('client-portal-view')).toBeVisible();

    // Select enterprise tier (14,500 AED > 10,000 AED Full Tax Invoice threshold) + copywriting add-on (1,200 AED)
    // Subtotal: 15,700 AED, UAE VAT 5%: 785 AED, Grand Total: 16,485.00 AED, Deposit 50%: 8,242.50 AED
    await page.getByTestId('portal-tier-tier-enterprise').click();
    await page.getByTestId('portal-addon-addon-copywriting').check();

    await expect(page.getByTestId('portal-grand-total')).toContainText('16,485.00');
    await expect(page.getByTestId('portal-deposit-due')).toContainText('8,242.50');

    await page.getByTestId('signer-name-input').fill('سالم المنصوري');
    await page.getByTestId('scope-accept-checkbox').check();
    await page.getByTestId('approve-proposal-btn').click();

    await expect(page.getByTestId('tax-invoice-view')).toBeVisible();
    await expect(page.getByTestId('tax-invoice-view')).toContainText(expectedInvNum);
    await expect(page.getByTestId('invoice-scope-digest')).toHaveText(/^[0-9a-f]{64}$/);
    await expect(page.getByTestId('print-invoice-btn')).toBeVisible();

    // Reloading public slug renders locked Tax Invoice with no re-sign form
    await page.reload();
    await expect(page.getByTestId('tax-invoice-view')).toBeVisible();
    await expect(page.getByTestId('tax-invoice-view')).toContainText(expectedInvNum);
    await expect(page.getByTestId('approve-proposal-btn')).toHaveCount(0);

    // Navigate back to Studio -> Invoices ledger -> open standalone /invoice/:num route
    await page.getByTestId('invoice-back-studio-btn').click();
    await page.getByTestId('nav-invoices-btn').click();
    await expect(page.getByTestId('invoices-ledger')).toBeVisible();
    await expect(page.getByTestId('invoices-ledger')).toContainText(expectedInvNum);

    await page.getByTestId('invoices-ledger').locator('tbody tr button').first().click();
    await expect(page).toHaveURL(new RegExp(`/invoice/${expectedInvNum}$`));
    await expect(page.getByTestId('tax-invoice-view')).toBeVisible();
    await expect(page.getByTestId('tax-invoice-view')).toContainText(expectedInvNum);

    expect(errors).toEqual([]);
  });

  test('completes KSA ZATCA 15% proposal with drawn canvas signature, real SVG QR endpoint, and zero mobile 390x844 overflow across all views', async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');

    await page.getByTestId('create-template-saas-mvp').click();
    await expect(page.getByTestId('proposal-editor')).toBeVisible();
    await page.getByTestId('preview-portal-btn').click();
    await expect(page.getByTestId('client-portal-view')).toBeVisible();

    // Switch to mobile viewport 390x844 and check zero horizontal overflow
    await page.setViewportSize({ width: 390, height: 844 });
    await assertNoHorizontalOverflow(page);

    await page.getByTestId('portal-addon-addon-landing').check();
    await page.getByTestId('signer-name-input').fill('نورة العتيبي');
    await page.getByTestId('sig-mode-drawn').click();

    const canvas = page.getByTestId('signature-canvas');
    await expect(canvas).toBeVisible();
    const box = await canvas.boundingBox();
    if (!box) {
      throw new Error('Signature canvas bounding box not available');
    }
    await page.mouse.move(box.x + 25, box.y + box.height * 0.5);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.65, box.y + box.height * 0.4, { steps: 10 });
    await page.mouse.up();

    await page.getByTestId('scope-accept-checkbox').check();
    await page.getByTestId('approve-proposal-btn').click();

    await expect(page.getByTestId('tax-invoice-view')).toBeVisible();
    await expect(page.getByTestId('zatca-qr-card')).toBeVisible();
    await expect(page.getByTestId('zatca-qr-img')).toHaveAttribute(
      'src',
      /^data:image\/svg\+xml;charset=utf-8,/,
    );
    await page.screenshot({
      path: 'test-results/qa-screenshots/03-invoice-ksa-zatca-mobile.png',
      fullPage: true,
    });

    const invoiceText = await page.getByTestId('tax-invoice-view').innerText();
    const invMatch = /INV-\d{4}-\d{4}/.exec(invoiceText);
    expect(invMatch).not.toBeNull();
    const invNum = invMatch![0];

    const qrRes = await page.request.get(`/api/public/invoices/${encodeURIComponent(invNum)}/qr.svg`);
    expect(qrRes.status()).toBe(200);
    expect(qrRes.headers()['content-type'] ?? '').toContain('image/svg+xml');
    const qrSvgBody = await qrRes.text();
    expect(qrSvgBody).toContain('<svg');

    // Verify mobile 390x844 overflow across all primary screens
    await assertNoHorizontalOverflow(page); // (a) Tax Invoice view

    await page.getByTestId('invoice-back-studio-btn').click();
    await expect(page.getByTestId('proposals-list')).toBeVisible();
    await assertNoHorizontalOverflow(page); // (b) Studio dashboard

    await page.getByTestId('nav-invoices-btn').click();
    await expect(page.getByTestId('invoices-ledger')).toBeVisible();
    await assertNoHorizontalOverflow(page); // (c) Invoices ledger

    await page.getByTestId('nav-studio-btn').click();
    await page.locator('[data-testid^="open-editor-"]').first().click();
    await expect(page.getByTestId('proposal-editor')).toBeVisible();
    await assertNoHorizontalOverflow(page); // (d) Proposal Editor

    expect(errors).toEqual([]);
  });
});
