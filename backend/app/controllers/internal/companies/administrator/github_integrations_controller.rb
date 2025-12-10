# frozen_string_literal: true

class Internal::Companies::Administrator::GithubIntegrationsController < Internal::Companies::BaseController
  def show
    authorize GithubIntegration

    integration = Current.company.github_integration

    if integration.present?
      render json: {
        connected: true,
        organization_name: integration.organization_name,
        organization_id: integration.organization_id,
        status: integration.status
      }
    else
      render json: { connected: false }
    end
  end

  def connect
    authorize GithubIntegration

    oauth_service = Github::OauthService.new(company: Current.company)
    authorization_url = oauth_service.authorization_url

    render json: { authorization_url: authorization_url }
  end

  def callback
    authorize GithubIntegration

    oauth_service = Github::OauthService.new(company: Current.company)

    unless oauth_service.valid_state?(params[:state])
      render json: { error: "Invalid state parameter" }, status: :bad_request
      return
    end

    begin
      token_data = oauth_service.exchange_code_for_token(code: params[:code])
    rescue Github::OauthService::OauthError => e
      render json: { error: e.message }, status: :unprocessable_entity
      return
    end

    access_token = token_data[:access_token]

    begin
      organizations = oauth_service.fetch_user_organizations(access_token: access_token)
    rescue Github::OauthService::ApiError => e
      render json: { error: e.message }, status: :unprocessable_entity
      return
    end

    if organizations.empty?
      render json: { error: "No organizations found. You need to be a member of at least one GitHub organization." }, status: :unprocessable_entity
      return
    end

    render json: {
      access_token: access_token,
      organizations: organizations
    }
  end

  def create
    authorize GithubIntegration

    access_token = params[:access_token]
    organization_login = params[:organization_login]

    if access_token.blank? || organization_login.blank?
      render json: { error: "Access token and organization are required" }, status: :bad_request
      return
    end

    oauth_service = Github::OauthService.new(company: Current.company)

    begin
      org_details = oauth_service.fetch_organization(access_token: access_token, org_name: organization_login)
    rescue Github::OauthService::ApiError => e
      render json: { error: e.message }, status: :unprocessable_entity
      return
    end

    existing_integration = Current.company.github_integration
    existing_integration&.disconnect!

    integration = Current.company.github_integrations.create!(
      organization_name: org_details[:login],
      organization_id: org_details[:id],
      access_token: access_token,
      status: GithubIntegration::ACTIVE
    )

    render json: {
      connected: true,
      organization_name: integration.organization_name,
      organization_id: integration.organization_id,
      status: integration.status
    }, status: :created
  end

  def destroy
    authorize GithubIntegration

    integration = Current.company.github_integration

    if integration.nil?
      render json: { error: "No GitHub integration found" }, status: :not_found
      return
    end

    integration.disconnect!

    render json: { success: true }
  end

  def pr_payment_status
    authorize GithubIntegration

    pr_url = params[:pr_url]

    if pr_url.blank?
      render json: { error: "PR URL is required" }, status: :bad_request
      return
    end

    lookup_service = Github::PrPaymentLookupService.new(company: Current.company)
    invoices = lookup_service.find_all_invoices_for_pr(pr_url)

    paid_invoices = invoices.select { |i| i[:is_paid] }
    pending_invoices = invoices.reject { |i| i[:is_paid] }

    render json: {
      pr_url: pr_url,
      previously_paid: paid_invoices.any?,
      paid_invoices: paid_invoices,
      pending_invoices: pending_invoices,
      total_paid_amount_cents: paid_invoices.sum { |i| i[:amount_cents] }
    }
  end
end

