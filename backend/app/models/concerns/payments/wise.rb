# frozen_string_literal: true

module Payments::Wise
  extend ActiveSupport::Concern

  # Possible `wise_transfer_status` values
  # From https://docs.wise.com/api-docs/guides/send-money/tracking#transfer-statuses
  INCOMING_PAYMENT_WAITING = "incoming_payment_waiting"
  INCOMING_PAYMENT_INITIATED = "incoming_payment_initiated"
  PROCESSING = "processing"
  CANCELLED = "cancelled"
  FUNDS_REFUNDED = "funds_refunded"
  FUNDS_CONVERTED = "funds_converted"
  OUTGOING_PAYMENT_SENT = "outgoing_payment_sent"
  BOUNCED_BACK = "bounced_back"
  CHARGED_BACK = "charged_back"
  UNKNOWN = "unknown"

  ALL_STATES = [INCOMING_PAYMENT_WAITING, INCOMING_PAYMENT_INITIATED, PROCESSING, CANCELLED, FUNDS_REFUNDED,
                FUNDS_CONVERTED, OUTGOING_PAYMENT_SENT, BOUNCED_BACK, CHARGED_BACK, UNKNOWN]

  included do
    belongs_to :wise_recipient, optional: true

    validates :wise_transfer_status, inclusion: { in: ALL_STATES }, allow_nil: true

    def in_failed_state?
      [CANCELLED, FUNDS_REFUNDED, CHARGED_BACK].include?(wise_transfer_status)
    end

    def in_processing_state?
      [PROCESSING, FUNDS_CONVERTED, BOUNCED_BACK].include?(wise_transfer_status)
    end

    def wise_transfer_reference
      self.class::WISE_TRANSFER_REFERENCE
    end
  end
end
