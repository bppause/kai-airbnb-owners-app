// Root component for the /tax/* route tree.
//
// URL shapes:
//   /tax                              → DEFAULT_COMMUNITY landing
//   /tax/{community-slug}             → that community's landing
//   /tax/respond/{token}              → customer magic-link response page (Phase 1.5)
// Phase 2+ will add: /login, /portal, /admin subroutes per community.

import { TaxLocaleProvider } from './i18n';
import Landing from './pages/Landing';
import Respond from './pages/Respond';
import './styles/tax.css';

const DEFAULT_COMMUNITY_SLUG = 'tax-america-services';

function parseTaxPath() {
  const parts = window.location.pathname.replace(/\/+$/, '').split('/').filter(Boolean);
  // parts[0] is always 'tax' here (main.jsx only mounts TaxApp on /tax/*).
  // Special routes first:
  if (parts[1] === 'respond' && parts[2]) {
    return { route: 'respond', token: decodeURIComponent(parts[2]) };
  }
  const slug = parts[1] || DEFAULT_COMMUNITY_SLUG;
  return { route: 'landing', slug };
}

export default function TaxApp() {
  const parsed = parseTaxPath();
  return (
    <TaxLocaleProvider>
      {parsed.route === 'respond'
        ? <Respond token={parsed.token} />
        : <Landing communitySlug={parsed.slug} />}
    </TaxLocaleProvider>
  );
}
