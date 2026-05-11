import { useT } from '../i18n';

export default function Footer({ community }) {
  const { t } = useT();
  const year = new Date().getFullYear();
  return (
    <footer className="tax-footer">
      <div className="tax-container tax-footer__row">
        <div>{t('footer.copyright', { year, name: community?.name || '' })}</div>
        <div>{t('footer.poweredBy')}</div>
      </div>
    </footer>
  );
}
