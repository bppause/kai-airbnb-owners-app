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
];

function listTemplates() { return TEMPLATES; }
function getTemplate(id) { return TEMPLATES.find(t => t.id === id) || null; }

module.exports = { listTemplates, getTemplate };
