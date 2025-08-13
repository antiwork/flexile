# frozen_string_literal: true

class Api::QuickbooksController < ApiController
  before_action :authenticate_user!
  before_action :set_company

  def sync_integration
    render json: { error: "Forbidden" }, status: :forbidden and return unless current_user.company_administrator?(@company)

    integration = @company.quickbooks_integration
    render json: { error: "Integration not found" }, status: :not_found and return unless integration

    QuickbooksIntegrationSyncScheduleJob.perform_async(@company.id)

    render json: { message: "QuickBooks sync initiated" }, status: :ok
  end

  private
    def set_company
      @company = current_user.companies.find(params[:company_id])
    rescue ActiveRecord::RecordNotFound
      render json: { error: "Company not found" }, status: :not_found
    end
end
