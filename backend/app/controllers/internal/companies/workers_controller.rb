# frozen_string_literal: true

class Internal::Companies::WorkersController < Internal::Companies::BaseController
  include Pagy::Backend

  RECORDS_PER_PAGE = 50
  private_constant :RECORDS_PER_PAGE

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

  private
    def worker_params
      params.require(:contractor).permit(:email, :started_at, :pay_rate_in_subunits, :role, :pay_rate_type, :contract_signed_elsewhere)
    end
end
