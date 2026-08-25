// GA4 se carga desde GTM, no desde aquí. Solo empujamos eventos al dataLayer
// y GTM los reenvía a GA4 (trigger "Custom Event" con el nombre del evento).
declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
  }
}

export const track = (event: string, params: Record<string, unknown> = {}) => {
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event, ...params });
};
