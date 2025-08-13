# frozen_string_literal: true

class QuickbooksWorkersSyncJob
  include Sidekiq::Job
  sidekiq_options retry: 5

  def perform(company_id, active_worker_ids)
    lock_manager = LockManager.new
    lock_manager.lock!("quickbooks_workers_sync:#{company_id}") do
      perform_sync(company_id, active_worker_ids)
    end
  end

  private
    def perform_sync(company_id, active_worker_ids)
      company = Company.find_by(id: company_id)
      return if company.nil?

      integration = company.quickbooks_integration
      return if integration.nil? || integration.status != "active"



      qbo = IntegrationApi::Quickbooks.new(company_id: company_id)

      company.company_workers.where(id: active_worker_ids, ended_at: nil).find_each do |worker|
        qbo.sync_data_for(object: worker)
      rescue => e
        Rails.logger.error("Failed to sync worker #{worker.id} for company #{company_id}: #{e.class}: #{e.message}")
        raise if e.message.to_s.match?(/unauthorized/i)
      end

      # TODO (techdebt): Consider tracking last_attempt_at vs last_sync_at for partial failures
      integration.update!(last_sync_at: Time.current)
    end
end
