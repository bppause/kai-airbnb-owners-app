// Root component for the /tax/* route tree.
//
// URL shapes:
//   /tax                                       → DEFAULT_COMMUNITY landing
//   /tax/{community-slug}                      → that community's landing
//   /tax/respond/{token}                       → magic-link customer response (Phase 1.5)
//   /tax/{community-slug}/portal               → portal dashboard (Phase 2a)
//   /tax/{community-slug}/portal/profile       → portal profile + preferences
//   /tax/{community-slug}/portal/filings/{id}  → portal filing detail + response

import { useEffect, useState } from 'react';
import { TaxLocaleProvider } from './i18n';
import Landing from './pages/Landing';
import Respond from './pages/Respond';
import PortalLogin from './pages/PortalLogin';
import PortalDashboard from './pages/PortalDashboard';
import PortalFiling from './pages/PortalFiling';
import PortalProfile from './pages/PortalProfile';
import PortalFaqs from './pages/PortalFaqs';
import PortalDocuments from './pages/PortalDocuments';
import PortalMessages from './pages/PortalMessages';
import EmployeeInbox from './pages/EmployeeInbox';
import EmployeeThread from './pages/EmployeeThread';
import EmployeeProfile from './pages/EmployeeProfile';
import OwnerCustomers from './pages/OwnerCustomers';
import OwnerCustomerDetail from './pages/OwnerCustomerDetail';
import OwnerStaff from './pages/OwnerStaff';
import OwnerStaffDetail from './pages/OwnerStaffDetail';
import OwnerLeads from './pages/OwnerLeads';
import OwnerSettings from './pages/OwnerSettings';
import PortalHelp from './pages/PortalHelp';
import EmployeeHelp from './pages/EmployeeHelp';
import { TaxAuthProvider, useTaxAuth } from './auth/AuthProvider';
import { TaxEmployeeAuthProvider, useEmployeeAuth } from './auth/EmployeeAuthProvider';
import { taxApi } from './api';
import './styles/tax.css';

const DEFAULT_COMMUNITY_SLUG = 'tax-america-services';

function parseTaxPath() {
  const parts = window.location.pathname.replace(/\/+$/, '').split('/').filter(Boolean);
  // parts[0] is always 'tax' here (main.jsx only mounts TaxApp on /tax/*).
  if (parts[1] === 'respond' && parts[2]) {
    return { route: 'respond', token: decodeURIComponent(parts[2]) };
  }
  const slug = parts[1] || DEFAULT_COMMUNITY_SLUG;
  if (parts[2] === 'employee') {
    if (parts[3] === 'profile') return { route: 'employee-profile', slug };
    if (parts[3] === 'threads' && parts[4]) return { route: 'employee-thread', slug, threadId: decodeURIComponent(parts[4]) };
    // Phase 4a owner pages (admin role gated on page-render side too)
    if (parts[3] === 'customers') {
      if (parts[4]) return { route: 'owner-customer-detail', slug, customerId: decodeURIComponent(parts[4]) };
      return { route: 'owner-customers', slug };
    }
    if (parts[3] === 'staff') {
      if (parts[4]) return { route: 'owner-staff-detail', slug, employeeId: decodeURIComponent(parts[4]) };
      return { route: 'owner-staff', slug };
    }
    if (parts[3] === 'leads')    return { route: 'owner-leads', slug };
    if (parts[3] === 'settings') return { route: 'owner-settings', slug };
    if (parts[3] === 'help')     return { route: 'employee-help', slug };
    return { route: 'employee-inbox', slug };
  }
  if (parts[2] === 'portal') {
    if (parts[3] === 'profile') return { route: 'portal-profile', slug };
    if (parts[3] === 'faqs') return { route: 'portal-faqs', slug };
    if (parts[3] === 'help') return { route: 'portal-help', slug };
    if (parts[3] === 'documents') return { route: 'portal-documents', slug };
    if (parts[3] === 'messages') {
      // /portal/messages, /portal/messages/new, /portal/messages/:threadId
      return { route: 'portal-messages', slug, threadId: parts[4] ? decodeURIComponent(parts[4]) : '' };
    }
    if (parts[3] === 'filings' && parts[4]) return { route: 'portal-filing', slug, filingId: decodeURIComponent(parts[4]) };
    return { route: 'portal-dashboard', slug };
  }
  return { route: 'landing', slug };
}

export default function TaxApp() {
  const parsed = parseTaxPath();
  return (
    <TaxLocaleProvider>
      {parsed.route === 'respond'
        ? <Respond token={parsed.token} />
        : parsed.route.startsWith('employee')
          ? <EmployeeRoot parsed={parsed} />
          : parsed.route.startsWith('portal')
            ? <PortalRoot parsed={parsed} />
            : <Landing communitySlug={parsed.slug} />}
    </TaxLocaleProvider>
  );
}

// Portal subtree: needs the community record before AuthProvider can run
// (the provider's /auth/link call requires communitySlug). We fetch it
// once here and pass the resolved community to children — including the
// login page, which renders branding before sign-in.
function PortalRoot({ parsed }) {
  const [community, setCommunity] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    taxApi.getCommunity(parsed.slug)
      .then(d => setCommunity(d.community))
      .catch(e => setErr(e?.message || 'Could not load community'));
  }, [parsed.slug]);

  if (err) return <div className="tax-fullscreen"><div className="tax-fullscreen__inner">{err}</div></div>;
  if (!community) return <div className="tax-fullscreen"><div className="tax-fullscreen__inner">Loading…</div></div>;

  const brandStyle = {
    '--tax-brand-primary': community.brand_primary_color || undefined,
    '--tax-brand-secondary': community.brand_secondary_color || undefined,
  };

  return (
    <div className="tax-app" style={brandStyle}>
      <TaxAuthProvider communitySlug={community.id}>
        <PortalGate parsed={parsed} community={community} />
      </TaxAuthProvider>
    </div>
  );
}

function PortalGate({ parsed, community }) {
  const { status, error, signOut } = useTaxAuth();

  if (status === 'unauthenticated') {
    return <PortalLogin community={community} />;
  }
  if (status === 'loading' || status === 'linking') {
    return <div className="tax-fullscreen"><div className="tax-fullscreen__inner">Loading…</div></div>;
  }
  if (status === 'error') {
    return (
      <div className="tax-fullscreen">
        <div className="tax-fullscreen__inner" style={{ maxWidth: 460 }}>
          <div className="tax-msg tax-msg--error" role="alert" style={{ textAlign: 'left' }}>
            <strong>Sign-in problem</strong>
            <div style={{ marginTop: 6 }}>{error}</div>
          </div>
          <button type="button" className="tax-btn tax-btn--primary" style={{ marginTop: 16 }} onClick={signOut}>
            Try a different account
          </button>
        </div>
      </div>
    );
  }
  // status === 'ready'
  if (parsed.route === 'portal-profile') return <PortalProfile />;
  if (parsed.route === 'portal-faqs') return <PortalFaqs />;
  if (parsed.route === 'portal-documents') return <PortalDocuments />;
  if (parsed.route === 'portal-help') return <PortalHelp />;
  if (parsed.route === 'portal-messages') return <PortalMessages threadId={parsed.threadId} />;
  if (parsed.route === 'portal-filing') return <PortalFiling filingId={parsed.filingId} />;
  return <PortalDashboard />;
}

// ── Employee subtree (Phase 3) ──────────────────────────────────────────
// Parallel to PortalRoot but pulls EmployeeAuthProvider, which talks to
// /employee/auth/link and /employee/me instead of the customer endpoints.
function EmployeeRoot({ parsed }) {
  const [community, setCommunity] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    taxApi.getCommunity(parsed.slug)
      .then(d => setCommunity(d.community))
      .catch(e => setErr(e?.message || 'Could not load community'));
  }, [parsed.slug]);

  if (err) return <div className="tax-fullscreen"><div className="tax-fullscreen__inner">{err}</div></div>;
  if (!community) return <div className="tax-fullscreen"><div className="tax-fullscreen__inner">Loading…</div></div>;

  const brandStyle = {
    '--tax-brand-primary': community.brand_primary_color || undefined,
    '--tax-brand-secondary': community.brand_secondary_color || undefined,
  };

  return (
    <div className="tax-app" style={brandStyle}>
      <TaxEmployeeAuthProvider communitySlug={community.id}>
        <EmployeeGate parsed={parsed} community={community} />
      </TaxEmployeeAuthProvider>
    </div>
  );
}

function EmployeeGate({ parsed, community }) {
  const { status, error, signOut } = useEmployeeAuth();

  if (status === 'unauthenticated') {
    return <PortalLogin community={community}
                        titleKey="employee.login.title"
                        subtitleKey="employee.login.subtitle" />;
  }
  if (status === 'loading' || status === 'linking') {
    return <div className="tax-fullscreen"><div className="tax-fullscreen__inner">Loading…</div></div>;
  }
  if (status === 'error') {
    return (
      <div className="tax-fullscreen">
        <div className="tax-fullscreen__inner" style={{ maxWidth: 460 }}>
          <div className="tax-msg tax-msg--error" role="alert" style={{ textAlign: 'left' }}>
            <strong>Sign-in problem</strong>
            <div style={{ marginTop: 6 }}>{error}</div>
          </div>
          <button type="button" className="tax-btn tax-btn--primary" style={{ marginTop: 16 }} onClick={signOut}>
            Try a different account
          </button>
        </div>
      </div>
    );
  }
  if (parsed.route === 'employee-profile') return <EmployeeProfile />;
  if (parsed.route === 'employee-thread') return <EmployeeThread threadId={parsed.threadId} />;
  if (parsed.route === 'owner-customers') return <OwnerCustomers />;
  if (parsed.route === 'owner-customer-detail') return <OwnerCustomerDetail customerId={parsed.customerId} />;
  if (parsed.route === 'owner-staff') return <OwnerStaff />;
  if (parsed.route === 'owner-staff-detail') return <OwnerStaffDetail employeeId={parsed.employeeId} />;
  if (parsed.route === 'owner-leads') return <OwnerLeads />;
  if (parsed.route === 'owner-settings') return <OwnerSettings />;
  if (parsed.route === 'employee-help') return <EmployeeHelp />;
  return <EmployeeInbox />;
}
