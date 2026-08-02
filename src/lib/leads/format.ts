/**
 * Shared, pure label helpers for the Leads IA module.
 *
 * Kept free of React/JSX and side-effects so they can be reused by both
 * the dashboard page (display) and the Excel export utility (data),
 * mirrored from the canonical copy in `lead-detail-view.tsx`.
 */

export function getClassificationLabel(classification: string): string {
  switch (classification) {
    case 'interested':
      return 'Interesado';
    case 'not_interested':
      return 'No interesado';
    case 'needs_info':
      return 'Requiere asesor';
    case 'requesting_call':
      return 'Solicita llamada';
    default:
      return 'Pendiente';
  }
}

export function getInterestLabel(level: string | null | undefined): string {
  switch (level) {
    case 'low':
      return 'Bajo';
    case 'medium':
      return 'Medio';
    case 'high':
      return 'Alto';
    case 'very_high':
      return 'Muy alto';
    default:
      return '';
  }
}