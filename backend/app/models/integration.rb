# frozen_string_literal: true

class Integration < ApplicationRecord
  include Deletable

  belongs_to :company
  has_many :integration_records

  store_accessor :configuration, :access_token
  encrypts :configuration

  enum :status, {
    initialized: "initialized",
    active: "active",
    out_of_sync: "out_of_sync",
    deleted: "deleted",
  }, prefix: true

  validates :company, presence: true
  validates :account_id, presence: true
  validates :access_token, presence: true
  validates :type, uniqueness: { scope: :company_id, conditions: -> { alive } }
  validates :status, inclusion: { in: statuses.values }

  def as_json(*)
    {
      id:,
      status:,
      last_sync_at: last_sync_at&.iso8601,
    }
  end

  def update_tokens!(response)
    self.access_token = response.parsed_response["access_token"]
    save!
  end

  def mark_deleted!
    integration_records.alive.each(&:mark_deleted!)
    self.status = self.class.statuses[:deleted]
    super
  end
end
