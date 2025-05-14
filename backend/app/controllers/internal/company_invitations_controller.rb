# frozen_string_literal: true

class Internal::CompanyInvitationsController < Internal::BaseController
  before_action :authenticate_user_json!

  after_action :verify_authorized

  def create
    authorize :company_invitation

    result = InviteCompany.new(
      worker: Current.user,
      company_administrator_params:,
      company_params:,
      company_worker_params:,
    ).perform

    if result[:success]
      render json: { success: true, new_user_id: result[:administrator].id, document_id: result[:document].id }, status: :created
    else
      render json: { success: false, errors: result[:errors] }, status: :unprocessable_entity
    end
  end

  private
    def company_administrator_params
      params.require(:company_administrator).permit(:email)
    end

    def company_params
      params.require(:company).permit(:name)
    end

    def company_worker_params
      params.require(:company_worker).permit(
        :started_at,
        :pay_rate_in_subunits,
        :pay_rate_type,
        :hours_per_week,
        :role,
      )
    end
end
