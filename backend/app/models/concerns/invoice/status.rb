# frozen_string_literal: true

module Invoice::Status
  extend ActiveSupport::Concern

  PROCESSING = "processing"
  PAID = "paid"
  FAILED = "failed"
end
