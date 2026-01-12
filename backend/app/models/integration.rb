# frozen_string_literal: true

class Integration < ApplicationRecord
  belongs_to :company

  enum :status, {
    initialized: "initialized",
    active: "active",
    out_of_sync: "out_of_sync",
    deleted: "deleted",
  }, prefix: true

  validates :type, presence: true
end
