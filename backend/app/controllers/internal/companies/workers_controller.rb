# frozen_string_literal: true

class Internal::Companies::WorkersController < Internal::Companies::BaseController
  include Pagy::Backend

  RECORDS_PER_PAGE = 50
  private_constant :RECORDS_PER_PAGE

  before_action :set_company_worker, only: [:update]

  def create
    authorize CompanyWorker

    result = InviteWorker.new(
      current_user: Current.user,
      company: Current.company,
      company_administrator: Current.company_administrator,
      worker_params:,
    ).perform

    if result[:success]
      render json: { success: true, new_user_id: result[:company_worker].user_id, document_id: result[:document]&.id }, status: :ok
    else
      render json: result, status: :unprocessable_entity
    end
  end

  def update
    authorize CompanyWorker

    result = UpdateWorker.new(
      company_worker: @company_worker,
      params: worker_params,
      current_user: Current.user,
    ).perform

    if result[:success]
      render json: { success: true, worker_id: @company_worker.external_id }, status: :ok
    else
      render json: result, status: :unprocessable_entity
    end
  end

  private
    def worker_params
      contractor_params = params.require(:contractor).permit(
        :email,
        :started_at,
        :pay_rate_in_subunits,
        :role,
        :pay_rate_type,
        :contract_signed_elsewhere
      )

      contractor_params[:pay_rate_type] = contractor_params[:pay_rate_type].to_i if contractor_params[:pay_rate_type].present?
      contractor_params[:pay_rate_in_subunits] = contractor_params[:pay_rate_in_subunits].to_i if contractor_params[:pay_rate_in_subunits].present?
      contractor_params[:contract_signed_elsewhere] = ActiveModel::Type::Boolean.new.cast(contractor_params[:contract_signed_elsewhere])

      unless contractor_params[:contract_signed_elsewhere]
        document_params = params.require(:document).permit(:name, :text_content, :attachment, :signed)
        contractor_params = contractor_params.merge(document: document_params)
      end

      contractor_params
    end

    def set_company_worker
      @company_worker = Current.company.company_workers.find_by(external_id: params[:id])
    end
end
