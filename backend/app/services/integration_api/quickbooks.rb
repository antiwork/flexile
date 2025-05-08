# frozen_string_literal: true

class IntegrationApi::Quickbooks < IntegrationApi::Base
  BASE_OAUTH_URL = "https://appcenter.intuit.com/connect/oauth2"
  OAUTH_TOKEN_URL = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer"
  REVOKE_TOKEN_URL = "https://developer.api.intuit.com/v2/oauth2/tokens/revoke"
  BASE_API_URL = Rails.env.production? ?
                   "https://quickbooks.api.intuit.com" :
                   "https://sandbox-quickbooks.api.intuit.com"
  SCOPE = "com.intuit.quickbooks.accounting"
  MINOR_VERSION = 75
  RECORDS_PER_PAGE = 1000
  VALID_QUICKBOOKS_ACCOUNT_TYPES = ["Expense", "Bank", "Accounts Payable"]
  CLEARANCE_BANK_ACCOUNT_NAME = "Flexile.com Money Out Clearing"
  private_constant :BASE_OAUTH_URL, :BASE_API_URL, :OAUTH_TOKEN_URL, :RECORDS_PER_PAGE,
                   :REVOKE_TOKEN_URL, :SCOPE, :MINOR_VERSION, :VALID_QUICKBOOKS_ACCOUNT_TYPES,
                   :CLEARANCE_BANK_ACCOUNT_NAME

  delegate :expires_at, :refresh_token, to: :integration, allow_nil: true

  def initialize(company_id:)
    super(company_id:)
    @integration = company.quickbooks_integration
    @client_id = GlobalConfig.get("QUICKBOOKS_CLIENT_ID")
    @client_secret = GlobalConfig.get("QUICKBOOKS_CLIENT_SECRET")
    @lock_manager = LockManager.new
  end

  def oauth_location
    uri = URI(BASE_OAUTH_URL)
    query_params = Array.new
    query_params.push(["client_id", client_id])
    query_params.push(["scope", SCOPE])
    query_params.push(["redirect_uri", OAUTH_REDIRECT_URL])
    query_params.push(["state", state])
    query_params.push(%w[response_type code])

    query_params.each do |element|
      params = URI.decode_www_form(uri.query || "") << element
      uri.query = URI.encode_www_form(params)
    end

    uri
  end

  def get_oauth_token(code)
    body = {
      grant_type: "authorization_code",
      code:,
      redirect_uri: OAUTH_REDIRECT_URL,
    }

    make_api_request(method: "POST", url: OAUTH_TOKEN_URL, body: URI.encode_www_form(body), headers: oauth_request_header)
  end

  def get_new_refresh_token
    lock_manager.lock!(integration.cache_key) do
      integration.reload # reload the integration to get the latest tokens and timestamps

      if expires_at.present? && Time.iso8601(expires_at).before?(Time.current)
        body = {
          grant_type: "refresh_token",
          refresh_token:,
        }

        response = make_api_request(method: "POST", url: OAUTH_TOKEN_URL, body: URI.encode_www_form(body), headers: oauth_request_header)
        integration.update_tokens!(response) if response.ok?
      end
    end
  end

  def revoke_token
    make_api_request(method: "POST", url: REVOKE_TOKEN_URL, body: URI.encode_www_form({ token: refresh_token }), headers: oauth_request_header)
  end

  def get_flexile_vendor_id
    flexile_vendor_id = make_authenticated_request do
      query = "select * from Vendor where DisplayName = 'Flexile'"
      url = base_api_url + "/query?query=#{query}&minorversion=#{MINOR_VERSION}"
      response = make_api_request(method: "GET", url:, headers: api_request_header)
      response.parsed_response.dig("QueryResponse", "Vendor", 0, "Id")
    end

    return flexile_vendor_id if flexile_vendor_id.present?

    make_authenticated_request do
      url = base_api_url + "/vendor?minorversion=#{MINOR_VERSION}"
      body = {
        "DisplayName": "Flexile",
        "PrimaryEmailAddr": {
          "Address": "hi@flexile.com",
        },
        "WebAddr": {
          "URI": "https://flexile.com",
        },
        "CompanyName": "Gumroad Inc.",
        "TaxIdentifier": "453361423",
        "BillAddr": {
          "City": "San Francisco",
          "Line1": "548 Market St",
          "PostalCode": "94104-5401",
          "Country": "US",
          "CountrySubDivisionCode": "CA",
        },
      }.to_json
      response = HTTParty.post(url, body:, headers: api_request_header)
      raise OAuth2::Error.new("Unauthorized\nIntuit TID: #{response.headers["intuit_tid"]}") if response.unauthorized?
      response.parsed_response.dig("Vendor", "Id")
    end
  end

  def get_flexile_clearance_bank_account_id
    flexile_vendor_id = make_authenticated_request do
      query = "select * from Account where AccountType = 'Bank' and Name = '#{CLEARANCE_BANK_ACCOUNT_NAME}' and Active = true"
      url = base_api_url + "/query?query=#{query}&minorversion=#{MINOR_VERSION}"
      response = make_api_request(method: "GET", url:, headers: api_request_header)
      response.parsed_response.dig("QueryResponse", "Account", 0, "Id")
    end

    return flexile_vendor_id if flexile_vendor_id.present?

    make_authenticated_request do
      url = base_api_url + "/account?minorversion=#{MINOR_VERSION}"
      body = { "Name": CLEARANCE_BANK_ACCOUNT_NAME, "AccountType": "Bank" }.to_json
      response = HTTParty.post(url, body:, headers: api_request_header)
      raise OAuth2::Error.new("Unauthorized\nIntuit TID: #{response.headers["intuit_tid"]}") if response.unauthorized?
      response.parsed_response.dig("Account", "Id")
    end
  end

  def get_accounts_payable_accounts
    fetch_quickbooks_accounts(type: "Accounts Payable")
  end

  def get_expense_accounts
    fetch_quickbooks_accounts(type: "Expense")
  end

  def get_bank_accounts
    # Flexile's bank account should not be exposed to the user since it's used internally for clearing QBO transactions
    fetch_quickbooks_accounts(type: "Bank").delete_if { _1[:name] == CLEARANCE_BANK_ACCOUNT_NAME }
  end

  def sync_data_for(object:)
    return if integration.nil? || integration.status_out_of_sync? || integration.status_deleted?

    # Avoid duplicating Quickbooks entities on sync
    if object.respond_to?(:fetch_existing_quickbooks_entity)
      parsed_body = object.fetch_existing_quickbooks_entity
      if parsed_body.present?
        object.create_or_update_quickbooks_integration_record!(integration:, parsed_body:)
        return
      end
    end

    make_authenticated_request do
      lock_manager.lock!(object.cache_key) do
        object.reload # reload the object to get the latest integration_external_id and sync_token
        url = base_api_url + "/#{object.quickbooks_entity.downcase}?minorversion=#{MINOR_VERSION}"
        body = object.serialize(namespace: "Quickbooks")
        response = make_api_request(method: "POST", url:, body:, headers: api_request_header)
        if response.ok?
          parsed_body = response.parsed_response[object.quickbooks_entity]
          object.create_or_update_quickbooks_integration_record!(integration:, parsed_body:)
        elsif response.bad_request?
          error_code = response.parsed_response.dig("Fault", "Error", 0, "code")

          if error_code == "6240" # Duplicate name exists error
            integration_external_id = response.parsed_response.dig("Fault", "Error", 0, "Detail").split(":").last.split("=").last
            parsed_body = fetch_quickbooks_entity(entity: object.quickbooks_entity, integration_external_id:)
            object.create_or_update_quickbooks_integration_record!(integration:, parsed_body:)
          elsif error_code == "5010" # Stale Object Error
            parsed_body = fetch_quickbooks_entity(entity: object.quickbooks_entity, integration_external_id: object.integration_external_id)

            # Update out of sync token and re-schedule the data sync job
            object.quickbooks_integration_record.update!(sync_token: parsed_body["SyncToken"])
            QuickbooksDataSyncJob.perform_in(1.minute, company.id, object.class.name, object.id)
          end
        end
      end
    end

    # Create Quickbooks journal entry for supported entities
    if object.respond_to?(:quickbooks_journal_entry_payload) &&
      object.quickbooks_journal_entry_payload.present? &&
      object.quickbooks_journal_entry.nil?
      make_authenticated_request do
        url = base_api_url + "/journalentry?minorversion=#{MINOR_VERSION}"
        response = make_api_request(method: "POST", url:, body: object.quickbooks_journal_entry_payload, headers: api_request_header)
        if response.ok?
          object.create_or_update_quickbooks_integration_record!(
            integration:,
            parsed_body: response.parsed_response["JournalEntry"],
            is_journal_entry: true,
          )
        end
      end
    end
  end

  def fetch_quickbooks_entity(entity:, integration_external_id:)
    raise "Quickbooks integration does not exist" if integration.nil?

    make_authenticated_request do
      url = base_api_url + "/#{entity.downcase}/#{integration_external_id}"
      response = make_api_request(method: "GET", url:, headers: api_request_header)
      response.parsed_response.dig(entity)
    end
  end

  def fetch_vendor_by_email_and_name(email:, name:)
    raise "Quickbooks integration does not exist" if integration.nil?

    fetch_quickbooks_vendors.find { _1.dig("PrimaryEmailAddr", "Address") == email && _1["DisplayName"] == name }
  end

  def fetch_company_financials(date_filter: "last month", custom_month: nil)
    # see supported `date_macro` attribute values in the quickbooks API documentation
    # https://developer.intuit.com/app/developer/qbo/docs/api/accounting/most-commonly-used/profitandloss
    raise "Quickbooks integration does not exist" if integration.nil?
    uri = URI(base_api_url + "/reports/ProfitAndLoss")
    query_params = Array.new

    if custom_month
      query_params.push(["start_date", custom_month.beginning_of_month.strftime("%Y-%m-%d")])
      query_params.push(["end_date", custom_month.end_of_month.strftime("%Y-%m-%d")])
    else
      query_params.push(["date_macro", date_filter])
    end

    query_params.each do |element|
      params = URI.decode_www_form(uri.query || "") << element
      uri.query = URI.encode_www_form(params)
    end

    response = make_authenticated_request do
      make_api_request(method: "GET", url: uri.to_s, headers: api_request_header)
    end

    data = JSON.parse(response.body)
    summaries = data.dig("Rows", "Row").each_with_object({}) do |row, result|
      summary_data = row.dig("Summary", "ColData")
      summary_label = summary_data.dig(0, "value")
      if summary_label.in?(["Total Income", "Net Income"])
        result[summary_label] = summary_data.dig(1, "value").to_f.round(2)
      end
    end

    {
      revenue: summaries["Total Income"],
      net_income: summaries["Net Income"],
    }
  end

  private
    attr_reader :lock_manager

    def oauth_request_header
      header_value = "Basic " + Base64.strict_encode64("#{client_id}:#{client_secret}")

      {
        "Content-type" => "application/x-www-form-urlencoded",
        "Accept" => "application/json",
        "Authorization" => header_value,
      }
    end

    def api_request_header
      {
        "Content-type" => "application/json",
        "Accept" => "application/json",
        "Authorization" => "Bearer #{access_token}",
      }
    end

    def base_api_url
      "#{BASE_API_URL}/v3/company/#{account_id}"
    end

    def make_authenticated_request
      raise ArgumentError, "Must provide a block" unless block_given?

      attempts = 0

      begin
        get_new_refresh_token

        yield
      rescue OAuth2::Error => ex
        Rails.logger.info "QuickbooksOauth.perform: #{ex.message}"

        # to prevent an infinite loop here keep a counter and bail out after N times...
        attempts += 1

        if attempts >= 2
          integration.update!(sync_error: ex.message, status: Integration.statuses[:out_of_sync])
          Bugsnag.notify(ex)
          return
        end

        retry
      rescue => ex
        integration.update!(sync_error: ex.message)
        Bugsnag.notify(ex)
      end
    end

    def fetch_quickbooks_accounts(type:)
      raise ArgumentError, "Invalid account type" unless VALID_QUICKBOOKS_ACCOUNT_TYPES.include?(type)
      return [] unless company.reload.quickbooks_integration.present?
      self.integration = company.quickbooks_integration
      Rails.cache.fetch("quickbooks_#{type.downcase}_accounts_#{integration.id}", expires_in: 1.hour) do
        make_authenticated_request do
          query = "select * from Account where AccountType = '#{type}' and Active = true startposition 1 maxresults #{RECORDS_PER_PAGE}"
          url = base_api_url + "/query?query=#{query}&minorversion=#{MINOR_VERSION}"
          response = make_api_request(method: "GET", url:, headers: api_request_header)
          (response.parsed_response.dig("QueryResponse", "Account") || []).map do |account|
            {
              id: account["Id"],
              name: account["Name"],
            }
          end.sort_by { |account| account[:name] }
        end || []
      end
    end

    def fetch_quickbooks_vendors
      Rails.cache.fetch("quickbooks_vendor_accounts_#{integration.id}", expires_in: 1.hour) do
        all_vendors = []
        offset = 1
        loop do
          paginated_vendors = make_authenticated_request do
            query = "select * from Vendor startposition #{offset} maxresults #{RECORDS_PER_PAGE}"
            url = base_api_url + "/query?query=#{query}&minorversion=#{MINOR_VERSION}"
            response = make_api_request(method: "GET", url:, headers: api_request_header)
            response.parsed_response.dig("QueryResponse", "Vendor")
          end
          all_vendors += paginated_vendors if paginated_vendors.present?
          break if paginated_vendors.blank? || paginated_vendors.size < RECORDS_PER_PAGE
          offset += RECORDS_PER_PAGE
        end
        all_vendors
      end
    end

    def find_expense_account_amount_by_id(row:, id:)
      return row.dig("ColData", 1, "value").to_f if row.dig("ColData", 0, "id") === id

      Array.wrap(row.dig("Rows", "Row")).each do |sub_row|
        value = find_expense_account_amount_by_id(row: sub_row, id:)
        return value if value
      end

      find_expense_account_amount_by_id(row: row["Header"], id:) if row["Header"]
    end
end
