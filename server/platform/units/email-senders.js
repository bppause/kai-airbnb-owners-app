// Per-area email senders for the units (listings) platform area.
//
// Lifted byte-identical from server.js stage 4g.

'use strict';

const { normalizeRecipients } = require('../../core/utils');
const { getListingOwnerEmails, getListingOperatorEmails } = require('../../core/email');

module.exports = function createUnitsSenders(deps) {
  const {
    sendSplitEmail,
    getEmailNotificationConfig,
    getCommunityAdminEmails, getCommunityEscalationEmails,
    getDelegateAdminsWithPermission, getGlobalAdminEmails,
  } = deps;

  const sendListingChangeEmail = async ({ listing, action, appUrl }) => {
    const key = action === 'created' ? 'listing_created' : action === 'updated' ? 'listing_updated' : 'listing_deleted';
    const notifCfg = await getEmailNotificationConfig();
    const typeCfg = notifCfg[key];
    if (!typeCfg.enabled) return { sent:false, skipped:true, reason:`Email type '${key}' is disabled.` };
    const individual = normalizeRecipients([
      typeCfg.owner    ? getListingOwnerEmails(listing)    : [],
      typeCfg.operator ? getListingOperatorEmails(listing) : [],
    ].flat());
    const listingCommunityId = listing.communityId || 'kai';
    const groupList = [];
    if (typeCfg.globalAdmin)   groupList.push(...getGlobalAdminEmails(), ...await getCommunityEscalationEmails(listingCommunityId));
    if (typeCfg.delegateAdmin) groupList.push(...await getDelegateAdminsWithPermission('canUpdateGlobalListings'));
    if (typeCfg.communityAdmin ?? true) groupList.push(...await getCommunityAdminEmails(listingCommunityId));
    const group = normalizeRecipients(groupList);
    if (!individual.length && !group.length) return { sent:false, skipped:true, reason:'No recipients for listing change email.' };
    const vars = { apt:listing.apt||'', owner:listing.owner||'', listingEmail:listing.email||listing.user_email||'', listingLink:appUrl+'/?view=listings' };
    return sendSplitEmail({ key, individual, group, vars, relatedEntity:'listing', relatedId:listing.id });
  };

  return { sendListingChangeEmail };
};
