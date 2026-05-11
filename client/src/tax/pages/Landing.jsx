import { useEffect, useState } from 'react';
import { useT } from '../i18n';
import { taxApi } from '../api';
import Header from '../components/Header';
import Hero from '../components/Hero';
import ServicesGrid from '../components/ServicesGrid';
import Contact from '../components/Contact';
import Footer from '../components/Footer';

export default function Landing({ communitySlug }) {
  const { t } = useT();
  const [state, setState] = useState({ kind: 'loading', data: null, error: '' });

  useEffect(() => {
    let cancelled = false;
    setState({ kind: 'loading', data: null, error: '' });
    taxApi.getCommunity(communitySlug)
      .then(data => { if (!cancelled) setState({ kind: 'ready', data, error: '' }); })
      .catch(err => {
        if (cancelled) return;
        const notFound = err?.status === 404;
        setState({ kind: notFound ? 'not-found' : 'error', data: null, error: err?.message || '' });
      });
    return () => { cancelled = true; };
  }, [communitySlug]);

  if (state.kind === 'loading') {
    return <div className="tax-fullscreen"><div className="tax-fullscreen__inner">{t('loading')}</div></div>;
  }
  if (state.kind === 'not-found') {
    return <div className="tax-fullscreen"><div className="tax-fullscreen__inner">{t('error.notFound')}</div></div>;
  }
  if (state.kind === 'error') {
    return <div className="tax-fullscreen"><div className="tax-fullscreen__inner">{t('error.loadFailed')}</div></div>;
  }

  const { community, products } = state.data;
  const brandStyle = {
    '--tax-brand-primary': community.brand_primary_color || undefined,
    '--tax-brand-secondary': community.brand_secondary_color || undefined,
  };
  if (typeof document !== 'undefined') {
    document.title = community.name || 'Tax Services';
  }

  return (
    <div className="tax-app" style={brandStyle}>
      <Header community={community} />
      <Hero community={community} />
      <ServicesGrid products={products} />
      <Contact community={community} products={products} />
      <Footer community={community} />
    </div>
  );
}
