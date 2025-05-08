# frozen_string_literal: true

module Payments::Status
  extend ActiveSupport::Concern

  # Possible `status` values
  INITIAL = "initial"
  SUCCEEDED = "succeeded"
  FAILED = "failed"
  CANCELLED = "cancelled"
  DEFAULT_STATUSES = [INITIAL, SUCCEEDED, FAILED, CANCELLED].freeze

  included do
    scope :successful, -> { where(status: SUCCEEDED) }

    validates :status, presence: true, inclusion: { in: -> { const_defined?(:ALL_STATUSES) ? const_get(:ALL_STATUSES) : DEFAULT_STATUSES } }
  end

  def marked_failed?
    status == FAILED
  end
end
