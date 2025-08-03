# frozen_string_literal: true

class UpdateWorker
  attr_reader :company_worker, :current_user, :worker_params
  attr_accessor :params

  def initialize(company_worker:, params:, current_user:)
    @company_worker = company_worker
    @worker_params = params.dup
    @current_user = current_user
    @document_params = @worker_params.delete(:document)
  end

  def perform
    ActiveRecord::Base.transaction do
      worker_params[:pay_rate_type] = worker_params[:pay_rate_type].to_i if worker_params[:pay_rate_type].present?
      worker_params[:pay_rate_in_subunits] = worker_params[:pay_rate_in_subunits].to_i if worker_params[:pay_rate_in_subunits].present?

      company_worker.update!(**worker_params)

      document = nil
      if document_params.present?
        document = CreateConsultingContract.new(
          company_worker: company_worker,
          company_administrator: company_worker.company.primary_admin,
          current_user: current_user,
          document_params: document_params
        ).perform!
      end

      { success: true, company_worker: company_worker, documentId: document&.id }
    end
  rescue ActiveRecord::RecordInvalid => e
    { success: false, error_message: e.record.errors.full_messages.to_sentence }
  end

  private
    def document_params
      return unless @document_params.present?
      @document_params[:recipient] = company_worker.user.external_id
      @document_params
    end
end
