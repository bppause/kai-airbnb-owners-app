// Tax module — default task title suggestions per service.
//
// Surfaces as autocomplete options in the Add Task UI so the owner doesn't
// retype the same common items. Free text is always allowed.
//
// Slugs match tax_products.slug for the seeded `tax-america-services`
// catalog. The picker falls back to a flat "Common" bucket when the
// product slug isn't recognized.

'use strict';

const SUGGESTIONS_BY_SLUG = {
  'individual-tax': [
    { en: 'Send tax-prep link to customer',         es: 'Enviar enlace de preparación al cliente' },
    { en: 'Collect W-2 / 1099 forms',               es: 'Recopilar formularios W-2 / 1099' },
    { en: 'Review prior-year return',               es: 'Revisar declaración del año anterior' },
    { en: 'Prepare 1040 draft',                     es: 'Preparar borrador del 1040' },
    { en: 'Send draft for client review',           es: 'Enviar borrador al cliente para revisión' },
    { en: 'E-file federal return',                  es: 'Presentar electrónicamente la declaración federal' },
    { en: 'File state return',                      es: 'Presentar declaración estatal' },
    { en: 'File extension (Form 4868)',             es: 'Presentar extensión (Formulario 4868)' },
  ],
  'business-tax': [
    { en: 'Send tax-prep link to customer',         es: 'Enviar enlace de preparación al cliente' },
    { en: 'Collect year-end financials (P&L, balance sheet)', es: 'Recopilar estados financieros de fin de año' },
    { en: 'Prepare 1120 / 1120-S / 1065 draft',     es: 'Preparar borrador de 1120 / 1120-S / 1065' },
    { en: 'Issue K-1s to shareholders / partners',  es: 'Emitir K-1 a accionistas / socios' },
    { en: 'File extension (Form 7004)',             es: 'Presentar extensión (Formulario 7004)' },
    { en: 'E-file business return',                 es: 'Presentar electrónicamente la declaración empresarial' },
    { en: 'Print annual P&L',                       es: 'Imprimir P&L anual' },
  ],
  'itin': [
    { en: 'Verify identification documents',        es: 'Verificar documentos de identificación' },
    { en: 'Prepare Form W-7',                       es: 'Preparar Formulario W-7' },
    { en: 'Schedule CAA appointment',               es: 'Agendar cita CAA' },
    { en: 'Mail application to IRS',                es: 'Enviar solicitud por correo al IRS' },
    { en: 'Follow up on ITIN status',               es: 'Dar seguimiento al estado del ITIN' },
  ],
  'bookkeeping': [
    { en: 'Request bank statements',                es: 'Solicitar estados de cuenta bancarios' },
    { en: 'Reconcile bank accounts',                es: 'Conciliar cuentas bancarias' },
    { en: 'Reconcile credit cards',                 es: 'Conciliar tarjetas de crédito' },
    { en: 'Categorize expenses',                    es: 'Categorizar gastos' },
    { en: 'Print monthly P&L',                      es: 'Imprimir P&L mensual' },
    { en: 'Print balance sheet',                    es: 'Imprimir balance general' },
    { en: 'Send month-end financials to client',    es: 'Enviar estados financieros de fin de mes al cliente' },
  ],
  'payroll': [
    { en: 'Collect timesheets',                     es: 'Recopilar hojas de horas' },
    { en: 'Run weekly payroll',                     es: 'Procesar nómina semanal' },
    { en: 'Send paystubs to employees',             es: 'Enviar comprobantes de pago a empleados' },
    { en: 'File Form 941',                          es: 'Presentar Formulario 941' },
    { en: 'Make federal tax deposit',               es: 'Hacer depósito de impuesto federal' },
    { en: 'Issue W-2s / 1099s',                     es: 'Emitir W-2 / 1099' },
  ],
  'business-formation': [
    { en: 'File articles of organization',          es: 'Presentar acta constitutiva' },
    { en: 'Obtain EIN from IRS',                    es: 'Obtener EIN del IRS' },
    { en: 'Draft operating agreement',              es: 'Redactar acuerdo operativo' },
    { en: 'Register for state tax accounts',        es: 'Registrarse en cuentas tributarias estatales' },
    { en: 'Open business bank account',             es: 'Abrir cuenta bancaria empresarial' },
    { en: 'File annual report',                     es: 'Presentar reporte anual' },
    { en: 'File 2553 (S-Corp election)',            es: 'Presentar 2553 (elección S-Corp)' },
  ],
  'notary': [
    { en: 'Verify identification',                  es: 'Verificar identificación' },
    { en: 'Schedule notary appointment',            es: 'Agendar cita notarial' },
    { en: 'Complete notarization',                  es: 'Completar notarización' },
  ],
  'translation': [
    { en: 'Receive source documents',               es: 'Recibir documentos originales' },
    { en: 'Complete translation',                   es: 'Completar traducción' },
    { en: 'Send certified translation',             es: 'Enviar traducción certificada' },
  ],
  'irs-representation': [
    { en: 'Receive IRS notice from client',         es: 'Recibir aviso del IRS del cliente' },
    { en: 'Obtain Form 2848 (Power of Attorney)',   es: 'Obtener Formulario 2848 (Poder Notarial)' },
    { en: 'Call IRS on behalf of client',           es: 'Llamar al IRS en nombre del cliente' },
    { en: 'Send response to IRS',                   es: 'Enviar respuesta al IRS' },
    { en: 'Schedule audit-monitoring follow-up',    es: 'Agendar seguimiento de monitoreo de auditoría' },
  ],
  'sales-tax': [
    { en: 'Collect monthly sales totals',           es: 'Recopilar totales de ventas mensuales' },
    { en: 'File monthly sales tax return',          es: 'Presentar declaración mensual de impuesto sobre ventas' },
    { en: 'File quarterly sales tax return',        es: 'Presentar declaración trimestral de impuesto sobre ventas' },
    { en: 'Send sales-tax confirmation to client',  es: 'Enviar confirmación de impuesto sobre ventas al cliente' },
  ],
};

const COMMON_SUGGESTIONS = [
  { en: 'Send invoice',                             es: 'Enviar factura' },
  { en: 'Collect payment',                          es: 'Cobrar pago' },
  { en: 'Send signature link',                      es: 'Enviar enlace de firma' },
  { en: 'Send document via secure portal',          es: 'Enviar documento por portal seguro' },
  { en: 'Schedule call with client',                es: 'Agendar llamada con cliente' },
  { en: 'Follow up with client',                    es: 'Dar seguimiento al cliente' },
];

function suggestionsForSlug(slug) {
  const specific = SUGGESTIONS_BY_SLUG[String(slug || '').toLowerCase()] || [];
  return [...specific, ...COMMON_SUGGESTIONS];
}

module.exports = { suggestionsForSlug, COMMON_SUGGESTIONS };
