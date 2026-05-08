// Per-area email senders for the registrations platform area.
//
// Lifted byte-identical from server.js stage 4g.

'use strict';

const { normalizeRecipients } = require('../../core/utils');

module.exports = function createRegistrationSenders(deps) {
  const {
    sendTemplatedEmail,
    getEmailNotificationConfig, getCommunity,
    getGlobalAdminEmails, getCommunityAdminEmails, getDelegateAdminsWithPermission,
  } = deps;

  const sendRegistrationSubmittedEmail = async ({ registration, appUrl }) => {
    const notifCfg = await getEmailNotificationConfig();
    const typeCfg = notifCfg['registration_submitted'];
    if (!typeCfg.enabled || !typeCfg.owner) return { sent:false, skipped:true, reason:'Registration submitted email is disabled.' };
    const communityId = registration.communityId || 'kai';
    const community = await getCommunity(communityId);
    const communityName = community?.name || communityId;
    return sendTemplatedEmail({ key:'registration_submitted', to: registration.userEmail, vars: { userName:registration.userName || '', userEmail:registration.userEmail || '', registrationLink: appUrl + '/?view=registration', communityName }, communityId });
  };

  const sendRegistrationStatusEmail = async ({ registration, appUrl, communityId='kai' }) => {
    const approved = registration.status === 'approved';
    const key = approved ? 'registration_approved' : 'registration_declined';
    const notifCfg = await getEmailNotificationConfig();
    const typeCfg = notifCfg[key];
    if (!typeCfg.enabled || !typeCfg.owner) return { sent:false, skipped:true, reason:`Registration ${key} email is disabled.` };
    const link = appUrl + (approved ? '/?view=dashboard' : '/?view=registration');
    const reason = String(registration.reason || '').trim();
    const community = await getCommunity(communityId);
    const communityName = community?.name || communityId;
    const recips = [registration.userEmail];
    const admCfg = notifCfg['registration_status_admin'];
    if (admCfg?.enabled) {
      if (admCfg.globalAdmin) recips.push(...getGlobalAdminEmails());
      if (admCfg.delegateAdmin) recips.push(...await getDelegateAdminsWithPermission('canApproveRegistrations'));
      if (admCfg.communityAdmin ?? true) recips.push(...await getCommunityAdminEmails(communityId));
    }
    return sendTemplatedEmail({ key, to: normalizeRecipients(recips), vars: { userName:registration.userName || '', userEmail:registration.userEmail || '', reason, reasonLine: reason ? 'Motivo/nota: ' + reason : '', reasonHtml: reason ? '<p><strong>Motivo/nota:</strong> ' + reason + '</p>' : '', reasonLineEn: reason ? 'Reason/note: ' + reason : '', reasonHtmlEn: reason ? '<p><strong>Reason/note:</strong> ' + reason + '</p>' : '', dashboardLink:link, registrationLink:link, communityName }, communityId });
  };

  const sendRegistrationReviewerEmail = async ({ reviewer, registration, appUrl }) => {
    const notifCfg = await getEmailNotificationConfig();
    const typeCfg = notifCfg['registration_reviewer'];
    if (!typeCfg.enabled || !typeCfg.owner) return { sent:false, skipped:true, reason:'Registration reviewer email is disabled.' };
    const communityId = registration.communityId || 'kai';
    const community = await getCommunity(communityId);
    const communityName = community?.name || communityId;
    return sendTemplatedEmail({ key:'registration_reviewer', to: reviewer.user_email, vars: { reviewerName: reviewer.user_name || 'propietario', userName:registration.userName || '', userEmail:registration.userEmail || '', approvalsLink: appUrl + '/?view=approvals', communityName }, communityId });
  };

  return {
    sendRegistrationSubmittedEmail,
    sendRegistrationStatusEmail,
    sendRegistrationReviewerEmail,
  };
};
