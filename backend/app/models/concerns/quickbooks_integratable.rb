# frozen_string_literal: true

module QuickbooksIntegratable
  extend ActiveSupport::Concern

  included do
    has_one :quickbooks_integration_record, -> do
      alive.not_quickbooks_journal_entry.joins(:integration).where(integration: { type: "QuickbooksIntegration" })
    end, as: :integratable, class_name: "IntegrationRecord"

    delegate :integration_external_id, :sync_token, to: :quickbooks_integration_record, allow_nil: true
  end

  def create_or_update_quickbooks_integration_record!(integration:, parsed_body:, is_journal_entry: false)
    record = find_or_create_integration_record!(integration:, integration_external_id: parsed_body["Id"])
    record.update!(quickbooks_journal_entry: is_journal_entry) if is_journal_entry

    sync_token = parsed_body["SyncToken"]
    record.update!(sync_token:) if sync_token != record.sync_token
    integration.update!(last_sync_at: Time.current)
  end

  private
    def find_or_create_integration_record!(integration:, integration_external_id:)
      if self.class.name == "CompanyWorker"
        IntegrationRecord.where(
          integration:,
          integratable_type: [CompanyWorker.name, "CompanyContractor"],
          integratable_id: id,
          integration_external_id:
        ).first || IntegrationRecord.create!(
          integration:,
          integratable: self,
          integration_external_id:
        )
      else
        IntegrationRecord.find_or_create_by!(
          integration:,
          integratable: self,
          integration_external_id:
        )
      end
    end
end
