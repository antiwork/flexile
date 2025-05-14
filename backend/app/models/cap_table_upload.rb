# frozen_string_literal: true

class CapTableUpload < ApplicationRecord
  include ExternalId

  belongs_to :company
  belongs_to :user

  has_many_attached :files

  STATUSES = [
    "submitted",
    "processing",
    "needs_additional_info",
    "completed",
    "failed",
    "canceled",
  ]

  validates :files, presence: true
  validates :status, inclusion: { in: STATUSES }
end
