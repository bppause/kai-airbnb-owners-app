// Role permission defaults + display labels.
//
// Used by App.jsx (role resolution + permission badges) and
// platform/admin/views/AdminSettings.jsx (permission editors).
//
// Lifted byte-identical from App.jsx in stage F34.
//
// See docs/PLATFORM_ARCHITECTURE.md §11 frontend stage F34.

export const DEFAULT_STANDARD_MENU_PERMISSIONS = { dashboard:true, listings:true, incidents:true, notifications:true, about:true, my:true, analytics:false };
export const DEFAULT_DELEGATE_PERMISSIONS = { canApproveRegistrations:true, canResolveIncidents:true, canUpdateGlobalListings:false, canDeleteGlobalListings:false, canUpdateGlobalIncidents:false, canDeleteGlobalIncidents:false };
export const DEFAULT_COMMUNITY_ADMIN_PERMISSIONS = { canApproveRegistrations:true, canResolveIncidents:true, canManageListings:false, canEditMission:true, canEditUiLabels:true, canEditTooltips:true };

export const COMMUNITY_ADMIN_PERMISSION_LABELS = {
  canApproveRegistrations: { es:'Aprobar / rechazar registros', en:'Approve / deny registrations' },
  canResolveIncidents: { es:'Resolver incidentes', en:'Resolve incidents' },
  canManageListings: { es:'Gestionar listings de la comunidad', en:'Manage community listings' },
  canEditMission: { es:'Editar misión de la comunidad', en:'Edit community mission' },
  canEditUiLabels: { es:'Editar etiquetas UI de la comunidad', en:'Edit community UI labels' },
  canEditTooltips: { es:'Editar tooltips de la comunidad', en:'Edit community tooltips' },
};

export const PERMISSION_LABELS = {
  canApproveRegistrations: { es:'Aprobar / rechazar registros', en:'Approve / deny registrations' },
  canResolveIncidents: { es:'Resolver incidentes con comentarios', en:'Resolve incidents with comments' },
  canUpdateGlobalListings: { es:'Editar listings globales', en:'Edit global listings' },
  canDeleteGlobalListings: { es:'Eliminar listings globales', en:'Delete global listings' },
  canUpdateGlobalIncidents: { es:'Actualizar incidentes globales', en:'Update global incidents' },
  canDeleteGlobalIncidents: { es:'Eliminar incidentes globales', en:'Delete global incidents' },
};

export const MENU_LABELS = {
  dashboard:{es:'Dashboard',en:'Dashboard'}, listings:{es:'Inventario',en:'Inventory'}, incidents:{es:'Incidentes',en:'Incidents'}, notifications:{es:'Alertas',en:'Alerts'}, about:{es:'Misión',en:'Mission'}, my:{es:'Mis Unidades',en:'My Units'}, analytics:{es:'Analíticas',en:'Analytics'}
};
