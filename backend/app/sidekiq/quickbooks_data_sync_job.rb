# frozen_string_literal: true

class QuickbooksDataSyncJob
  include Sidekiq::Job
  sidekiq_options retry: 5

  def perform(company_id, object_type, object_id)
    object_type = "CompanyWorker" if object_type == "CompanyContractor"
    object = object_type.constantize.find(object_id)
    IntegrationApi::Quickbooks.new(company_id:).sync_data_for(object:)
  end
end
