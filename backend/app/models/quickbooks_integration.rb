# frozen_string_literal: true

class QuickbooksIntegration < Integration
  DEFAULT_OAUTH_TOKEN_EXPIRE_INTERVAL = 1.hour
  DEFAULT_OAUTH_REFRESH_TOKEN_EXPIRE_INTERVAL = 24.hours
  private_constant :DEFAULT_OAUTH_TOKEN_EXPIRE_INTERVAL, :DEFAULT_OAUTH_REFRESH_TOKEN_EXPIRE_INTERVAL

  store_accessor :configuration, :flexile_vendor_id, :equity_compensation_expense_account_id,
                 :consulting_services_expense_account_id,
                 :flexile_fees_expense_account_id, :default_bank_account_id, :flexile_clearance_bank_account_id,
                 :expires_at, :refresh_token, :refresh_token_expires_at

  validates :expires_at, :refresh_token, :refresh_token_expires_at, presence: true
  validates :flexile_vendor_id, :consulting_services_expense_account_id,
            :flexile_fees_expense_account_id, :default_bank_account_id, :flexile_clearance_bank_account_id,
            presence: true, on: :update, unless: -> { status_deleted? }

  after_update_commit :sync_existing_data

  def as_json(*)
    super.merge({
      consulting_services_expense_account_id:,
      flexile_fees_expense_account_id:,
      default_bank_account_id:,
    })
  end

  def update_tokens!(response)
    self.expires_at = if response.parsed_response["expires_in"].present?
      Time.current + response.parsed_response["expires_in"].to_i.seconds
    else
      DEFAULT_OAUTH_TOKEN_EXPIRE_INTERVAL.from_now
    end
    self.refresh_token = response.parsed_response["refresh_token"]

    # It's better to set the default refresh token expiration interval than to use the value returned by the API to
    # avoid invalid grant errors.
    # Ref: https://developer.intuit.com/app/developer/qbo/docs/develop/authentication-and-authorization/faq#why-does-the-refresh-token-change-24-hours
    self.refresh_token_expires_at = DEFAULT_OAUTH_REFRESH_TOKEN_EXPIRE_INTERVAL.from_now
    super
  end

  private
    def sync_existing_data
      if saved_change_to_configuration? && status_initialized? && setup_completed?
        QuickbooksIntegrationSyncScheduleJob.perform_async(company_id)
      end
    end

    def setup_completed?
      flexile_vendor_id.present? &&
        consulting_services_expense_account_id.present? &&
        flexile_fees_expense_account_id.present? &&
        default_bank_account_id.present?
    end
end
