import { useT } from '../i18n';
import LeadForm from './LeadForm';

function buildAddress(c) {
  const lines = [c.address_line1, c.address_line2].filter(Boolean);
  const cityLine = [c.city, c.state, c.postal_code].filter(Boolean).join(', ');
  return [...lines, cityLine, c.country].filter(Boolean).join(' • ');
}

export default function Contact({ community, products }) {
  const { t } = useT();
  const address = buildAddress(community);
  return (
    <section className="tax-section tax-section--alt" id="contact">
      <div className="tax-container">
        <h2>{t('lead.heading')}</h2>
        <p className="tax-section__lede">{t('lead.subheading')}</p>

        <div className="tax-contact-layout">
          <LeadForm community={community} products={products} />
          <div>
            <h3 style={{ marginTop: 0 }}>{t('contact.heading')}</h3>
            <div className="tax-contact-grid">
              {address && (
                <div className="tax-contact-item">
                  <div className="tax-contact-item__label">{t('contact.address')}</div>
                  <div className="tax-contact-item__value">{address}</div>
                </div>
              )}
              {community.phone && (
                <div className="tax-contact-item">
                  <div className="tax-contact-item__label">{t('contact.phone')}</div>
                  <div className="tax-contact-item__value"><a href={`tel:${community.phone}`}>{community.phone}</a></div>
                </div>
              )}
              {community.contact_email && (
                <div className="tax-contact-item">
                  <div className="tax-contact-item__label">{t('contact.email')}</div>
                  <div className="tax-contact-item__value"><a href={`mailto:${community.contact_email}`}>{community.contact_email}</a></div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
