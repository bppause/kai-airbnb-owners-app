// Phase 4n.10: workflow template library. A curated catalog of common
// federal/state filings that an owner can clone into a relationship with
// one click. Kept as a code constant rather than a DB table — these are
// nationally-standard schedules and they don't need owner editing in
// place. Owners can clone, then edit the resulting workflow row freely.
//
// Each template:
//   id                — slug used as the API path param when cloning
//   category          — surfaces as the section header in the picker
//   jurisdiction      — informational, mirrored onto the created schedule
//   suggested_slug    — base slug for the new schedule row (suffixed if it
//                       collides in the target community)
//   name_i18n / description_i18n — bilingual display
//   cadence           — 'weekly' | 'monthly' | 'quarterly' | 'annual'
//   anchor_rule       — JSON shape matching schedule.js
//   info_checklist    — same shape as tax_filing_schedules.info_checklist
//   suggested_offsets — reminder offsets in days-before-due (positive ints)

'use strict';

const TEMPLATES = [
  {
    id: 'federal-1040es',
    category: 'federal',
    jurisdiction: 'federal',
    suggested_slug: 'fed-1040es',
    name_i18n: {
      en: 'Federal Estimated Income Tax (1040-ES)',
      es: 'Impuesto Federal Estimado (1040-ES)',
    },
    description_i18n: {
      en: 'Quarterly estimated income tax payment to the IRS for individuals with non-W-2 income.',
      es: 'Pago trimestral estimado de impuesto al IRS para personas con ingresos no-W-2.',
    },
    cadence: 'quarterly',
    anchor_rule: { type: 'fixed_quarterly', dates: ['04-15', '06-15', '09-15', '01-15'] },
    info_checklist: [
      { key: 'income_estimate', type: 'currency', required: true,
        label_i18n: { en: 'Estimated income for the quarter (USD)', es: 'Ingreso estimado del trimestre (USD)' } },
      { key: 'deductions_estimate', type: 'currency', required: false,
        label_i18n: { en: 'Estimated deductions (USD)', es: 'Deducciones estimadas (USD)' } },
      { key: 'prior_year_paid', type: 'currency', required: false,
        label_i18n: { en: 'Prior estimated payments this year (USD)', es: 'Pagos estimados previos del año (USD)' } },
      { key: 'notes', type: 'text', required: false,
        label_i18n: { en: 'Notes or changes in situation', es: 'Notas o cambios de situación' } },
    ],
    suggested_offsets: [14, 7, 2],
  },
  {
    id: 'federal-941',
    category: 'federal',
    jurisdiction: 'federal',
    suggested_slug: 'fed-941',
    name_i18n: {
      en: 'Federal 941 — Employer Quarterly Payroll Tax',
      es: 'Federal 941 — Impuesto de Nómina Trimestral del Empleador',
    },
    description_i18n: {
      en: 'Quarterly payroll tax return for employers (income tax withheld, Social Security, Medicare).',
      es: 'Declaración trimestral de impuestos de nómina (retención, Seguro Social, Medicare).',
    },
    cadence: 'quarterly',
    anchor_rule: { type: 'quarterly_following', day: 30 },
    info_checklist: [
      { key: 'wages_paid', type: 'currency', required: true,
        label_i18n: { en: 'Total wages paid this quarter (USD)', es: 'Salarios totales pagados este trimestre (USD)' } },
      { key: 'federal_withheld', type: 'currency', required: true,
        label_i18n: { en: 'Federal income tax withheld (USD)', es: 'Impuesto federal retenido (USD)' } },
      { key: 'ss_medicare_tax', type: 'currency', required: true,
        label_i18n: { en: 'Social Security + Medicare tax (USD)', es: 'Impuesto de Seguro Social + Medicare (USD)' } },
      { key: 'employees_count', type: 'number', required: false,
        label_i18n: { en: 'Number of employees', es: 'Número de empleados' } },
    ],
    suggested_offsets: [21, 7, 2],
  },
  {
    id: 'federal-1040-annual',
    category: 'federal',
    jurisdiction: 'federal',
    suggested_slug: 'fed-1040',
    name_i18n: {
      en: 'Federal 1040 — Annual Individual Income Tax',
      es: 'Federal 1040 — Impuesto Individual Anual',
    },
    description_i18n: {
      en: 'Annual federal income tax return. Due April 15 (or extended to October 15).',
      es: 'Declaración anual de impuesto federal sobre la renta. Vence el 15 de abril (o extendido al 15 de octubre).',
    },
    cadence: 'annual',
    anchor_rule: { type: 'annual', date: '04-15' },
    info_checklist: [
      { key: 'w2_form', type: 'file', required: true,
        label_i18n: { en: 'W-2 form(s)', es: 'Formulario(s) W-2' } },
      { key: 'ten99_forms', type: 'file', required: false,
        label_i18n: { en: '1099 forms (if any)', es: 'Formularios 1099 (si los tiene)' } },
      { key: 'mortgage_interest', type: 'currency', required: false,
        label_i18n: { en: 'Mortgage interest paid (USD)', es: 'Interés hipotecario pagado (USD)' } },
      { key: 'charitable_giving', type: 'currency', required: false,
        label_i18n: { en: 'Charitable contributions (USD)', es: 'Donaciones caritativas (USD)' } },
      { key: 'medical_expenses', type: 'currency', required: false,
        label_i18n: { en: 'Medical expenses (USD)', es: 'Gastos médicos (USD)' } },
      { key: 'notes', type: 'text', required: false,
        label_i18n: { en: 'Anything else we should know', es: '¿Algo más que debamos saber?' } },
    ],
    suggested_offsets: [60, 30, 14, 7],
  },
  {
    id: 'federal-w2-1099-filing',
    category: 'federal',
    jurisdiction: 'federal',
    suggested_slug: 'fed-w2-1099',
    name_i18n: {
      en: 'W-2 / 1099 Filing — January 31',
      es: 'Declaración W-2 / 1099 — 31 de enero',
    },
    description_i18n: {
      en: 'Annual W-2 and 1099-NEC filings to the IRS and SSA. Due January 31.',
      es: 'Declaraciones anuales W-2 y 1099-NEC al IRS y SSA. Vence el 31 de enero.',
    },
    cadence: 'annual',
    anchor_rule: { type: 'annual', date: '01-31' },
    info_checklist: [
      { key: 'employee_count', type: 'number', required: true,
        label_i18n: { en: 'Number of W-2 employees', es: 'Número de empleados W-2' } },
      { key: 'contractor_count', type: 'number', required: false,
        label_i18n: { en: 'Number of 1099 contractors', es: 'Número de contratistas 1099' } },
      { key: 'payroll_export', type: 'file', required: true,
        label_i18n: { en: 'Payroll export (CSV or PDF)', es: 'Exportación de nómina (CSV o PDF)' } },
    ],
    suggested_offsets: [30, 14, 7, 2],
  },
  {
    id: 'state-sales-tax-monthly',
    category: 'state',
    jurisdiction: 'state',
    suggested_slug: 'state-sales-tax-monthly',
    name_i18n: {
      en: 'State Sales Tax — Monthly',
      es: 'Impuesto Estatal sobre Ventas — Mensual',
    },
    description_i18n: {
      en: 'Monthly sales tax remittance. Default due on the 20th of the following month — adjust per state.',
      es: 'Remesa mensual de impuesto sobre ventas. Vencimiento predeterminado el día 20 del mes siguiente — ajuste según el estado.',
    },
    cadence: 'monthly',
    anchor_rule: { type: 'monthly_following', day: 20 },
    info_checklist: [
      { key: 'gross_sales', type: 'currency', required: true,
        label_i18n: { en: 'Gross sales for the month (USD)', es: 'Ventas brutas del mes (USD)' } },
      { key: 'taxable_sales', type: 'currency', required: true,
        label_i18n: { en: 'Taxable sales (USD)', es: 'Ventas gravables (USD)' } },
      { key: 'exempt_sales', type: 'currency', required: false,
        label_i18n: { en: 'Exempt / non-taxable sales (USD)', es: 'Ventas exentas / no gravables (USD)' } },
    ],
    suggested_offsets: [10, 3],
  },
  {
    id: 'weekly-payroll',
    category: 'business',
    jurisdiction: 'federal',
    suggested_slug: 'payroll-weekly',
    name_i18n: {
      en: 'Weekly Payroll Run',
      es: 'Procesamiento Semanal de Nómina',
    },
    description_i18n: {
      en: 'Weekly payroll cutoff — hours and pay-rate confirmations from the client before processing.',
      es: 'Cierre semanal de nómina — confirmaciones de horas y tarifas desde el cliente antes de procesar.',
    },
    cadence: 'weekly',
    anchor_rule: { type: 'weekly_following', dayOfWeek: 5 },  // Friday
    info_checklist: [
      { key: 'total_hours', type: 'number', required: true,
        label_i18n: { en: 'Total hours worked this week', es: 'Horas totales trabajadas esta semana' } },
      { key: 'bonuses', type: 'currency', required: false,
        label_i18n: { en: 'Bonuses / one-off payments (USD)', es: 'Bonificaciones / pagos únicos (USD)' } },
      { key: 'time_off', type: 'text', required: false,
        label_i18n: { en: 'Any time off or schedule changes', es: 'Ausencias o cambios de horario' } },
    ],
    suggested_offsets: [2, 1],
  },

  // ── Monthly bookkeeping close ───────────────────────────────────────────
  // Standard industry practice: close the prior month's books by the 15th of
  // the following month so financials are timely for management decisions.
  {
    id: 'monthly-bookkeeping-close',
    category: 'business',
    jurisdiction: 'firm',
    suggested_slug: 'bookkeeping-monthly',
    name_i18n: {
      en: 'Monthly Bookkeeping Close',
      es: 'Cierre Mensual de Contabilidad',
    },
    description_i18n: {
      en: 'Monthly close of the prior period: bank + credit-card reconciliations, categorize expenses, deliver financials by the 15th.',
      es: 'Cierre mensual del período anterior: conciliaciones bancarias y de tarjetas, categorización de gastos, entrega de estados financieros antes del día 15.',
    },
    cadence: 'monthly',
    anchor_rule: { type: 'monthly_following', day: 15 },
    info_checklist: [
      { key: 'bank_statements', type: 'file', required: true,
        label_i18n: { en: 'Bank statement(s) for the month (PDF)', es: 'Estado(s) de cuenta bancarios del mes (PDF)' } },
      { key: 'credit_card_statements', type: 'file', required: false,
        label_i18n: { en: 'Credit card statement(s) (PDF)', es: 'Estado(s) de tarjeta de crédito (PDF)' } },
      { key: 'expense_receipts', type: 'file', required: false,
        label_i18n: { en: 'Significant expense receipts (PDF/JPG)', es: 'Recibos de gastos significativos (PDF/JPG)' } },
      { key: 'large_transactions', type: 'text', required: false,
        label_i18n: { en: 'Notes on large or unusual transactions', es: 'Notas sobre transacciones grandes o inusuales' } },
    ],
    suggested_offsets: [10, 5, 2],
  },

  // ── Federal 1120 (C-Corp annual) ────────────────────────────────────────
  // Due the 15th day of the 4th month after fiscal year end. For calendar-
  // year corporations that's April 15. Owner can shift the anchor for fiscal
  // year filers.
  {
    id: 'federal-1120-annual',
    category: 'federal',
    jurisdiction: 'federal',
    suggested_slug: 'fed-1120',
    name_i18n: {
      en: 'Federal 1120 — C-Corporation Annual Return',
      es: 'Federal 1120 — Declaración Anual de Corporación C',
    },
    description_i18n: {
      en: 'Annual income tax return for C-corporations. Calendar-year due date is April 15.',
      es: 'Declaración anual del impuesto sobre la renta para corporaciones C. Vence el 15 de abril para año fiscal calendario.',
    },
    cadence: 'annual',
    anchor_rule: { type: 'annual', date: '04-15' },
    info_checklist: [
      { key: 'financial_statements', type: 'file', required: true,
        label_i18n: { en: 'Year-end financial statements (P&L, balance sheet)', es: 'Estados financieros de fin de año (P&G, balance)' } },
      { key: 'general_ledger', type: 'file', required: false,
        label_i18n: { en: 'General ledger / trial balance', es: 'Libro mayor / balance de prueba' } },
      { key: 'prior_return', type: 'file', required: false,
        label_i18n: { en: 'Prior-year tax return (first year only)', es: 'Declaración del año anterior (solo el primer año)' } },
      { key: 'asset_acquisitions', type: 'text', required: false,
        label_i18n: { en: 'New asset purchases or dispositions', es: 'Compras o ventas de activos' } },
      { key: 'notes', type: 'text', required: false,
        label_i18n: { en: 'Anything else we should know', es: '¿Algo más que debamos saber?' } },
    ],
    suggested_offsets: [60, 30, 14, 7],
  },

  // ── Federal 1120-S (S-Corp annual) ──────────────────────────────────────
  // Due the 15th day of the 3rd month after fiscal year end. Calendar-year
  // S-corps file by March 15.
  {
    id: 'federal-1120s-annual',
    category: 'federal',
    jurisdiction: 'federal',
    suggested_slug: 'fed-1120s',
    name_i18n: {
      en: 'Federal 1120-S — S-Corporation Annual Return',
      es: 'Federal 1120-S — Declaración Anual de Corporación S',
    },
    description_i18n: {
      en: 'Annual income tax return for S-corporations. Calendar-year due date is March 15. K-1s issued to shareholders.',
      es: 'Declaración anual del impuesto sobre la renta para corporaciones S. Vence el 15 de marzo para año fiscal calendario. Se emiten K-1 a los accionistas.',
    },
    cadence: 'annual',
    anchor_rule: { type: 'annual', date: '03-15' },
    info_checklist: [
      { key: 'financial_statements', type: 'file', required: true,
        label_i18n: { en: 'Year-end financial statements (P&L, balance sheet)', es: 'Estados financieros de fin de año (P&G, balance)' } },
      { key: 'shareholder_list', type: 'text', required: true,
        label_i18n: { en: 'Shareholder list with ownership percentages', es: 'Lista de accionistas con porcentaje de participación' } },
      { key: 'shareholder_distributions', type: 'currency', required: false,
        label_i18n: { en: 'Total distributions to shareholders (USD)', es: 'Distribuciones totales a accionistas (USD)' } },
      { key: 'reasonable_comp_paid', type: 'currency', required: false,
        label_i18n: { en: 'Reasonable compensation paid to owner-employees (USD)', es: 'Compensación razonable pagada a propietarios-empleados (USD)' } },
      { key: 'notes', type: 'text', required: false,
        label_i18n: { en: 'Anything else we should know', es: '¿Algo más que debamos saber?' } },
    ],
    suggested_offsets: [60, 30, 14, 7],
  },

  // ── Federal 1065 (Partnership / Multi-member LLC annual) ────────────────
  // Same March 15 due date as 1120-S. K-1s issued to partners.
  {
    id: 'federal-1065-annual',
    category: 'federal',
    jurisdiction: 'federal',
    suggested_slug: 'fed-1065',
    name_i18n: {
      en: 'Federal 1065 — Partnership Annual Return',
      es: 'Federal 1065 — Declaración Anual de Sociedad',
    },
    description_i18n: {
      en: 'Annual return for partnerships and multi-member LLCs. Calendar-year due date is March 15. K-1s issued to partners.',
      es: 'Declaración anual para sociedades y LLCs multi-miembro. Vence el 15 de marzo para año fiscal calendario. Se emiten K-1 a los socios.',
    },
    cadence: 'annual',
    anchor_rule: { type: 'annual', date: '03-15' },
    info_checklist: [
      { key: 'financial_statements', type: 'file', required: true,
        label_i18n: { en: 'Year-end financial statements (P&L, balance sheet)', es: 'Estados financieros de fin de año (P&G, balance)' } },
      { key: 'partner_list', type: 'text', required: true,
        label_i18n: { en: 'Partner list with ownership / profit-share percentages', es: 'Lista de socios con porcentaje de propiedad / participación' } },
      { key: 'partner_distributions', type: 'currency', required: false,
        label_i18n: { en: 'Total distributions to partners (USD)', es: 'Distribuciones totales a socios (USD)' } },
      { key: 'guaranteed_payments', type: 'currency', required: false,
        label_i18n: { en: 'Guaranteed payments to partners (USD)', es: 'Pagos garantizados a socios (USD)' } },
      { key: 'notes', type: 'text', required: false,
        label_i18n: { en: 'Anything else we should know', es: '¿Algo más que debamos saber?' } },
    ],
    suggested_offsets: [60, 30, 14, 7],
  },

  // ── State sales tax quarterly ───────────────────────────────────────────
  // Generic state quarterly schedule for smaller-volume sellers (most states
  // require quarterly if monthly sales tax is below a threshold). Owner
  // edits the anchor + state for their jurisdiction after cloning.
  {
    id: 'state-sales-tax-quarterly',
    category: 'state',
    jurisdiction: 'state',
    suggested_slug: 'state-sales-tax-quarterly',
    name_i18n: {
      en: 'State Sales Tax — Quarterly',
      es: 'Impuesto Estatal sobre Ventas — Trimestral',
    },
    description_i18n: {
      en: 'Quarterly sales tax remittance for lower-volume sellers. Default due dates align with calendar quarters — adjust per state.',
      es: 'Remesa trimestral de impuesto sobre ventas para vendedores de menor volumen. Fechas predeterminadas en trimestres calendario — ajuste según el estado.',
    },
    cadence: 'quarterly',
    anchor_rule: { type: 'fixed_quarterly', dates: ['04-30', '07-31', '10-31', '01-31'] },
    info_checklist: [
      { key: 'gross_sales', type: 'currency', required: true,
        label_i18n: { en: 'Gross sales for the quarter (USD)', es: 'Ventas brutas del trimestre (USD)' } },
      { key: 'taxable_sales', type: 'currency', required: true,
        label_i18n: { en: 'Taxable sales (USD)', es: 'Ventas gravables (USD)' } },
      { key: 'exempt_sales', type: 'currency', required: false,
        label_i18n: { en: 'Exempt / non-taxable sales (USD)', es: 'Ventas exentas / no gravables (USD)' } },
      { key: 'tax_collected', type: 'currency', required: true,
        label_i18n: { en: 'Sales tax collected (USD)', es: 'Impuesto sobre ventas recaudado (USD)' } },
    ],
    suggested_offsets: [21, 7, 2],
  },

  // ── IRS notice response (ad-hoc) ────────────────────────────────────────
  // Triggered when a client receives an IRS letter. Statutory response
  // window is typically 30 days. Set as a one-off-style annual cadence so a
  // single period gets generated; owner moves the due date manually.
  {
    id: 'irs-notice-response',
    category: 'representation',
    jurisdiction: 'federal',
    suggested_slug: 'irs-notice-response',
    name_i18n: {
      en: 'IRS Notice Response (30-day window)',
      es: 'Respuesta a Aviso del IRS (ventana de 30 días)',
    },
    description_i18n: {
      en: 'Triggered when the client receives an IRS letter. Default 30-day response window — verify the deadline printed on the notice and adjust.',
      es: 'Se activa cuando el cliente recibe una carta del IRS. Ventana predeterminada de 30 días — verifique la fecha impresa en el aviso y ajuste.',
    },
    cadence: 'annual',
    anchor_rule: { type: 'annual', date: '12-31' },
    info_checklist: [
      { key: 'notice_copy', type: 'file', required: true,
        label_i18n: { en: 'Copy of the IRS notice (all pages, PDF)', es: 'Copia del aviso del IRS (todas las páginas, PDF)' } },
      { key: 'notice_number', type: 'text', required: true,
        label_i18n: { en: 'Notice number (e.g., CP2000, LT11)', es: 'Número del aviso (ej., CP2000, LT11)' } },
      { key: 'tax_year', type: 'text', required: true,
        label_i18n: { en: 'Tax year referenced in the notice', es: 'Año fiscal referenciado en el aviso' } },
      { key: 'response_deadline', type: 'date', required: true,
        label_i18n: { en: 'Response deadline printed on the notice', es: 'Fecha límite impresa en el aviso' } },
      { key: 'authorization_2848', type: 'file', required: false,
        label_i18n: { en: 'Signed Form 2848 (Power of Attorney) if not already on file', es: 'Formulario 2848 (Poder Notarial) firmado si no lo tenemos' } },
      { key: 'notes', type: 'text', required: false,
        label_i18n: { en: 'Context — what was happening that year', es: 'Contexto — qué estaba ocurriendo ese año' } },
    ],
    suggested_offsets: [14, 7, 3, 1],
  },
];

function listTemplates() { return TEMPLATES; }
function getTemplate(id) { return TEMPLATES.find(t => t.id === id) || null; }

module.exports = { listTemplates, getTemplate };
