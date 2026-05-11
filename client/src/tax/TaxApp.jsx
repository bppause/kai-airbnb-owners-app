// Root component for the /tax/* route tree.
//
// URL shape: /tax/{community-slug}[/...]
//   - /tax                       → DEFAULT_COMMUNITY landing
//   - /tax/tax-america-services  → that community's landing
// Phase 2+ will add subroutes: /login, /portal, /admin under each community.

import { TaxLocaleProvider } from './i18n';
import Landing from './pages/Landing';
import './styles/tax.css';

const DEFAULT_COMMUNITY_SLUG = 'tax-america-services';

function parseTaxPath() {
  const parts = window.location.pathname.replace(/\/+$/, '').split('/').filter(Boolean);
  // parts[0] is always 'tax' here (router only mounts when path starts with /tax)
  const slug = parts[1] || DEFAULT_COMMUNITY_SLUG;
  const rest = parts.slice(2);
  return { slug, rest };
}

export default function TaxApp() {
  const { slug } = parseTaxPath();
  return (
    <TaxLocaleProvider>
      <Landing communitySlug={slug} />
    </TaxLocaleProvider>
  );
}
