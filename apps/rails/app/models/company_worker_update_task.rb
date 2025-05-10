# frozen_string_literal: true

class CompanyWorkerUpdateTask < ApplicationRecord
  include TimestampStateFields
  self.table_name = "company_contractor_update_tasks"
  timestamp_state_fields :completed, default_state: :incomplete

  belongs_to :company_worker_update, foreign_key: :company_contractor_update_id
  has_many :integration_records, as: :integratable

  validates :name, presence: true
end
