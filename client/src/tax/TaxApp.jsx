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
import { TaxAuthProvider, useTaxAuth } from './auth/AuthProvider';
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
  if (parts[2] === 'portal') {
    if (parts[3] === 'profile') return { route: 'portal-profile', slug };
    if (parts[3] === 'faqs') return { route: 'portal-faqs', slug };
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
  if (parsed.route === 'portal-filing') return <PortalFiling filingId={parsed.filingId} />;
  return <PortalDashboard />;
}
