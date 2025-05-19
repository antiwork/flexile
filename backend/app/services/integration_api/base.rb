# frozen_string_literal: true

class IntegrationApi::Base
  OAUTH_REDIRECT_URL = Rails.application.routes.url_helpers.oauth_redirect_url
  private_constant :OAUTH_REDIRECT_URL

  attr_accessor :integration

  delegate :account_id, :access_token, to: :integration, allow_nil: true

  def initialize(company_id:)
    @company = Company.find(company_id)
    @state = Base64.strict_encode64("#{company.external_id}:#{company.name}")
  end

  def valid_oauth_state?(state)
    decoded_state = Base64.strict_decode64(state)
    company_external_id, company_name = decoded_state.split(":")

    company_external_id == company.external_id && company_name == company.name
  end

  private
    attr_reader :client_id, :client_secret, :state, :company

    def make_api_request(method:, url:, body: nil, headers:)
      response = case method
                 when "GET"
                   HTTParty.get(url, headers:)
                 when "POST"
                   HTTParty.post(url, body:, headers:)
                 when "DELETE"
                   HTTParty.delete(url, body:, headers:)
                 else
                   raise "Invalid method for #{self.class.name} API"
      end

      Rails.logger.info "#{self.class.name}.status: #{response.code}"
      Rails.logger.error "#{self.class.name}.response: #{response.parsed_response}" unless response.ok?

      if response.unauthorized?
        raise OAuth2::Error.new("Unauthorized")
      end

      response
    end
end
