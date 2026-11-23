import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  Eye,
  FileText,
  Languages,
  Layers,
  Moon,
  Plus,
  Receipt,
  Sparkles,
  Sun,
  Trash2,
} from 'lucide-react';
import { ClientPortalView } from './components/ClientPortalView.tsx';
import { ProposalEditor } from './components/ProposalEditor.tsx';
import { TaxInvoiceView } from './components/TaxInvoiceView.tsx';
import type { ClientApproval, GeneratedInvoice, Locale, Proposal } from './core/types.ts';
import { stripBase, withBase } from './lib/basePath.ts';
import {
  ApiError,
  createProposalFromPreset,
  deleteProposal,
  duplicateProposal,
  fetchTemplates,
  getInvoice,
  getProposal,
  listInvoices,
  listProposals,
  type DashboardStats,
  type ProposalSummary,
  type TemplateMeta,
} from './lib/api.ts';
import {
  classificationLabel,
  formatMoney,
  formatShortDate,
  getCopy,
  statusLabel,
  taxRegimeLabel,
} from './lib/i18n.ts';

type ThemeMode = 'alabaster' | 'obsidian';
type StudioTab = 'studio' | 'invoices';
type StatusFilter = 'all' | 'draft' | 'sent' | 'invoiced';

type AppRoute =
  | { kind: 'studio' }
  | { kind: 'portal'; slug: string }
  | { kind: 'invoice'; invoiceNumber: string };

function parseRoute(pathname: string): AppRoute {
  const clean = stripBase(pathname).replace(/\/+$/, '') || '/';
  const portalMatch = /^\/p\/([^/]+)$/.exec(clean);
  if (portalMatch?.[1]) {
    try {
      return { kind: 'portal', slug: decodeURIComponent(portalMatch[1]) };
    } catch {
      return { kind: 'portal', slug: portalMatch[1] };
    }
  }
  const invoiceMatch = /^\/invoice\/([^/]+)$/.exec(clean);
  if (invoiceMatch?.[1]) {
    try {
      return { kind: 'invoice', invoiceNumber: decodeURIComponent(invoiceMatch[1]) };
    } catch {
      return { kind: 'invoice', invoiceNumber: invoiceMatch[1] };
    }
  }
  return { kind: 'studio' };
}

function readInitialLocale(): Locale {
  try {
    const saved = window.localStorage.getItem('aqdflow_locale');
    if (saved === 'en' || saved === 'ar') return saved;
  } catch {
    // ignore storage read errors
  }
  return 'ar';
}

function readInitialTheme(): ThemeMode {
  try {
    const saved = window.localStorage.getItem('aqdflow_theme');
    if (saved === 'obsidian' || saved === 'alabaster') return saved;
  } catch {
    // ignore storage read errors
  }
  return 'alabaster';
}

interface InvoiceRoutePageProps {
  invoiceNumber: string;
  locale: Locale;
  theme: ThemeMode;
  onToggleLocale: () => void;
  onToggleTheme: () => void;
  onBackToStudio: () => void;
}

function InvoiceRoutePage({
  invoiceNumber,
  locale,
  theme,
  onToggleLocale,
  onToggleTheme,
  onBackToStudio,
}: InvoiceRoutePageProps) {
  const copy = getCopy(locale);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [invoice, setInvoice] = useState<GeneratedInvoice | null>(null);
  const [proposal, setProposal] = useState<Proposal | undefined>(undefined);
  const [approval, setApproval] = useState<ClientApproval | null | undefined>(undefined);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setErrorMsg('');
    void (async () => {
      try {
        const inv = await getInvoice(invoiceNumber);
        if (!active) return;
        setInvoice(inv);
        try {
          const bundle = await getProposal(inv.proposalId);
          if (!active) return;
          setProposal(bundle.proposal);
          setApproval(bundle.approval);
        } catch {
          // Proposal metadata lookup is optional when viewing public invoice number directly
        }
      } catch (err) {
        if (!active) return;
        setInvoice(null);
        setErrorMsg(err instanceof Error ? err.message : copy.notFoundBody);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [invoiceNumber, copy.notFoundBody]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 space-y-5">
      <div className="no-print flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-subtle)] pb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--accent-primary)] text-[var(--accent-primary-fg)] font-extrabold">
            ق
          </div>
          <div>
            <div className="aqd-display text-sm font-extrabold text-[var(--text-primary)]">
              {copy.brandName}
            </div>
            <div className="text-xs text-[var(--text-secondary)]">{copy.invoicePageTitle}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleLocale}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]"
            data-testid="toggle-locale-btn"
          >
            <Languages className="h-3.5 w-3.5" />
            {copy.langSwitch}
          </button>
          <button
            type="button"
            onClick={onToggleTheme}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]"
            data-testid="toggle-theme-btn"
          >
            {theme === 'alabaster' ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
            {theme === 'alabaster' ? copy.themeObsidian : copy.themeAlabaster}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-16 text-center text-sm text-[var(--text-secondary)]">
          {copy.loadingLabel}
        </div>
      ) : !invoice ? (
        <div className="aqd-card mx-auto max-w-xl rounded-2xl p-8 text-center space-y-4">
          <AlertCircle className="mx-auto h-10 w-10 text-[var(--accent-amber)]" />
          <h1 className="aqd-display text-xl font-bold text-[var(--text-primary)]">
            {copy.notFoundTitle}
          </h1>
          <p className="text-sm text-[var(--text-secondary)]">{errorMsg || copy.notFoundBody}</p>
          <button
            type="button"
            onClick={onBackToStudio}
            className="inline-flex items-center gap-2 rounded-xl bg-[var(--accent-primary)] px-4 py-2 text-sm font-semibold text-[var(--accent-primary-fg)] hover:bg-[var(--accent-primary-hover)]"
          >
            {copy.backToStudio}
          </button>
        </div>
      ) : (
        <TaxInvoiceView
          invoice={invoice}
          proposal={proposal}
          approval={approval}
          locale={locale}
          onBackToStudio={onBackToStudio}
        />
      )}
    </div>
  );
}

export function App() {
  const [locale, setLocale] = useState<Locale>(readInitialLocale);
  const [theme, setTheme] = useState<ThemeMode>(readInitialTheme);
  const [route, setRoute] = useState<AppRoute>(() => parseRoute(window.location.pathname));

  const [activeTab, setActiveTab] = useState<StudioTab>('studio');
  const [activeProposalId, setActiveProposalId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const [templates, setTemplates] = useState<TemplateMeta[]>([]);
  const [proposals, setProposals] = useState<ProposalSummary[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [invoices, setInvoices] = useState<GeneratedInvoice[]>([]);
  const [loadingStudio, setLoadingStudio] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [errorBanner, setErrorBanner] = useState('');

  const copy = getCopy(locale);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
    try {
      window.localStorage.setItem('aqdflow_locale', locale);
    } catch {
      // ignore
    }
  }, [locale]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute('content', theme === 'obsidian' ? '#0B0E14' : '#FAF8F4');
    }
    try {
      window.localStorage.setItem('aqdflow_theme', theme);
    } catch {
      // ignore
    }
  }, [theme]);

  useEffect(() => {
    const onPopState = () => {
      const next = parseRoute(window.location.pathname);
      setRoute(next);
      if (next.kind === 'studio') {
        setActiveProposalId(null);
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigate = useCallback((to: string) => {
    const fullPath = withBase(to);
    if (window.location.pathname !== fullPath) {
      window.history.pushState({}, '', fullPath);
    }
    const next = parseRoute(fullPath);
    setRoute(next);
    if (next.kind === 'studio') {
      setActiveProposalId(null);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const refreshStudioData = useCallback(async () => {
    setLoadingStudio(true);
    try {
      const [tpls, listRes, invs] = await Promise.all([
        fetchTemplates(),
        listProposals(),
        listInvoices(),
      ]);
      setTemplates(tpls);
      setProposals(listRes.proposals);
      setStats(listRes.stats);
      setInvoices(invs);
      setErrorBanner('');
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : 'Failed to load workspace data');
    } finally {
      setLoadingStudio(false);
    }
  }, []);

  useEffect(() => {
    if (route.kind === 'studio') {
      void refreshStudioData();
    }
  }, [route.kind, refreshStudioData]);

  const toggleLocale = useCallback(() => {
    setLocale((prev) => (prev === 'ar' ? 'en' : 'ar'));
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'alabaster' ? 'obsidian' : 'alabaster'));
  }, []);

  async function handleCreateTemplate(templateId: TemplateMeta['id']) {
    if (busyKey) return;
    setBusyKey(`tpl:${templateId}`);
    setErrorBanner('');
    try {
      const created = await createProposalFromPreset(templateId);
      await refreshStudioData();
      setActiveTab('studio');
      setActiveProposalId(created.proposal.id);
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : 'Failed to create proposal');
    } finally {
      setBusyKey(null);
    }
  }

  async function handleDuplicateProposal(id: string) {
    if (busyKey) return;
    setBusyKey(`dup:${id}`);
    setErrorBanner('');
    try {
      const cloned = await duplicateProposal(id);
      await refreshStudioData();
      setActiveTab('studio');
      setActiveProposalId(cloned.proposal.id);
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : 'Failed to duplicate proposal');
    } finally {
      setBusyKey(null);
    }
  }

  async function handleDeleteProposal(id: string) {
    if (busyKey) return;
    setBusyKey(`del:${id}`);
    setErrorBanner('');
    try {
      await deleteProposal(id);
      await refreshStudioData();
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Failed to delete proposal';
      setErrorBanner(msg);
    } finally {
      setBusyKey(null);
    }
  }

  const filteredProposals = useMemo(() => {
    if (statusFilter === 'all') return proposals;
    return proposals.filter((p) => p.status === statusFilter);
  }, [proposals, statusFilter]);

  const collectedSummary = useMemo(() => {
    if (invoices.length === 0) {
      return formatMoney(0, 'AED', locale);
    }
    const sums = new Map<GeneratedInvoice['currency'], number>();
    for (const inv of invoices) {
      sums.set(inv.currency, (sums.get(inv.currency) ?? 0) + inv.totalAmount);
    }
    return Array.from(sums.entries())
      .map(([currency, amount]) => formatMoney(amount, currency, locale))
      .join(' · ');
  }, [invoices, locale]);

  if (route.kind === 'portal') {
    return (
      <div className="min-h-screen bg-[var(--bg-canvas)] text-[var(--text-primary)]">
        <ClientPortalView
          slug={route.slug}
          locale={locale}
          theme={theme}
          onToggleLocale={toggleLocale}
          onToggleTheme={toggleTheme}
          onBackToStudio={() => navigate('/')}
        />
      </div>
    );
  }

  if (route.kind === 'invoice') {
    return (
      <div className="min-h-screen bg-[var(--bg-canvas)] text-[var(--text-primary)]">
        <InvoiceRoutePage
          invoiceNumber={route.invoiceNumber}
          locale={locale}
          theme={theme}
          onToggleLocale={toggleLocale}
          onToggleTheme={toggleTheme}
          onBackToStudio={() => navigate('/')}
        />
      </div>
    );
  }

  const statusBadgeClass = (status: Proposal['status']) => {
    if (status === 'invoiced' || status === 'approved') {
      return 'bg-[var(--accent-seal-soft)] text-[var(--accent-seal)]';
    }
    if (status === 'sent') {
      return 'bg-[var(--bg-soft)] text-[var(--accent-primary)]';
    }
    return 'bg-[var(--bg-elevated)] text-[var(--text-secondary)]';
  };

  return (
    <div className="min-h-screen bg-[var(--bg-canvas)] text-[var(--text-primary)]">
      {/* Studio Header */}
      <header className="no-print sticky top-0 z-20 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)]/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setActiveProposalId(null);
                setActiveTab('studio');
              }}
              className="flex items-center gap-2.5 text-start"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--accent-primary)] text-lg font-extrabold text-[var(--accent-primary-fg)] shadow-sm">
                ق
              </span>
              <span>
                <span className="aqd-display block text-base font-extrabold leading-tight text-[var(--text-primary)]">
                  {copy.brandName}
                </span>
                <span className="block text-xs text-[var(--text-secondary)]">
                  {copy.brandTagline}
                </span>
              </span>
            </button>
          </div>

          <nav className="flex items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-1">
            <button
              type="button"
              onClick={() => {
                setActiveProposalId(null);
                setActiveTab('studio');
              }}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                activeTab === 'studio' && !activeProposalId
                  ? 'bg-[var(--bg-surface)] text-[var(--accent-primary)] shadow-xs'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
              data-testid="nav-studio-btn"
            >
              <Layers className="h-3.5 w-3.5" />
              {copy.navStudio}
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveProposalId(null);
                setActiveTab('invoices');
              }}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                activeTab === 'invoices' && !activeProposalId
                  ? 'bg-[var(--bg-surface)] text-[var(--accent-primary)] shadow-xs'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
              data-testid="nav-invoices-btn"
            >
              <Receipt className="h-3.5 w-3.5" />
              {copy.navInvoices}
              <span className="num-tabular rounded-full bg-[var(--bg-soft)] px-1.5 py-0.5 text-[10px] text-[var(--accent-primary)]">
                {invoices.length}
              </span>
            </button>
          </nav>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void handleCreateTemplate('web-commerce')}
              disabled={busyKey !== null}
              className="hidden sm:inline-flex items-center gap-1.5 rounded-xl bg-[var(--accent-primary)] px-3.5 py-2 text-xs font-bold text-[var(--accent-primary-fg)] hover:bg-[var(--accent-primary-hover)] disabled:opacity-60"
              data-testid="quick-create-btn"
            >
              <Plus className="h-3.5 w-3.5" />
              {copy.createBlank}
            </button>
            <button
              type="button"
              onClick={toggleLocale}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3 py-2 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]"
              data-testid="toggle-locale-btn"
            >
              <Languages className="h-3.5 w-3.5" />
              {copy.langSwitch}
            </button>
            <button
              type="button"
              onClick={toggleTheme}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3 py-2 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]"
              data-testid="toggle-theme-btn"
            >
              {theme === 'alabaster' ? (
                <Moon className="h-3.5 w-3.5" />
              ) : (
                <Sun className="h-3.5 w-3.5" />
              )}
              {theme === 'alabaster' ? copy.themeObsidian : copy.themeAlabaster}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 space-y-6">
        {errorBanner && (
          <div
            role="alert"
            className="flex items-center justify-between gap-3 rounded-xl border border-[var(--danger-text)]/35 bg-[var(--danger-soft)] px-4 py-3 text-sm text-[var(--danger-text)]"
          >
            <span className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {errorBanner}
            </span>
            <button
              type="button"
              onClick={() => setErrorBanner('')}
              className="text-xs font-bold underline"
            >
              ×
            </button>
          </div>
        )}

        {activeProposalId ? (
          <ProposalEditor
            proposalId={activeProposalId}
            locale={locale}
            onBack={() => {
              setActiveProposalId(null);
              void refreshStudioData();
            }}
            onSelectProposalId={(newId) => {
              setActiveProposalId(newId);
              void refreshStudioData();
            }}
            onOpenPortal={(slug) => navigate(`/p/${encodeURIComponent(slug)}`)}
            onOpenInvoice={(invoiceNumber) =>
              navigate(`/invoice/${encodeURIComponent(invoiceNumber)}`)
            }
            onProposalChanged={() => {
              void refreshStudioData();
            }}
          />
        ) : activeTab === 'invoices' ? (
          <section className="space-y-4" data-testid="invoices-ledger">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="aqd-display text-2xl font-extrabold text-[var(--text-primary)]">
                  {copy.navInvoices}
                </h1>
                <p className="text-sm text-[var(--text-secondary)]">
                  {collectedSummary}
                </p>
              </div>
            </div>

            {loadingStudio ? (
              <div className="py-12 text-center text-sm text-[var(--text-secondary)]">
                {copy.loadingLabel}
              </div>
            ) : invoices.length === 0 ? (
              <div className="aqd-card rounded-2xl p-10 text-center text-sm text-[var(--text-secondary)]">
                {copy.noProposals}
              </div>
            ) : (
              <div className="aqd-card overflow-x-auto rounded-2xl">
                <table className="w-full text-start text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-xs text-[var(--text-secondary)]">
                      <th className="px-4 py-3 text-start font-bold">{copy.invoiceNumberLabel}</th>
                      <th className="px-4 py-3 text-start font-bold">{copy.clientLabel}</th>
                      <th className="px-4 py-3 text-start font-bold">{copy.classificationLabel}</th>
                      <th className="px-4 py-3 text-start font-bold">{copy.issuedAtLabel}</th>
                      <th className="px-4 py-3 text-start font-bold">{copy.scopeDigestLabel}</th>
                      <th className="px-4 py-3 text-end font-bold">{copy.totalCol}</th>
                      <th className="px-4 py-3 text-end font-bold" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-subtle)]">
                    {invoices.map((inv) => {
                      const clientName =
                        locale === 'ar'
                          ? inv.client.nameAr || inv.client.nameEn
                          : inv.client.nameEn || inv.client.nameAr;
                      return (
                        <tr key={inv.invoiceNumber} className="hover:bg-[var(--bg-elevated)]/60">
                          <td className="num-tabular px-4 py-3.5 font-bold text-[var(--text-primary)]">
                            {inv.invoiceNumber}
                          </td>
                          <td className="px-4 py-3.5 text-[var(--text-primary)]">{clientName}</td>
                          <td className="px-4 py-3.5 text-xs text-[var(--text-secondary)]">
                            {classificationLabel(inv.classification, locale)}
                          </td>
                          <td className="px-4 py-3.5 text-xs text-[var(--text-secondary)]">
                            {formatShortDate(inv.issuedAt, locale)}
                          </td>
                          <td className="px-4 py-3.5 font-mono text-xs text-[var(--accent-seal)]">
                            {inv.scopeDigestHex.slice(0, 12)}…
                          </td>
                          <td className="num-tabular px-4 py-3.5 text-end font-bold text-[var(--text-primary)]">
                            {formatMoney(inv.totalAmount, inv.currency, locale)}
                          </td>
                          <td className="px-4 py-3.5 text-end">
                            <button
                              type="button"
                              onClick={() =>
                                navigate(`/invoice/${encodeURIComponent(inv.invoiceNumber)}`)
                              }
                              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent-primary)] px-3 py-1.5 text-xs font-semibold text-[var(--accent-primary-fg)] hover:bg-[var(--accent-primary-hover)]"
                            >
                              <Receipt className="h-3.5 w-3.5" />
                              {copy.viewInvoice}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        ) : (
          <>
            {/* Studio Hero + KPI Stats */}
            <section className="aqd-card rounded-2xl p-6 sm:p-8 space-y-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div className="max-w-3xl space-y-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--bg-soft)] px-3 py-1 text-xs font-bold text-[var(--accent-primary)]">
                    <Sparkles className="h-3.5 w-3.5" />
                    UAE FTA 5% · KSA ZATCA Phase 1 QR · SHA-256 Scope Lock
                  </span>
                  <h1 className="aqd-display text-2xl sm:text-3xl font-extrabold leading-snug text-[var(--text-primary)]">
                    {copy.heroTitle}
                  </h1>
                  <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
                    {copy.heroSubtitle}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleCreateTemplate('web-commerce')}
                  disabled={busyKey !== null}
                  className="sm:hidden inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--accent-primary)] px-4 py-2.5 text-sm font-bold text-[var(--accent-primary-fg)]"
                >
                  <Plus className="h-4 w-4" />
                  {copy.createBlank}
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4">
                  <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
                    <span>{copy.statTotal}</span>
                    <FileText className="h-4 w-4 text-[var(--accent-primary)]" />
                  </div>
                  <div className="num-tabular mt-1.5 text-2xl font-extrabold text-[var(--text-primary)]">
                    {stats?.total ?? proposals.length}
                  </div>
                </div>

                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4">
                  <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
                    <span>{copy.statSent}</span>
                    <Clock className="h-4 w-4 text-[var(--accent-amber)]" />
                  </div>
                  <div className="num-tabular mt-1.5 text-2xl font-extrabold text-[var(--text-primary)]">
                    {stats?.sent ?? proposals.filter((p) => p.status === 'sent').length}
                  </div>
                </div>

                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4">
                  <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
                    <span>{copy.statInvoiced}</span>
                    <CheckCircle2 className="h-4 w-4 text-[var(--accent-seal)]" />
                  </div>
                  <div className="num-tabular mt-1.5 text-2xl font-extrabold text-[var(--text-primary)]">
                    {stats?.invoiced ?? proposals.filter((p) => p.status === 'invoiced').length}
                  </div>
                </div>

                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4">
                  <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
                    <span>{copy.statCollected}</span>
                    <Receipt className="h-4 w-4 text-[var(--accent-primary)]" />
                  </div>
                  <div className="num-tabular mt-1.5 text-lg sm:text-xl font-extrabold text-[var(--text-primary)] truncate">
                    {collectedSummary}
                  </div>
                </div>
              </div>
            </section>

            {/* Quick Templates */}
            <section className="space-y-3">
              <div>
                <h2 className="aqd-display text-lg font-extrabold text-[var(--text-primary)]">
                  {copy.quickTemplatesTitle}
                </h2>
                <p className="text-xs sm:text-sm text-[var(--text-secondary)]">
                  {copy.quickTemplatesSub}
                </p>
              </div>
              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
                {templates.map((tpl) => {
                  const creatingThis = busyKey === `tpl:${tpl.id}`;
                  return (
                    <div
                      key={tpl.id}
                      className="aqd-card flex flex-col justify-between rounded-2xl p-4 space-y-4"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="rounded-full bg-[var(--bg-soft)] px-2.5 py-0.5 text-[11px] font-bold text-[var(--accent-primary)]">
                            {locale === 'ar' ? tpl.badgeAr : tpl.badgeEn}
                          </span>
                          <span className="num-tabular text-xs font-semibold text-[var(--text-secondary)]">
                            {tpl.defaultCurrency}
                          </span>
                        </div>
                        <h3 className="aqd-display text-sm font-bold leading-snug text-[var(--text-primary)]">
                          {locale === 'ar' ? tpl.nameAr : tpl.nameEn}
                        </h3>
                        <p className="text-[11px] text-[var(--text-secondary)]">
                          {taxRegimeLabel(tpl.defaultTaxRegime, locale)}
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={busyKey !== null}
                        onClick={() => void handleCreateTemplate(tpl.id)}
                        className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-elevated)] px-3 py-2 text-xs font-bold text-[var(--text-primary)] hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)] disabled:opacity-60"
                        data-testid={`create-template-${tpl.id}`}
                      >
                        <Plus className="h-3.5 w-3.5" />
                        {creatingThis ? copy.loadingLabel : copy.createFromTemplate}
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Proposals List */}
            <section className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="aqd-display text-lg font-extrabold text-[var(--text-primary)]">
                  {copy.proposalsListTitle}
                </h2>
                <div className="flex flex-wrap items-center gap-1.5">
                  {(
                    [
                      { key: 'all', label: copy.filterAll },
                      { key: 'draft', label: copy.filterDraft },
                      { key: 'sent', label: copy.filterSent },
                      { key: 'invoiced', label: copy.filterInvoiced },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setStatusFilter(tab.key)}
                      className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                        statusFilter === tab.key
                          ? 'bg-[var(--accent-primary)] text-[var(--accent-primary-fg)]'
                          : 'border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {loadingStudio ? (
                <div className="py-10 text-center text-sm text-[var(--text-secondary)]">
                  {copy.loadingLabel}
                </div>
              ) : filteredProposals.length === 0 ? (
                <div className="aqd-card rounded-2xl p-8 text-center text-sm text-[var(--text-secondary)]">
                  {copy.noProposals}
                </div>
              ) : (
                <div className="space-y-3" data-testid="proposals-list">
                  {filteredProposals.map((item) => {
                    const p = item.proposal;
                    const title = locale === 'ar' ? p.titleAr : p.titleEn;
                    const clientName =
                      locale === 'ar'
                        ? p.client.nameAr || p.client.nameEn
                        : p.client.nameEn || p.client.nameAr;

                    return (
                      <article
                        key={p.id}
                        className="aqd-card flex flex-col gap-4 rounded-2xl p-5 lg:flex-row lg:items-center lg:justify-between"
                      >
                        <div className="space-y-1.5 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${statusBadgeClass(
                                item.status,
                              )}`}
                            >
                              {statusLabel(item.status, locale)}
                            </span>
                            <span className="font-mono text-xs text-[var(--text-secondary)]">
                              /p/{item.slug}
                            </span>
                            <span className="inline-flex items-center gap-1 text-xs text-[var(--text-secondary)]">
                              <Eye className="h-3.5 w-3.5" />
                              <span className="num-tabular">{item.viewCount}</span>
                            </span>
                            {item.invoiceNumber && (
                              <span className="num-tabular rounded-full bg-[var(--accent-seal-soft)] px-2.5 py-0.5 text-[11px] font-bold text-[var(--accent-seal)]">
                                {item.invoiceNumber}
                              </span>
                            )}
                          </div>

                          <h3 className="aqd-display text-base font-extrabold text-[var(--text-primary)] truncate">
                            {title}
                          </h3>
                          <p className="text-xs text-[var(--text-secondary)]">
                            {clientName} · {taxRegimeLabel(p.taxRegime, locale)} ·{' '}
                            {formatShortDate(item.updatedAt, locale)}
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 lg:justify-end">
                          <div className="text-start lg:text-end me-2">
                            <div className="num-tabular text-base font-extrabold text-[var(--text-primary)]">
                              {formatMoney(item.totals.grandTotal, p.currency, locale)}
                            </div>
                            <div className="num-tabular text-[11px] text-[var(--text-secondary)]">
                              {copy.depositDueNow}:{' '}
                              {formatMoney(item.totals.depositAmount, p.currency, locale)}
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setActiveProposalId(p.id)}
                              className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--accent-primary)] px-3.5 py-2 text-xs font-bold text-[var(--accent-primary-fg)] hover:bg-[var(--accent-primary-hover)]"
                              data-testid={`open-editor-${p.slug}`}
                            >
                              <FileText className="h-3.5 w-3.5" />
                              {copy.openEditor}
                            </button>

                            {item.status !== 'draft' && (
                              <button
                                type="button"
                                onClick={() => navigate(`/p/${encodeURIComponent(item.slug)}`)}
                                className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3 py-2 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]"
                                data-testid={`open-portal-${p.slug}`}
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                                {copy.viewPortal}
                              </button>
                            )}

                            {item.invoiceNumber && (
                              <button
                                type="button"
                                onClick={() =>
                                  navigate(`/invoice/${encodeURIComponent(item.invoiceNumber!)}`)
                                }
                                className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--accent-seal)]/40 bg-[var(--accent-seal-soft)] px-3 py-2 text-xs font-bold text-[var(--accent-seal)]"
                                data-testid={`open-invoice-${item.invoiceNumber}`}
                              >
                                <Receipt className="h-3.5 w-3.5" />
                                {copy.viewInvoice}
                              </button>
                            )}

                            <button
                              type="button"
                              disabled={busyKey !== null}
                              onClick={() => void handleDuplicateProposal(p.id)}
                              title={copy.duplicateProposal}
                              className="inline-flex items-center gap-1 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] px-2.5 py-2 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-60"
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </button>

                            {item.status !== 'invoiced' && (
                              <button
                                type="button"
                                disabled={busyKey !== null}
                                onClick={() => void handleDeleteProposal(p.id)}
                                title={copy.deleteProposal}
                                className="inline-flex items-center gap-1 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] px-2.5 py-2 text-xs font-medium text-[var(--danger-text)] hover:bg-[var(--danger-soft)] disabled:opacity-60"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}

export default App;
