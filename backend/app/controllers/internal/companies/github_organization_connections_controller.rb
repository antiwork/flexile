# frozen_string_literal: true

class Internal::Companies::GithubOrganizationConnectionsController < Internal::Companies::BaseController
  skip_after_action :verify_authorized

  skip_before_action :authenticate_user_json!, only: :callback
  before_action :authenticate_from_state!, only: :callback
  before_action :set_company
  before_action :authorize_company_admin!

  # POST /internal/github_organization_connection/start
  def start
    state = JwtService.generate_oauth_state(user_id: Current.user.id)
    cookies[:github_oauth_state] = state

    # Store requested redirect_url in a cookie if provided
    if params[:redirect_url].present?
      cookies[:github_oauth_redirect_url] = params[:redirect_url]
    end

    # For GitHub Apps, we point to the installation page rather than just authorize.
    # This allows the user to select the organization they want to install the app on.
    github_auth_url = "https://github.com/apps/#{ENV['GH_APP_SLUG']}/installations/new?" \
                      "state=#{state}"

    render json: { url: github_auth_url }, status: :ok
  end

  # GET /internal/github_organization_connection/callback
  def callback
    installation_id = params[:installation_id]
    # Clear the state cookie if it exists
    cookies.delete(:github_oauth_state)

    if installation_id.present?
      # Automated flow for GitHub App installation redirects
      # Fetch organization details using the installation ID
      app_service = GithubAppService.new
      installation = app_service.fetch_installation_details(installation_id)

      github_org_id = installation[:account][:id].to_s
      github_org_login = installation[:account][:login]

      # Automatically create or reactivate the connection
      connection = @company.github_connection || @company.build_github_connection
      connection.update!(
        connected_by: Current.user,
        github_org_id: github_org_id,
        github_org_login: github_org_login,
        installation_id: installation_id,
        revoked_at: nil
      )
    elsif params[:code].present?
      # Fallback for standard OAuth code flow if used
      Octokit.exchange_code_for_token(
        params[:code],
        ENV["GH_CLIENT_ID"],
        ENV["GH_CLIENT_SECRET"],
        { redirect_uri: callback_github_organization_connection_url(protocol: PROTOCOL, host: API_DOMAIN) }
      )
      # In this flow, we'd still need an installation_id to be useful for the App
    else
      raise "Missing installation_id or code in GitHub callback"
    end

    # Determine redirect URL
    redirect_url = cookies.delete(:github_oauth_redirect_url) ||
                   "#{PROTOCOL}://#{DOMAIN}/settings/administrator/integrations?github_org=success"

    redirect_to redirect_url, allow_other_host: true
  rescue StandardError => e
    Rails.logger.error("GitHub Org OAuth callback error: #{e.message}")
    Rails.logger.error(e.backtrace.join("\n"))

    error_redirect_url = "#{PROTOCOL}://#{DOMAIN}/settings/administrator/integrations?github_org=error"
    redirect_to error_redirect_url, allow_other_host: true
  end

  # POST /internal/github_organization_connection
  def create
    github_org_id = params[:github_org_id]
    github_org_login = params[:github_org_login]
    installation_id = params[:installation_id]

    # Check if this org is already connected to another company
    existing_connection = CompanyGithubConnection.active.find_by(github_org_id: github_org_id)
    if existing_connection && existing_connection.company_id != @company.id
      render json: { error: "This GitHub organization is already connected to another company" },
             status: :unprocessable_entity
      return
    end

    # Check if company already has a connection
    if @company.github_connection&.active?
      render json: { error: "Company already has an active GitHub organization connection" },
             status: :unprocessable_entity
      return
    end

    connection = CompanyGithubConnection.create!(
      company: @company,
      connected_by: Current.user,
      github_org_id: github_org_id,
      github_org_login: github_org_login,
      installation_id: installation_id
    )

    render json: { success: true, connection: connection }, status: :ok
  rescue ActiveRecord::RecordInvalid => e
    render json: { error: e.message }, status: :unprocessable_entity
  end

  # DELETE /internal/github_organization_connection
  def destroy
    connection = @company.github_connection

    unless connection&.active?
      render json: { error: "No active GitHub connection found" }, status: :not_found
      return
    end

    # Uninstall the GitHub App from the organization
    if connection.installation_id.present?
      begin
        GithubAppService.new.delete_installation(connection.installation_id)
      rescue StandardError => e
        Rails.logger.warn("Failed to delete GitHub installation #{connection.installation_id}: #{e.message}")
        # We continue even if uninstallation fails (e.g. if already uninstalled on GitHub)
      end
    end

    connection.update!(revoked_at: Time.current)

    render json: { success: true }, status: :ok
  rescue StandardError => e
    Rails.logger.error("GitHub org disconnect error: #{e.message}")
    render json: { error: "Failed to disconnect GitHub organization" }, status: :internal_server_error
  end

  private
    def set_company
      @company = Current.user&.all_companies&.first

      unless @company
        render json: { error: "No company found" }, status: :not_found
        nil
      end
    end

    def authorize_company_admin!
      return if @company.nil?

      unless Current.user&.company_administrator_for?(@company)
        render json: { error: "Forbidden" }, status: :forbidden
        nil
      end
    end

    def authenticate_from_state!
      state = params[:state]
      payload = JwtService.decode_oauth_state(state)

      if payload.blank? || payload[:user_id].blank?
        render json: { success: false, error: "Invalid or expired state" }, status: :unauthorized
        return
      end

      user = User.find_by(id: payload[:user_id])
      if user.nil?
        render json: { success: false, error: "User not found" }, status: :unauthorized
        return
      end

      Current.authenticated_user = user
    end
end
