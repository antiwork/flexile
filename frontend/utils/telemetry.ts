/**
 * Simple telemetry tracking utilities for user interaction events
 * Currently logs to console - can be extended to send to analytics services
 */

export type TelemetryEvent =
  | 'ui_click_new_invoice'
  | 'ui_blocked_new_invoice_bank'
  | 'ui_blocked_new_invoice_tax'
  | 'ui_expand_more_info'
  | 'ui_collapse_more_info'
  | 'ui_click_edit_invoice'
  | 'ui_edit_locked_status'
  | 'ui_click_duplicate_invoice';

export interface TelemetryProperties {
  [key: string]: string | number | boolean | null | undefined;
}

/**
 * Track a telemetry event with optional properties
 */
export function track(event: TelemetryEvent, properties?: TelemetryProperties): void {
  // For now, just log to console for debugging
  // In production, this would send to your analytics service
  console.log(`[Telemetry] ${event}`, properties);

  // Future: Send to analytics service
  // analytics.track(event, properties);
}

/**
 * Track invoice-related events with common properties
 */
export function trackInvoiceEvent(event: TelemetryEvent, invoiceId?: string, properties?: TelemetryProperties): void {
  const commonProperties = {
    invoice_id: invoiceId,
    timestamp: new Date().toISOString(),
    ...properties,
  };

  track(event, commonProperties);
}


