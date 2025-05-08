# frozen_string_literal: true

class IntegrationRecord < ApplicationRecord
  include Deletable

  belongs_to :integration
  belongs_to :integratable, polymorphic: true

  validates :integration, presence: true
  validates :integratable_id, presence: true
  validates :integratable_type, presence: true
  validates :integration_external_id, presence: true

  scope :quickbooks_journal_entry, -> { where(quickbooks_journal_entry: true) }
  scope :not_quickbooks_journal_entry, -> { where(quickbooks_journal_entry: false) }
end
