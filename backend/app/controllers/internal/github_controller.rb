# frozen_string_literal: true

class Internal::GithubController < Internal::BaseController
  before_action :authenticate_user_json!, except: [:installation_callback]
  after_action :verify_authorized, except: [:installation_callback]

  def oauth_url
    authorize :github, :connect?

    state = generate_oauth_state
    session[:github_oauth_state] = state

    redirect_uri = params[:redirect_uri] || github_callback_url

    include_orgs = ActiveModel::Type::Boolean.new.cast(params[:include_orgs])

    begin
      render json: {
        url: GithubService.oauth_url(state: state, redirect_uri: redirect_uri, include_orgs: include_orgs),
      }
    rescue GithubService::ConfigurationError
      render json: { error: "GitHub integration is not configured" }, status: :service_unavailable
    end
  end

  def app_installation_url
    authorize :github, :manage_org?

    random_token = SecureRandom.hex(16)
    timestamp = Time.current.to_i
    company = Current.user.all_companies.find { |c| Current.user.company_administrator_for(c).present? }

    if company.blank?
      render json: { error: "No company found where you are an administrator" }, status: :unprocessable_entity
      return
    end

    state_data = "#{random_token}:#{Current.user.id}:#{company.id}:#{timestamp}"
    signature = OpenSSL::HMAC.hexdigest("SHA256", Rails.application.secret_key_base, state_data)
    state = "#{state_data}:#{signature}"

    begin
      url = GithubService.app_installation_url(state: state)
      if url.nil?
        render json: { error: "GitHub App is not configured" }, status: :service_unavailable
        return
      end

      render json: { url: url }
    rescue GithubService::ConfigurationError
      render json: { error: "GitHub integration is not configured" }, status: :service_unavailable
    end
  end

  def callback
    authorize :github, :connect?

    code = params[:code]
    state = params[:state]
    redirect_uri = params[:redirect_uri] || github_callback_url

    if state.blank? || state != session[:github_oauth_state]
      render json: { error: "Invalid state parameter" }, status: :bad_request
      return
    end

    session.delete(:github_oauth_state)

    begin
      access_token = GithubService.exchange_code_for_token(code: code, redirect_uri: redirect_uri)
      user_info = GithubService.fetch_user_info(access_token: access_token)

      existing_user = User.where(github_uid: user_info[:uid]).where.not(id: Current.user.id).first
      if existing_user.present?
        render json: { error: "This GitHub account is already connected to another user" }, status: :conflict
        return
      end

      Current.user.update!(
        github_uid: user_info[:uid],
        github_username: user_info[:username],
        github_access_token: access_token
      )

      render json: {
        success: true,
        github_username: user_info[:username],
      }
    rescue GithubService::ConfigurationError
      render json: { error: "GitHub integration is not configured" }, status: :service_unavailable
    rescue GithubService::OAuthError => e
      render json: { error: e.message }, status: :bad_request
    rescue GithubService::ApiError => e
      render json: { error: e.message }, status: :unprocessable_entity
    end
  end

  def disconnect
    authorize :github, :disconnect?

    Current.user.update!(
      github_uid: nil,
      github_username: nil,
      github_access_token: nil
    )

    head :no_content
  end

  def pr
    authorize :github, :fetch_pr?

    url = params[:url]

    unless GithubService.valid_pr_url?(url)
      render json: { error: "Invalid GitHub PR URL" }, status: :bad_request
      return
    end

    unless Current.company.github_org_name.present?
      render json: { error: "GitHub App not connected. Please connect GitHub in Settings > Integrations." }, status: :unprocessable_entity
      return
    end

    begin
      pr_details = GithubService.fetch_pr_details_from_url_with_app(
        org_name: Current.company.github_org_name,
        url: url
      )

      if pr_details.nil?
        render json: { error: "Could not parse PR URL" }, status: :bad_request
        return
      end

      render json: { pr: pr_details }
    rescue GithubService::ApiError => e
      render json: { error: e.message }, status: :unprocessable_entity
    end
  end

  def orgs
    authorize :github, :list_orgs?

    access_token = Current.user.github_access_token

    begin
      organizations = GithubService.fetch_user_orgs(access_token: access_token)
      render json: { orgs: organizations }
    rescue GithubService::ApiError => e
      render json: { error: e.message }, status: :unprocessable_entity
    end
  end

  # POST /internal/github/installation_callback
  # Handles the callback from GitHub App installation with OAuth
  # This endpoint is PUBLIC (no authentication required) because:
  # 1. User is redirected from GitHub and may not have auth cookies
  # 2. We validate via signed state parameter that includes user_id and company_id
  # 3. State is signed with secret key to prevent tampering
  def installation_callback
    installation_id = params[:installation_id]
    setup_action = params[:setup_action]
    state = params[:state]
    code = params[:code]

    Rails.logger.info "[GitHub Installation] Callback received: installation_id=#{installation_id}, setup_action=#{setup_action}, state=#{state.present?}, code=#{code.present?}"

    if state.blank?
      render json: { error: "Missing state parameter" }, status: :bad_request
      return
    end

    state_parts = state.split(":")
    if state_parts.length != 5
      Rails.logger.warn "[GitHub Installation] Invalid state format: #{state_parts.length} parts"
      render json: { error: "Invalid state parameter format" }, status: :bad_request
      return
    end

    random_token, user_id_str, company_id_str, timestamp_str, received_signature = state_parts

    state_data = "#{random_token}:#{user_id_str}:#{company_id_str}:#{timestamp_str}"
    expected_signature = OpenSSL::HMAC.hexdigest("SHA256", Rails.application.secret_key_base, state_data)

    unless ActiveSupport::SecurityUtils.secure_compare(received_signature, expected_signature)
      Rails.logger.warn "[GitHub Installation] Signature mismatch"
      render json: { error: "Invalid state signature" }, status: :bad_request
      return
    end

    timestamp = timestamp_str.to_i
    if Time.current.to_i - timestamp > 30.minutes.to_i
      Rails.logger.warn "[GitHub Installation] State expired: #{Time.current.to_i - timestamp} seconds old"
      render json: { error: "Installation link has expired. Please try connecting again." }, status: :bad_request
      return
    end

    user_id = user_id_str.to_i
    company_id = company_id_str.to_i

    if setup_action != "install" || installation_id.blank?
      render json: { error: "GitHub App installation was not completed" }, status: :bad_request
      return
    end

    if code.blank?
      render json: { error: "OAuth code not received from GitHub" }, status: :bad_request
      return
    end

    user = User.find_by(id: user_id)
    if user.blank?
      Rails.logger.error "[GitHub Installation] User not found: user_id=#{user_id}"
      render json: { error: "User not found. Please try connecting again." }, status: :not_found
      return
    end

    # Find the company from state
    company = Company.find_by(id: company_id)
    if company.blank? || user.company_administrator_for(company).blank?
      Rails.logger.error "[GitHub Installation] Company not found or user not admin: company_id=#{company_id}, user_id=#{user_id}"
      render json: { error: "Company not found or you are not an administrator" }, status: :forbidden
      return
    end

    begin
      # If we have an OAuth code, exchange it for user info
      if code.present?
        access_token = GithubService.exchange_code_for_token(
          code: code,
          redirect_uri: github_installation_callback_url
        )

        # Fetch user info and update user's GitHub connection
        user_info = GithubService.fetch_user_info(access_token: access_token)
        user.update!(
          github_uid: user_info[:uid],
          github_username: user_info[:username],
          github_access_token: access_token
        )

        Rails.logger.info "[GitHub Installation] User authenticated: #{user_info[:username]}"

        # First, try to get installation details directly using App JWT (most reliable)
        if GithubService.app_configured?
          installation_info = GithubService.fetch_installation(installation_id: installation_id)
          if installation_info.present?
            account = installation_info[:account]
            company.update!(
              github_org_name: account[:login],
              github_org_id: account[:id],
            )
            company.reload

            Rails.logger.info "[GitHub Installation] Auto-connected via App JWT: #{account[:login]}"

            render json: {
              success: true,
              installation_id: installation_id.to_s,
              company_id: company.external_id,
              auto_connected: true,
              org_name: account[:login],
              github_username: user_info[:username],
              message: "Successfully connected to #{account[:login]}",
            }
            return
          end
        end

        # Fallback: Try to find the installation using user's access token
        installation_info = GithubService.find_installation_for_user(
          access_token: access_token,
          installation_id: installation_id,
        )

        if installation_info.present?
          account = installation_info[:account]
          company.update!(
            github_org_name: account[:login],
            github_org_id: account[:id],
          )
          company.reload

          Rails.logger.info "[GitHub Installation] Auto-connected from user installations: #{account[:login]}"

          render json: {
            success: true,
            installation_id: installation_id.to_s,
            company_id: company.external_id,
            auto_connected: true,
            org_name: account[:login],
            github_username: user_info[:username],
            message: "Successfully connected to #{account[:login]}",
          }
          return
        end

        # Final fallback: fetch user's organizations (may be empty if no read:org scope)
        orgs = GithubService.fetch_user_orgs(access_token: access_token)
        Rails.logger.info "[GitHub Installation] Could not find installation via any method, falling back to orgs: #{orgs.size}"

        # If only one org, automatically connect it
        if orgs.size == 1
          org = orgs.first
          company.update!(
            github_org_name: org[:login],
            github_org_id: org[:id]
          )
          company.reload

          Rails.logger.info "[GitHub Installation] Auto-connected single org: #{org[:login]}"

          render json: {
            success: true,
            installation_id: installation_id.to_s,
            company_id: company.external_id,
            auto_connected: true,
            org_name: org[:login],
            github_username: user_info[:username],
            message: "Successfully connected to #{org[:login]}",
          }
          return
        end

        # Multiple orgs or none - return list for user to select
        # Also fetch all installations the user can access as additional options
        installations = GithubService.fetch_user_app_installations(access_token: access_token)
        installation_accounts = installations.filter_map { |i| i[:account] }

        # Combine orgs and installation accounts, removing duplicates
        all_accounts = (orgs + installation_accounts).uniq { |a| a[:id] || a["id"] }

        Rails.logger.info "[GitHub Installation] Available accounts: #{all_accounts.map { |a| a[:login] }.join(', ')}"

        render json: {
          success: true,
          installation_id: installation_id.to_s,
          company_id: company.external_id,
          orgs: all_accounts,
          github_username: user_info[:username],
          message: "Please select which organization you installed the app on",
        }
      else
        # No OAuth code - just save the installation_id and let user configure later
        # This happens when "Request user authorization during installation" is not checked
        Rails.logger.info "[GitHub Installation] No OAuth code, saving installation_id only"

        render json: {
          success: true,
          installation_id: installation_id.to_s,
          company_id: company.external_id,
          needs_org_selection: true,
          message: "Please select which organization you installed the app on",
        }
      end
    rescue GithubService::OAuthError => e
      Rails.logger.error "[GitHub Installation] OAuth error: #{e.message}"
      render json: { error: "GitHub authentication failed: #{e.message}" }, status: :bad_request
    rescue GithubService::ApiError => e
      Rails.logger.error "[GitHub Installation] API error: #{e.message}"
      render json: { error: "GitHub API error: #{e.message}" }, status: :unprocessable_entity
    rescue => e
      Rails.logger.error "[GitHub Installation] Unexpected error: #{e.class} - #{e.message}\n#{e.backtrace.first(5).join("\n")}"
      render json: { error: "An unexpected error occurred. Please try again." }, status: :internal_server_error
    end
  end

  private
    def generate_oauth_state
      SecureRandom.hex(32)
    end

    def github_callback_url
      # This should be configured to point to the frontend callback handler
      "#{request.base_url}/github/callback"
    end

    def github_installation_callback_url
      # This should point to the frontend installation callback page
      "#{request.base_url}/github/installation"
    end
end
