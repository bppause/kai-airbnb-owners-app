// Apartment uniqueness checks — units-specific DB queries.
//
// Lifted byte-identical from server.js stage 4f. These two helpers are tied
// to the `listings` table (which represents units; see
// docs/platform/PLATFORM_ARCHITECTURE.md §4) and conceptually belong to the units
// platform area, NOT to a generic core. Long-term this file will absorb
// other unit-specific queries.
//
// Public exports (returned by the factory):
//   findApartmentConflict     — find a single colliding listing (or null)
//   validateApartmentUniqueness — validate a batch + cross-check across DB

'use strict';

const { normalizeApt } = require('../../core/utils');

module.exports = function createUnitsDb(supabase) {
  const findApartmentConflict = async (apt, { excludeListingId = '', allowedOwnerUid = '', includePending = true, communityId = 'kai' } = {}) => {
    const normalized = normalizeApt(apt);
    if (!normalized) return null;
    const activeStatuses = includePending ? ['approved', 'pending'] : ['approved'];
    const { data: rows, error: qError } = await supabase
      .from('listings')
      .select('id, apt, tower, owner_uid, owner, email, user_email, status')
      .eq('community_id', communityId)
      .eq('apt', normalized)
      .in('status', activeStatuses)
      .limit(5);
    if (qError) throw qError;
    const conflict = (rows || []).find(r => r.id !== excludeListingId && (!allowedOwnerUid || r.owner_uid !== allowedOwnerUid || r.status === 'approved'));
    if (!conflict) return null;
    const isPending = conflict.status === 'pending';
    const towerLabel = conflict.tower || 'KAI';
    return {
      type: isPending ? 'pending' : 'approved',
      message: isPending
        ? `El apartamento ${towerLabel} ${normalized} ya está en una solicitud pendiente de aprobación. No se puede registrar el mismo apartamento con otra cuenta de Google.`
        : `El apartamento ${towerLabel} ${normalized} ya está registrado. Cada apartamento solo puede estar asociado a una cuenta de Google.`,
      apt: normalized,
      owner: conflict.owner || '',
      email: conflict.email || conflict.user_email || '',
    };
  };

  const validateApartmentUniqueness = async (listings, { ownerUid = '', excludeListingId = '', includePending = true, communityId = 'kai' } = {}) => {
    const seen = new Set();
    for (const l of listings || []) {
      const apt = normalizeApt(l.apt);
      if (seen.has(apt)) {
        return { type: 'duplicate_in_request', message: `El apartamento ${apt} está repetido en la solicitud. Cada apartamento solo puede registrarse una vez.` };
      }
      seen.add(apt);
      const conflict = await findApartmentConflict(apt, { excludeListingId, allowedOwnerUid: ownerUid, includePending, communityId });
      if (conflict) return conflict;
    }
    return null;
  };

  return { findApartmentConflict, validateApartmentUniqueness };
};
