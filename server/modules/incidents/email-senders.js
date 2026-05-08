// Per-module email senders for the incidents module.
//
// Lifted byte-identical from server.js stage 4g. Receives generic email
// primitives + role/config helpers via deps and exposes the
// 5 incident-specific senders. server.js destructures these and continues
// to pass them to the incidents router via dep injection.
//
// Long-term the incidents router could `require` this file directly (so the
// senders aren't passed through deps) — but that would also require pushing
// the dep bundle one level deeper, which is a separate refactor.

'use strict';

const { normalizeRecipients } = require('../../core/utils');
const { getListingOwnerEmails, getListingOperatorEmails } = require('../../core/email');

module.exports = function createIncidentSenders(deps) {
  const {
    sendSplitEmail, sendTemplatedEmail,
    getEmailNotificationConfig,
    getReporterEmail, getReporterName,
    getCommunityAdminEmails, getCommunityEscalationEmails,
    getDelegateAdminsWithPermission, getGlobalAdminEmails,
    emailConfigured,
  } = deps;

  // Internal: build (individual, group) recipient lists for an incident event.
  const buildSplitRecipients = async (typeCfg, listing, reporterEmail='', communityId='kai') => {
    const individual = normalizeRecipients([
      typeCfg.reporter !== false && reporterEmail ? reporterEmail : '',
      typeCfg.owner    ? getListingOwnerEmails(listing)    : [],
      typeCfg.operator ? getListingOperatorEmails(listing) : [],
    ].flat());

    const groupList = [];
    if (typeCfg.globalAdmin)   groupList.push(...getGlobalAdminEmails(), ...await getCommunityEscalationEmails(communityId));
    if (typeCfg.delegateAdmin) groupList.push(...await getDelegateAdminsWithPermission('canResolveIncidents'));
    if (typeCfg.communityAdmin ?? true) groupList.push(...await getCommunityAdminEmails(communityId));
    const group = normalizeRecipients(groupList);

    return { individual, group };
  };

  const sendIncidentEmail = async ({ listing, incident, appUrl, isEscalation=false }) => {
    const key = isEscalation ? 'incident_sla' : 'incident_new';
    const notifCfg = await getEmailNotificationConfig();
    const typeCfg = notifCfg[key];
    if (!typeCfg.enabled) return { sent:false, skipped:true, reason:`Email type '${key}' is disabled.` };
    const communityId = listing.community_id || '__global__';
    const reporterEmail = await getReporterEmail(incident.reporterUid);
    const { individual, group } = await buildSplitRecipients(typeCfg, listing, reporterEmail, communityId);
    if (!individual.length && !group.length) return { sent:false, skipped:true, reason:'No recipients.' };
    const apt = listing.apt || String(incident.aptLabel || '').replace(/[^0-9]/g,'');
    const incidentLink = appUrl + '/?view=incidents&incident=' + incident.id;
    const pendingStepLabel   = incident.pendingStepLabel   || (incident.status==='open' ? 'Step 1: Verify the incident — confirm guest details and document your immediate action' : 'Step 2: Add your resolution — describe how you resolved this so admin can close it');
    const pendingStepLabelEs = incident.pendingStepLabelEs || (incident.status==='open' ? 'Paso 1: Verifica el incidente — confirma los datos del huésped y documenta tu acción inmediata' : 'Paso 2: Agrega tu respuesta — describe cómo resolviste el incidente para que el admin pueda cerrarlo');
    const vars = { apt, owner:listing.owner||'', operator:listing.operator||'No indicado', operatorEmail:listing.operatorEmail||listing.operator_email||'', guestName:incident.guestName||'', date:incident.date||'', type:incident.type||'', category:incident.category||'', status:incident.status||'open', desc:incident.desc||'', incidentLink, slaCycleCount:String(incident.slaCycleCount||incident.sla_cycle_count||''), pendingStep:incident.pendingStep||(incident.status==='open'?'step1':'step2'), pendingStepLabel, pendingStepLabelEs };
    return sendSplitEmail({ key, individual, group, vars, relatedEntity:'incident', relatedId:incident.id, communityId });
  };

  const sendIncidentVerifiedEmail = async ({ listing, incident, appUrl }) => {
    const notifCfg = await getEmailNotificationConfig();
    const typeCfg = notifCfg['incident_verified'];
    if (!typeCfg.enabled) return { sent:false, skipped:true, reason:"Email type 'incident_verified' is disabled." };
    const communityId = listing.community_id || '__global__';
    const reporterEmail = await getReporterEmail(incident.reporterUid);
    const { individual, group } = await buildSplitRecipients(typeCfg, listing, reporterEmail, communityId);
    if (!individual.length && !group.length) return { sent:false, skipped:true, reason:'No recipients.' };
    const apt = listing.apt || String(incident.aptLabel || '').replace(/[^0-9]/g,'');
    const incidentLink = appUrl + '/?view=incidents&incident=' + incident.id;
    const vars = { apt, owner:listing.owner||'', operator:listing.operator||'No indicado', operatorEmail:listing.operatorEmail||listing.operator_email||'', ownerGuestNames:incident.ownerGuestNames||'', ownerGuestCity:incident.ownerGuestCity||'', ownerGuestCountry:incident.ownerGuestCountry||'', ownerComments:incident.ownerComments||'', ownerAnswer:incident.ownerResolution||'', incidentLink };
    return sendSplitEmail({ key:'incident_verified', individual, group, vars, relatedEntity:'incident', relatedId:incident.id, communityId });
  };

  // Step 2 complete: owner added resolution — notifies all parties that incident is ready to close.
  const sendIncidentResolutionAddedEmail = async ({ listing, incident, appUrl }) => {
    const notifCfg = await getEmailNotificationConfig();
    const typeCfg = notifCfg['incident_resolution_added'] || { enabled:true, reporter:true, owner:true, operator:true, globalAdmin:true, delegateAdmin:true };
    if (!typeCfg.enabled) return { sent:false, skipped:true, reason:"Email type 'incident_resolution_added' is disabled." };
    const communityId = listing.community_id || '__global__';
    const reporterEmail = await getReporterEmail(incident.reporterUid);
    const { individual, group } = await buildSplitRecipients(typeCfg, listing, reporterEmail, communityId);
    if (!individual.length && !group.length) return { sent:false, skipped:true, reason:'No recipients.' };
    const apt = listing.apt || String(incident.aptLabel || '').replace(/[^0-9]/g,'');
    const incidentLink = appUrl + '/?view=incidents&incident=' + incident.id;
    const vars = { apt, owner:listing.owner||'', operator:listing.operator||'No indicado', operatorEmail:listing.operatorEmail||listing.operator_email||'', ownerGuestNames:incident.ownerGuestNames||'', ownerGuestCity:incident.ownerGuestCity||'', ownerGuestCountry:incident.ownerGuestCountry||'', ownerComments:incident.ownerComments||'', ownerAnswer:incident.ownerResolution||'', incidentLink };
    return sendSplitEmail({ key:'incident_resolution_added', individual, group, vars, relatedEntity:'incident', relatedId:incident.id, communityId });
  };

  const sendIncidentResolvedEmail = async ({ listing, incident, appUrl }) => {
    const notifCfg = await getEmailNotificationConfig();
    const typeCfg = notifCfg['incident_resolved'];
    if (!typeCfg.enabled) return { sent:false, skipped:true, reason:"Email type 'incident_resolved' is disabled." };
    const communityId = listing.community_id || '__global__';
    const reporterEmail = await getReporterEmail(incident.reporterUid);
    const reporterName = incident.reporterName || await getReporterName(incident.reporterUid);
    const { individual, group } = await buildSplitRecipients(typeCfg, listing, reporterEmail, communityId);
    if (!individual.length && !group.length) return { sent:false, skipped:true, reason:'No recipients.' };
    const apt = listing.apt || String(incident.aptLabel || '').replace(/[^0-9]/g,'');
    const incidentLink = appUrl + '/?view=incidents&incident=' + incident.id;
    const vars = { apt, owner:listing.owner||'', operator:listing.operator||'No indicado', operatorEmail:listing.operatorEmail||listing.operator_email||'', resolvedBy:incident.resolvedBy||incident.resolved_by||'', resolutionComments:incident.resolutionComments||incident.resolution_comments||'', ownerAnswer:incident.ownerResolution||'', date:incident.date||'', type:incident.type||'', category:incident.category||'', incidentLink, reporterName };
    return sendSplitEmail({ key:'incident_resolved', individual, group, vars, relatedEntity:'incident', relatedId:incident.id, communityId });
  };

  const sendGeneralIncidentSlaEmail = async (inc, slaHours, appUrl, communityId='kai') => {
    if (!emailConfigured) return;
    const notifCfg = await getEmailNotificationConfig();
    const typeCfg = notifCfg['incident_general_sla'] || { enabled:true, globalAdmin:true, delegateAdmin:true };
    if (!typeCfg.enabled) return;
    const recips = [];
    if (typeCfg.globalAdmin  !== false) recips.push(...getGlobalAdminEmails(), ...await getCommunityEscalationEmails(communityId));
    if (typeCfg.delegateAdmin !== false) recips.push(...await getDelegateAdminsWithPermission('canResolveIncidents'));
    if (typeCfg.communityAdmin ?? true) recips.push(...await getCommunityAdminEmails(communityId));
    const recipients = normalizeRecipients(recips);
    if (!recipients.length) return;
    const incidentLink = appUrl + '/?view=incidents&incident=' + inc.id;
    return sendTemplatedEmail({
      key: 'incident_general_sla',
      to: recipients,
      vars: { apt:'General', owner:'', operator:'No indicado', operatorEmail:'', guestName:'', date:inc.date||'', type:inc.type||'', category:inc.category||'', status:'open', desc:inc.desc||'', incidentLink, slaCycleCount:String(inc.slaCycleCount||0), slaHours:String(slaHours), pendingStep:'assign-or-close', pendingStepLabel:'Assign this general incident to a unit or close it directly', pendingStepLabelEs:'Asigna este incidente general a una unidad o ciérralo directamente' },
      relatedEntity: 'incident',
      relatedId: inc.id,
    });
  };

  return {
    sendIncidentEmail,
    sendIncidentVerifiedEmail,
    sendIncidentResolutionAddedEmail,
    sendIncidentResolvedEmail,
    sendGeneralIncidentSlaEmail,
  };
};
