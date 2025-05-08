# frozen_string_literal: true

class Internal::Companies::Administrator::QuickbooksController < Internal::Companies::BaseController
  before_action :load_quickbooks_api_client, only: [:connect, :disconnect, :list_accounts]
  before_action :load_quickbooks_integration, only: [:disconnect, :update]


  def connect
    authorize QuickbooksIntegration

    company = Current.company
    if @quickbooks_api_client.valid_oauth_state?(oauth_params[:state])
      quickbooks_integration = QuickbooksIntegration.find_or_initialize_by(
        account_id: oauth_params[:realmId],
        company:
      )
      response = @quickbooks_api_client.get_oauth_token(oauth_params[:code])

      if response.ok?
        quickbooks_integration.status = QuickbooksIntegration.statuses[:active] if quickbooks_integration.status_out_of_sync?
        quickbooks_integration.update_tokens!(response)

        render json: {
          success: true,
          quickbooks_integration: quickbooks_integration.as_json,
          expense_accounts: @quickbooks_api_client.get_expense_accounts,
          bank_accounts: @quickbooks_api_client.get_bank_accounts,
        }
      else
        render json: { success: false }
      end
    else
      render json: { success: false }
    end
  end

  def disconnect
    authorize @quickbooks_integration

    response = @quickbooks_api_client.revoke_token

    if response.ok?
      @quickbooks_integration.mark_deleted!

      render json: { success: true }
    else
      render json: { success: false }
    end
  end

  def update
    authorize @quickbooks_integration

    company = Current.company
    if @quickbooks_integration.flexile_vendor_id.blank?
      @quickbooks_integration.flexile_vendor_id = IntegrationApi::Quickbooks.new(company_id: company.id).get_flexile_vendor_id
    end
    if @quickbooks_integration.flexile_clearance_bank_account_id.blank?
      @quickbooks_integration.flexile_clearance_bank_account_id = IntegrationApi::Quickbooks.new(company_id: company.id).get_flexile_clearance_bank_account_id
    end
    if company_params.dig(:company, :expense_categories_attributes).present?
      company.attributes = company_params[:company]
    end
    if @quickbooks_integration.update(quickbooks_integration_params) && company.save
      render json: { success: true, quickbooks_integration: @quickbooks_integration.as_json }
    else
      render json: { success: false }
    end
  end

  def list_accounts
    authorize QuickbooksIntegration

    render json: { accounts: @quickbooks_api_client.get_expense_accounts }
  end

  private
    def oauth_params
      params.permit(:code, :state, :realmId)
    end

    def load_quickbooks_api_client
      @quickbooks_api_client = IntegrationApi::Quickbooks.new(company_id: Current.company.id)
    end

    def load_quickbooks_integration
      @quickbooks_integration = Current.company.quickbooks_integration
    end

    def quickbooks_integration_params
      params.require(:quickbooks_integration)
            .permit(
              :consulting_services_expense_account_id,
              :flexile_fees_expense_account_id,
              :default_bank_account_id,
              :equity_compensation_expense_account_id,
            )
    end

    def company_params
      params.permit(company: [{ expense_categories_attributes: [:id, :expense_account_id] }])
    end
end
