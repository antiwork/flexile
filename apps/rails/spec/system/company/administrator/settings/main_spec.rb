# frozen_string_literal: true

MINOR_VERSION = 75

require "shared_examples/internal/stripe_microdeposit_verification_examples"

RSpec.describe "Company Settings" do
  let(:company) { create(:company) }
  let(:admin_user) { create(:company_administrator, company:).user }

  it "allows updating the public company profile" do
    sign_in admin_user
    visit spa_company_administrator_settings_path(company.external_id)
    within_section "Customization", section_element: :form do
      expect(page).to have_field "Company name", with: company.name
      expect(page).to have_field "Company website", with: company.website
      expect(find_rich_text_editor("Company description")).to have_text company.description
      expect(page).to have_unchecked_field "Show Team by the numbers in job descriptions"
      expect(page).to have_field "Brand color", with: company.brand_color

      fill_in "Company name", with: "Public name!"
      fill_in "Company website", with: "not a website."
      fill_in_rich_text_editor "Company description", with: "Hi! I'm the *description*!"
      check "Show Team by the numbers in job descriptions"
      find_field("Brand color").set("#123456")
      attach_file "Upload...", file_fixture("image.png"), visible: false
      click_on "Save changes"

      expect(page).to have_field("Company website", valid: false)
      fill_in "Company website", with: "https://www.gumroad.com"
      expect(page).to have_field("Company website", valid: true)
      click_on "Save changes"
    end

    wait_for_ajax
    expect(company.reload.public_name).to eq "Public name!"
    expect(company.website).to eq "https://www.gumroad.com"
    expect(company.description).to eq "<p>Hi! I'm the <em>description</em>!</p>"
    expect(company.show_stats_in_job_descriptions).to eq true
    expect(company.brand_color).to eq "#123456"
    expect(company.logo_url).to end_with "image.png"
  end

  context "when quickbooks flag is enabled", :billy do
    let(:client_id) { GlobalConfig.get("QUICKBOOKS_CLIENT_ID") }
    let(:code) { "test_code" }
    let(:state) { Base64.strict_encode64("#{company.external_id}:#{company.name}") }
    let(:realmId) { "4620816365264855310" }
    let(:access_token) { "eyJlbmSAMPLELUhTMjU2IiwiYWxnIjoiZGlyIn0..cD5p6ZRjCEzDFHgVc5gFvg.WIWiPPspQR8zxEVxFEPTeekhTJQiF4m4dJVWUWzA6uoFMKC0WBcbs4dU14SOMZg8MpPjxpUVAJnXTZTesLNmeckrrev8Pc_DlsQx41vf5eARKF45kq7L8tpEC_ImCNbtKF4XhWTkj-d39lxj3vGEEolotiCDNG3ehNoB5EU07XEUdk_xSkROpS6rtN87UazqOgl7ci1dLMUyEtRaqH9X1Prk7ZuoTbg0Eg3UYO8qNnQa8ZhbOAbtcDyXynqU5QcWgS3kqWpWNKW8WtFfC4cNZBZTUhBwz2dgstbdU1ARU7agzeqSdGjSaNvV9iwKleiFd7MjZnqv2wTi2hw1qLq1IXX_-GEVnfJ0zUrARGcTIgcLSyhOahjTf93V3Ho0_nhoPEOOL3iJj0FUElqsDPPiul-UQytfZZw7OXAiVXU5U4v2EkDTQSA1asezZ_id6Pcq_JU-gtPpe5OGZWqWQevlL_ovzoLAcXSUgS1z3VPrPnWWkyz_PBEj5pr4sld2vCaCzSy79hAt7uYfh8-jOtg4IRJtSG4r8HffT400cKbdS69dMTZDTnuY-eLPIoY9QBt08jxYHazCQ16uClLG95SvG2rqPbNPpXUJTpUcu2y1EmANZ9rAOgQ8s14ucBnIbEY7FouhELdbXQIYTRo6nKk7A6wYPJm4GE6M6lC0TxX7Lk5qr3Ppomjo38OH5qUI3BwxCNBTOM2nuEeu_tGiIp8HaIqjlTco-iZDU0-uwSc3dh4glm1tcUcrI6Gc0GDRXJBN.dW5iJ-i2cndKLNEtxHqmyA" }
    let(:refresh_token) { "AB11681487965HhMaRJxsVdj6nNdv9VZPKaSqwC8VeCJ5DiAC1" }
    let(:authentication_token) { Base64.strict_encode64("#{client_id}:#{GlobalConfig.get("QUICKBOOKS_CLIENT_SECRET")}") }
    let!(:travel_expense_category) { create(:expense_category, company:, name: "Travel") }
    let!(:meals_expense_category) { create(:expense_category, company:, name: "Meals") }

    before { Flipper.enable(:quickbooks, company) }

    context "when no integration is set up" do
      before do
        proxy.stub("https://appcenter.intuit.com:443/connect/oauth2")
             .and_return(redirect_to: oauth_redirect_url(code:, state:, realmId:))
        WebMock.stub_request(:post, "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer")
               .with(body: {
                 grant_type: "authorization_code",
                 code:,
                 redirect_uri: oauth_redirect_url,
               })
               .to_return(
                 status: 200,
                 body: {
                   access_token:,
                   expires_in: 1.hour,
                   refresh_token:,
                   x_refresh_token_expires_in: 100.days,
                 }.to_json,
                 headers: { content_type: "application/json" }
               )

        query = CGI.escape "select * from Vendor where DisplayName = 'Flexile'"
        WebMock.stub_request(:get, "https://sandbox-quickbooks.api.intuit.com/v3/company/#{realmId}/query?query=#{query}&minorversion=#{MINOR_VERSION}")
               .to_return(
                 status: 200,
                 body: {
                   QueryResponse: {
                     Vendor: [{
                       BillAddr: { Id: "121", Line1: "548 Market St", City: "San Francisco", Country: "US", CountrySubDivisionCode: "CA", PostalCode: "94104-5401" },
                       TaxIdentifier: "XXXXX1423",
                       Balance: 0,
                       Vendor1099: false,
                       CurrencyRef: { value: "USD", name: "United States Dollar" },
                       domain: "QBO",
                       sparse: false,
                       Id: "83",
                       SyncToken: "0",
                       MetaData: { CreateTime: "2022-12-30T11:17:31-08:00", LastUpdatedTime: "2022-12-30T11:17:31-08:00" },
                       CompanyName: "Gumroad Inc.",
                       DisplayName: "Flexile",
                       PrintOnCheckName: "Gumroad Inc.",
                       Active: true,
                       V4IDPseudonym: "002098b07f0aad901840a38a0d084d6a3d86b3",
                       PrimaryEmailAddr: { Address: "hi@flexile.com" },
                       WebAddr: { URI: "https://flexile.com" },
                     }],
                     startPosition: 1,
                     maxResults: 1,
                   },
                   time: "2023-01-10T12:22:42.229-08:00",
                 }.to_json,
                 headers: { content_type: "application/json" }
               )

        query = CGI.escape "select * from Account where AccountType = 'Expense' and Active = true startposition 1 maxresults 1000"
        WebMock.stub_request(:get, "https://sandbox-quickbooks.api.intuit.com/v3/company/#{realmId}/query?query=#{query}&minorversion=#{MINOR_VERSION}")
               .to_return(
                 status: 200,
                 body: {
                   QueryResponse: {
                     Account: [
                       { "Id" => "2", "Name" => "Consulting Services" },
                       { "Id" => "3", "Name" => "Fees & Subscriptions" },
                       { "Id" => "4", "Name" => "Travel" },
                       { "Id" => "5", "Name" => "Travel Meals" },
                     ],
                     startPosition: 1,
                     maxResults: 1000,
                   },
                   time: "2023-01-10T12:22:42.229-08:00",
                 }.to_json,
                 headers: { content_type: "application/json" }
               )

        query = CGI.escape "select * from Account where AccountType = 'Bank' and Active = true startposition 1 maxresults 1000"
        WebMock.stub_request(:get, "https://sandbox-quickbooks.api.intuit.com/v3/company/#{realmId}/query?query=#{query}&minorversion=#{MINOR_VERSION}")
               .to_return(
                 status: 200,
                 body: {
                   QueryResponse: {
                     Account: [
                       { "Id" => "1", "Name" => "Checking" },
                       { "Id" => "2", "Name" => "Savings" },
                     ],
                     startPosition: 1,
                     maxResults: 1000,
                   },
                   time: "2023-01-10T12:22:42.229-08:00",
                 }.to_json,
                 headers: { content_type: "application/json" }
               )

        query = CGI.escape "select * from Account where AccountType = 'Bank' and Name = 'Flexile.com Money Out Clearing' and Active = true"
        WebMock.stub_request(:get, "https://sandbox-quickbooks.api.intuit.com/v3/company/#{realmId}/query?query=#{query}&minorversion=#{MINOR_VERSION}")
               .to_return(
                 status: 200,
                 body: {
                   QueryResponse: { Account: [{ "Id" => "94", "Name" => "Flexile.com Money Out Clearing" }] },
                   time: "2023-01-10T12:22:42.229-08:00",
                 }.to_json,
                 headers: { content_type: "application/json" }
               )

        sign_in admin_user

        visit spa_company_administrator_settings_path(company.external_id)
      end

      it "allows connecting and disconnecting QuickBooks" do
        expect(page).to have_text("Company account")
        expect(page).to have_selector("h2", text: "QuickBooks")
        expect(page).to have_button("Connect")

        click_on "Connect"
        wait_for_ajax
        click_on "Close"

        integration = QuickbooksIntegration.last
        expect(integration.status).to eq(QuickbooksIntegration.statuses[:initialized])
        expect(QuickbooksIntegrationSyncScheduleJob.jobs.size).to eq(0)

        wait_for_ajax
        expect(page).to have_text("Set up required")
        expect(page).to have_button("Disconnect")
        expect(page).to have_button("Finish setup")

        WebMock.stub_request(:post, "https://developer.api.intuit.com/v2/oauth2/tokens/revoke")
               .with(
                 {
                   body: "token=#{refresh_token}",
                   headers: {
                     "Content-type" => "application/x-www-form-urlencoded",
                     "Accept" => "application/json",
                     "Authorization" => "Basic #{authentication_token}",
                   },
                 }
               )
               .to_return(status: 200, body: "", headers: { content_type: "application/json" })

        click_on "Disconnect"
        wait_for_ajax
        expect(page).to_not have_text("Set up required")
        expect(page).to have_button("Connect")

        expect(integration.reload.status).to eq(QuickbooksIntegration.statuses[:deleted])
      end

      it "allows setting up a QuickBooks integration" do
        expect(page).to have_text("Company account")
        expect(page).to have_selector("h2", text: "QuickBooks")
        expect(page).to have_button("Connect")

        click_on "Connect"
        wait_for_ajax
        expect(page).to have_button("Disconnect")
        expect(page).to have_button("Finish setup")

        integration = QuickbooksIntegration.last
        expect(integration.status).to eq(QuickbooksIntegration.statuses[:initialized])
        expect(integration.consulting_services_expense_account_id).to be_nil
        expect(integration.flexile_fees_expense_account_id).to be_nil
        expect(integration.default_bank_account_id).to be_nil
        expect(QuickbooksIntegrationSyncScheduleJob.jobs.size).to eq(0)

        select "Consulting Services", from: "Expense account for consulting services"
        select "Fees & Subscriptions", from: "Expense account for Flexile fees"
        click_on "Continue"

        # Don't allow to continue without selecting all expense accounts
        expect(page).to have_field("Expense account for Travel expenses", valid: false)
        expect(page).to have_field("Expense account for Meals expenses", valid: false)

        select "Travel", from: "Expense account for Travel expenses"
        select "Travel Meals", from: "Expense account for Meals expenses"
        click_on "Continue"
        select "Checking", from: "Bank account"
        click_on "Save"
        wait_for_ajax
        expect(page).to have_text("Connected")
        expect(page).to have_button("Disconnect")
        expect(page).to_not have_button("Finish setup")

        expect(integration.reload.status).to eq(QuickbooksIntegration.statuses[:initialized])
        expect(integration.consulting_services_expense_account_id).to eq("2")
        expect(integration.flexile_fees_expense_account_id).to eq("3")
        expect(integration.default_bank_account_id).to eq("1")
        expect(travel_expense_category.reload.expense_account_id).to eq("4")
        expect(meals_expense_category.reload.expense_account_id).to eq("5")
        expect(QuickbooksIntegrationSyncScheduleJob).to have_enqueued_sidekiq_job(company.id)
      end

      context "when equity compensation flag is enabled" do
        it "allows setting an expense account for equity compensation" do
          click_on "Connect"
          wait_for_ajax
          expect(page).to_not have_text("Expense account for equity compensation")

          company.update!(equity_compensation_enabled: true)
          visit spa_company_administrator_settings_path(company.external_id)
          click_on "Connect"
          wait_for_ajax
          expect(page).to have_text("Expense account for equity compensation")
        end
      end
    end

    context "when integration is already set up" do
      let!(:integration) { create(:quickbooks_integration, company:) }

      before do
        integration.update!(status: Integration.statuses[:out_of_sync],
                            consulting_services_expense_account_id: "2",
                            flexile_fees_expense_account_id: "3",
                            default_bank_account_id: "1")
      end

      it "allows reconnecting when QuickBooks is out of sync" do
        sign_in admin_user

        visit spa_company_administrator_settings_path(company.external_id)

        expect(page).to have_text("Company account")
        expect(page).to have_selector("h2", text: "QuickBooks")
        expect(page).to have_text("Needs reconnecting")
        expect(page).to have_button("Connect")

        proxy.stub("https://appcenter.intuit.com:443/connect/oauth2")
             .and_return(redirect_to: oauth_redirect_url(code:, state:, realmId:))
        WebMock.stub_request(:post, "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer")
               .with(body: {
                 grant_type: "authorization_code",
                 code:,
                 redirect_uri: oauth_redirect_url,
               })
               .to_return(
                 status: 200,
                 body: {
                   access_token:,
                   expires_in: 1.hour,
                   refresh_token:,
                   x_refresh_token_expires_in: 100.days,
                 }.to_json,
                 headers: { content_type: "application/json" }
               )

        query = CGI.escape "select * from Vendor where DisplayName = 'Flexile'"
        WebMock.stub_request(:get, "https://sandbox-quickbooks.api.intuit.com/v3/company/#{realmId}/query?query=#{query}&minorversion=#{MINOR_VERSION}")
               .to_return(
                 status: 200,
                 body: {
                   QueryResponse: {
                     Vendor: [{
                       BillAddr: { Id: "121", Line1: "548 Market St", City: "San Francisco", Country: "US", CountrySubDivisionCode: "CA", PostalCode: "94104-5401" },
                       TaxIdentifier: "XXXXX1423",
                       Balance: 0,
                       Vendor1099: false,
                       CurrencyRef: { value: "USD", name: "United States Dollar" },
                       domain: "QBO",
                       sparse: false,
                       Id: "83",
                       SyncToken: "0",
                       MetaData: { CreateTime: "2022-12-30T11:17:31-08:00", LastUpdatedTime: "2022-12-30T11:17:31-08:00" },
                       CompanyName: "Gumroad Inc.",
                       DisplayName: "Flexile",
                       PrintOnCheckName: "Gumroad Inc.",
                       Active: true,
                       V4IDPseudonym: "002098b07f0aad901840a38a0d084d6a3d86b3",
                       PrimaryEmailAddr: { Address: "hi@flexile.com" },
                       WebAddr: { URI: "https://flexile.com" },
                     }],
                     startPosition: 1,
                     maxResults: 1,
                   },
                   time: "2023-01-10T12:22:42.229-08:00",
                 }.to_json,
                 headers: { content_type: "application/json" }
               )

        query = CGI.escape "select * from Account where AccountType = 'Expense' and Active = true startposition 1 maxresults 1000"
        WebMock.stub_request(:get, "https://sandbox-quickbooks.api.intuit.com/v3/company/#{realmId}/query?query=#{query}&minorversion=#{MINOR_VERSION}")
               .to_return(
                 status: 200,
                 body: {
                   QueryResponse: {
                     Account: [
                       { "Id" => "1", "Name" => "R&D Services" },
                       { "Id" => "2", "Name" => "Non-R&D Services" },
                       { "Id" => "3", "Name" => "Fees & Subscriptions" },
                       { "Id" => "4", "Name" => "Travel" },
                       { "Id" => "5", "Name" => "Travel Meals" },
                     ],
                     startPosition: 1,
                     maxResults: 1000,
                   },
                   time: "2023-01-10T12:22:42.229-08:00",
                 }.to_json,
                 headers: { content_type: "application/json" }
               )

        query = CGI.escape "select * from Account where AccountType = 'Bank' and Active = true startposition 1 maxresults 1000"
        WebMock.stub_request(:get, "https://sandbox-quickbooks.api.intuit.com/v3/company/#{realmId}/query?query=#{query}&minorversion=#{MINOR_VERSION}")
               .to_return(
                 status: 200,
                 body: {
                   QueryResponse: {
                     Account: [
                       { "Id" => "1", "Name" => "Checking" },
                       { "Id" => "2", "Name" => "Savings" },
                     ],
                     startPosition: 1,
                     maxResults: 1000,
                   },
                   time: "2023-01-10T12:22:42.229-08:00",
                 }.to_json,
                 headers: { content_type: "application/json" }
               )

        query = CGI.escape "select * from Account where AccountType = 'Bank' and Name = 'Flexile.com Money Out Clearing' and Active = true"
        WebMock.stub_request(:get, "https://sandbox-quickbooks.api.intuit.com/v3/company/#{realmId}/query?query=#{query}&minorversion=#{MINOR_VERSION}")
               .to_return(
                 status: 200,
                 body: {
                   QueryResponse: { Account: [{ "Id" => "94", "Name" => "Flexile.com Money Out Clearing" }] },
                   time: "2023-01-10T12:22:42.229-08:00",
                 }.to_json,
                 headers: { content_type: "application/json" }
               )

        click_on "Connect"
        wait_for_ajax
        expect(page).to_not have_text("Set up required")
        expect(page).to_not have_text("Needs reconnecting")
        expect(page).to_not have_button("Finish setup")
        expect(page).to have_button("Disconnect")

        expect(integration.reload.status).to eq(QuickbooksIntegration.statuses[:active])
        expect(integration.consulting_services_expense_account_id).to eq("2")
        expect(integration.flexile_fees_expense_account_id).to eq("3")
        expect(integration.default_bank_account_id).to eq("1")
        expect(QuickbooksIntegrationSyncScheduleJob.jobs.size).to eq(0)
      end
    end
  end

  describe "microdeposit verification" do
    let(:arrival_date) { "May 13, 2024" } # see VCR cassette for date

    include_examples "verifying Stripe microdeposits" do
      let(:path) { spa_company_administrator_settings_path(company.external_id) }
    end
  end
end
