# frozen_string_literal: true

class CheckTinValidityJob
  include Sidekiq::Job
  sidekiq_options retry: 5
  API_HOST = Rails.env.production? ? "https://api.www4.irs.gov" : "https://api.alt.www4.irs.gov"

  def perform
    res = HTTParty.post("#{API_HOST}/auth/oauth/v2/token", body: {
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: create_jwt(GlobalConfig.dig("irs", "user_id")),
      client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
      client_assertion: create_jwt(GlobalConfig.dig("irs", "client_id")),
    })
    raise "IRS API returned #{res}" if res.code != 200
    token = res["access_token"]
    checked_tins = Set.new
    checked_names = Set.new
    # The TINM API has a limit of 9,999 requests/24 hours.
    # Since we also run this job every 24 hours, we only use about half that limit (4,500) to ensure we don't run into trouble if their limit hasn't reset yet.
    User.joins(:company_investors)
      .includes(:compliance_info)
      .where(country_code: "US").or(User.where(citizenship_country_code: "US"))
      .where.not(compliance_info: { tax_id: nil })
      .where(compliance_info: { tax_id_status: nil })
      .order(:id)
      .distinct.limit(4_500).each do |user|
      name = user.billing_entity_name.delete("'").gsub(/[^a-zA-Z0-9 \-&]/, " ")[0, 70]
      # The TINM API limits billing entity names to 70 characters. Names are truncated after removing unsupported characters.
      # The TINM API punishes checking the same TINs and names multiple times in a day, so preventing duplicates.
      # For duplicate requests, an error would be returned at first, and after four times, we would get locked out for 96 hours.
      next unless checked_names.add?(name) && checked_tins.add?(user.tax_id)

      res = HTTParty.post("#{API_HOST}/esrv/api/tinm/request",
                          body: {
                            tin: user.tax_id,
                            name:,
                            tinType: user.business_entity? ? "EIN" : "SSN",
                          }.to_json,
                          headers: { Authorization: "Bearer #{token}", "Content-Type": "application/json" })
      invalid_tin_error = res.code == 400 && res["errors"].any? { _1["errorCode"] == "TinMatchRequest.tin.invalid" }
      # We stop processing after the API throws an error lest we risk getting blocked.
      raise "IRS API returned #{res} for user #{user.id}" if res.code != 200 && !invalid_tin_error
      if res["responseCode"] == 0
        on_tin_verification_success(user)
      else
        on_tin_verification_failure(user)
      end
    end
  end

  private
    def on_tin_verification_success(user)
      UserMailer.tax_id_validation_success(user.id).deliver_later if user.sent_invalid_tax_id_email?
      user.sent_invalid_tax_id_email = false
      user.compliance_info.update!(tax_id_status: UserComplianceInfo::TAX_ID_STATUS_VERIFIED)
    end

    def on_tin_verification_failure(user)
      UserMailer.tax_id_validation_failure(user.id).deliver_later
      user.sent_invalid_tax_id_email = true
      user.compliance_info.update!(tax_id_status: UserComplianceInfo::TAX_ID_STATUS_INVALID)
    end

    def create_jwt(sub)
      key = OpenSSL::PKey::RSA.new Base64.decode64 GlobalConfig.dig("rsa_private_key")
      JWT.encode({
        iss: GlobalConfig.dig("irs", "client_id"),
        sub:,
        aud: "#{API_HOST}/auth/oauth/v2/token",
        exp: 15.minutes.from_now.to_i,
        jti: DateTime.now.to_i,
      }, key, "RS256", { kid: "flexile" })
    end
end
