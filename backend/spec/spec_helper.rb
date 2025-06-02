# frozen_string_literal: true

ENV["RAILS_ENV"] ||= "test"
require_relative "../config/environment"

require "rspec/rails"
require "sidekiq/testing"
require "faker"
require "pundit/rspec"

Dir[Rails.root.join("spec", "support", "**", "*.rb")].sort.each { |f| require f }

BUILDING_ON_CI = !ENV["CI"].nil?

KnapsackPro::Adapters::RSpecAdapter.bind

SuperDiff.configure { |config| config.actual_color = :green }

# Checks for pending migrations and applies them before tests are run.
# If you are not using ActiveRecord, you can remove these lines.
begin
  ActiveRecord::Migration.maintain_test_schema!
rescue ActiveRecord::PendingMigrationError => e
  puts e.to_s.strip
  exit 1
end

def configure_vcr
  VCR.configure do |config|
    config.cassette_library_dir = Rails.root.join("spec", "fixtures", "vcr_cassettes").to_s
    config.hook_into :webmock
    config.ignore_localhost = true
    config.ignore_hosts "chromedriver.storage.googleapis.com"
    config.ignore_hosts "api.knapsackpro.com"
    config.configure_rspec_metadata!
    config.debug_logger = $stdout if ENV["VCR_DEBUG"]
    config.default_cassette_options[:record] = BUILDING_ON_CI ? :none : :once
    config.register_request_matcher :wise_account_requirements do |request1, request2|
      path = /v1\/account-requirements/
      if request1.uri.match?(path) && request2.uri.match?(path)
        request1.body == request2.body
      else
        true
      end
    end
    config.default_cassette_options[:match_requests_on] = %i[method uri wise_account_requirements]
    config.filter_sensitive_data("<GUMROAD_BANK_ROUTING_NUMBER>") { GlobalConfig.dig("wise_gumroad_account", "abartn") }
    config.filter_sensitive_data("<GUMROAD_BANK_ACCOUNT_NUMBER>") { GlobalConfig.dig("wise_gumroad_account", "account_number") }
    config.filter_sensitive_data("<QUICKBOOKS_BASIC_AUTH_STRING>") { Base64.strict_encode64("#{GlobalConfig.get('QUICKBOOKS_CLIENT_ID')}:#{GlobalConfig.get('QUICKBOOKS_CLIENT_SECRET')}") }
    config.filter_sensitive_data("<WISE_PROFILE_ID>") { GlobalConfig.get("WISE_PROFILE_ID") }
  end
end

configure_vcr

WebMock.disable_net_connect!(net_http_connect_on_start: true, allow: ["api.knapsackpro.com"])

RSpec.configure do |config|
  config.expect_with :rspec do |expectations|
    expectations.include_chain_clauses_in_custom_matcher_descriptions = true
    expectations.syntax = :expect
  end

  config.mock_with :rspec do |mocks|
    mocks.verify_partial_doubles = true
  end

  config.shared_context_metadata_behavior = :apply_to_host_groups
  config.filter_run_when_matching :focus
  config.disable_monkey_patching!

  if config.files_to_run.one?
    # Use the documentation formatter for detailed output,
    # unless a formatter has already been configured
    # (e.g. via a command-line flag).
    config.default_formatter = "doc"
  end
  config.order = :random
  Kernel.srand config.seed
  config.include Devise::Test::ControllerHelpers, type: :controller
  config.use_transactional_fixtures = true
  config.infer_spec_type_from_file_location!
  config.filter_rails_from_backtrace!
  config.include Devise::Test::IntegrationHelpers, type: :system
  config.include ActiveSupport::Testing::TimeHelpers

  config.before(:each) do
    $redis.flushdb
    @request.env["devise.mapping"] = Devise.mappings[:user] if @request
  end

  browser = BUILDING_ON_CI ? :headless_chrome : :chrome
  config.before(:each, type: :system) do |example|
    driven_by(:selenium, using: browser) do |driver_options|
      driver_options.add_preference("intl.accept_languages", "es") if example.metadata[:lang_es].present?
      driver_options.args << "--disable-search-engine-choice-screen" unless BUILDING_ON_CI
    end

    Rails.application.routes.default_url_options[:host] = "#{PROTOCOL}://#{DOMAIN}"
  end

  if BUILDING_ON_CI
    # show retry status in spec process
    config.verbose_retry = true
    # show exception that triggers a retry if verbose_retry is set to true
    config.display_try_failure_messages = true
    config.default_retry_count = 3
  end

  config.around(:each, :freeze_time) do |example|
    freeze_time { example.run }
  end

  config.around(:each) do |example|
    if example.metadata[:sidekiq_inline]
      Sidekiq::Testing.inline!
    else
      Sidekiq::Testing.fake!
    end
    example.run
  end

  config.around(:each, :allow_stripe_requests) do |example|
    VCR.configure do |c|
      c.ignore_hosts("api.stripe.com")
    end

    example.run

    VCR.configure do |c|
      c.unignore_hosts("api.stripe.com")
    end
  end

  config.before(:each, :skip_pdf_generation) do |_|
    allow_any_instance_of(CreatePdf).to receive(:perform).and_return("pdf")
  end

  config.before(:each, type: :system) do
    if page.driver.browser.respond_to?(:execute_cdp)
      page.driver.browser.execute_cdp("Emulation.setTimezoneOverride", timezoneId: "GMT")
      page.driver.browser.execute_cdp("Emulation.setLocaleOverride", locale: "en-US")
    end
  end
end

RSpec::Sidekiq.configure do |config|
  config.warn_when_jobs_not_processed_by_sidekiq = false
end

def sanitize_mail(body)
  ActionView::Base.full_sanitizer.sanitize(body.encoded).gsub("\r\n", " ").gsub(/\s{2,}/, " ")
end
