# frozen_string_literal: true

MINOR_VERSION = 75

RSpec.describe IntegrationApi::Quickbooks, :vcr do
  let(:company) { create(:company) }
  let(:contractor) { create(:company_worker, company:) }
  let(:client_id) { GlobalConfig.get("QUICKBOOKS_CLIENT_ID") }
  let(:client_secret) { GlobalConfig.get("QUICKBOOKS_CLIENT_SECRET") }
  let(:state) { Base64.strict_encode64("#{company.external_id}:#{company.name}") }

  subject(:client) { described_class.new(company_id: company.id) }

  describe "delegations" do
    it { is_expected.to delegate_method(:expires_at).to(:integration).allow_nil }
    it { is_expected.to delegate_method(:refresh_token).to(:integration).allow_nil }
  end

  describe "#initialize" do
    it "fails initialization if the company is not found" do
      expect do
        described_class.new(company_id: "abc")
      end.to raise_error(ActiveRecord::RecordNotFound)
    end

    it "sets attributes for a valid company" do
      expect(client.send(:company)).to eq(company)
      expect(client.integration).to eq(nil)
      expect(client.send(:client_id)).to eq(client_id)
      expect(client.send(:client_secret)).to eq(client_secret)
      expect(client.send(:state)).to eq(state)
      expect(client.send(:lock_manager)).to be_a(LockManager)
      expect(client.integration).to eq(nil)
    end

    context "when an integration is present" do
      let!(:quickbooks_integration) { create(:quickbooks_integration, company:) }

      it "sets attributes for a valid company" do
        expect(client.send(:company)).to eq(company)
        expect(client.integration).to eq(quickbooks_integration)
        expect(client.send(:client_id)).to eq(client_id)
        expect(client.send(:client_secret)).to eq(client_secret)
        expect(client.send(:state)).to eq(state)
        expect(client.send(:lock_manager)).to be_a(LockManager)
        expect(client.integration).to eq(quickbooks_integration)
        expect(client.send(:account_id)).to eq(quickbooks_integration.account_id)
        expect(client.send(:access_token)).to eq(quickbooks_integration.access_token)
      end
    end
  end

  describe "#oauth_location" do
    it "returns the OAuth connect URL" do
      expect(client.oauth_location).to eq(
        URI(
          "https://appcenter.intuit.com/connect/oauth2?" \
          "client_id=#{client_id}&" \
          "scope=com.intuit.quickbooks.accounting&" \
          "redirect_uri=#{CGI.escape(Rails.application.routes.url_helpers.oauth_redirect_url)}&" \
          "state=#{CGI.escape(state)}&response_type=code"
        )
      )
    end
  end

  describe "#get_oauth_token" do
    it "returns the OAuth access token" do
      response = client.get_oauth_token("AB11673029554tszbgk21CFKjumYiqOmFTZ76kmvw6sXXyZLPH")

      expect(response.ok?).to eq(true)
      expect(response.parsed_response["access_token"]).to be_present
      expect(response.parsed_response["expires_in"]).to eq(3600)
      expect(response.parsed_response["refresh_token"]).to be_present
    end
  end

  describe "#get_new_refresh_token" do
    let!(:quickbooks_integration) { create(:quickbooks_integration, company:) }

    context "when access token is not expired" do
      before do
        quickbooks_integration.update!(expires_at: 1.hour.from_now.iso8601)
      end

      it "does not update the integration OAuth tokens" do
        expect(client.send(:lock_manager)).to receive(:lock!).with(quickbooks_integration.cache_key).and_call_original
        expect do
          client.get_new_refresh_token
        end.to_not change { quickbooks_integration.reload.access_token }
      end
    end

    context "when access token is expired" do
      before do
        quickbooks_integration.update!(expires_at: 1.hour.ago.iso8601)
      end

      context "when response is successful" do
        it "updates the integration OAuth tokens" do
          expect(client.send(:lock_manager)).to receive(:lock!).with(quickbooks_integration.cache_key).and_call_original
          expect do
            client.get_new_refresh_token
          end.to change { quickbooks_integration.reload.access_token }
             .and change { quickbooks_integration.expires_at }
        end
      end

      context "when response is unauthorized" do
        let(:json_body) { { error_description: "Invalid authorization code", error: "invalid_grant" }.to_json }

        before do
          WebMock.stub_request(:post, "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer")
                 .with(body:
                         {
                           grant_type: "refresh_token",
                           refresh_token: quickbooks_integration.refresh_token,
                         })
                 .to_return(
                   status: 401,
                   body: json_body,
                   headers: { content_type: "application/json" }
                 )
        end

        it "does not update the integration OAuth access token" do
          expect(client.send(:lock_manager)).to receive(:lock!).with(quickbooks_integration.cache_key).and_call_original
          expect do
            client.get_new_refresh_token rescue nil
          end.to_not change { quickbooks_integration.reload.access_token }
        end

        it "logs an error message" do
          expect(Rails.logger).to receive(:error).with("IntegrationApi::Quickbooks.response: #{JSON.parse(json_body)}")
          client.get_new_refresh_token rescue nil
        end

        it "raises an OAuth2::Error" do
          expect do
            client.get_new_refresh_token
          end.to raise_error(OAuth2::Error)
        end
      end
    end
  end

  describe "#revoke_token" do
    let!(:quickbooks_integration) { create(:quickbooks_integration, company:) }

    it "revokes the integration refresh token" do
      stub = WebMock.stub_request(:post, "https://developer.api.intuit.com/v2/oauth2/tokens/revoke")
                    .with(
                      {
                        body: "token=#{quickbooks_integration.refresh_token }",
                        headers: {
                          "Content-type" => "application/x-www-form-urlencoded",
                          "Accept" => "application/json",
                          "Authorization" => "Basic #{Base64.strict_encode64("#{client_id}:#{client_secret}")}",
                        },
                      }
                    )
                    .to_return(status: 200, body: "", headers: { content_type: "application/json" })

      response = client.revoke_token

      expect(response.ok?).to eq(true)
      assert_requested(stub)
    end
  end

  describe "#get_flexile_vendor_id" do
    let!(:quickbooks_integration) { create(:quickbooks_integration, company:) }

    context "when Flexile vendor exists in QuickBooks" do
      it "only fetches the vendor and returns it" do
        stub = WebMock.stub_request(:post, "#{client.send(:base_api_url)}/vendor?minorversion=#{MINOR_VERSION}")
                      .with(
                        {
                          body: {
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
                          }.to_json,
                        }
                      )

        expect(client.get_flexile_vendor_id).to eq("83")
        assert_not_requested(stub)
      end
    end

    context "when Flexile vendor account does not exist in QuickBooks" do
      it "creates the vendor and returns it" do
        query = CGI.escape "select * from Vendor where DisplayName = 'Flexile'"
        stub_1 = WebMock.stub_request(:get, "#{client.send(:base_api_url)}/query?query=#{query}&minorversion=#{MINOR_VERSION}")
                        .to_return(
                          status: 200,
                          body: { QueryResponse: {} }.to_json,
                          headers: { content_type: "application/json" }
                        )
        stub_2 = WebMock.stub_request(:post, "#{client.send(:base_api_url)}/vendor?minorversion=#{MINOR_VERSION}")
                        .with(
                          {
                            body: {
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
                            }.to_json,
                          }
                        )
                        .to_return(
                          status: 200,
                          body: { Vendor: { Id: "83" } }.to_json,
                          headers: { content_type: "application/json" }
                        )

        expect(client.get_flexile_vendor_id).to eq("83")
        assert_requested(stub_1)
        assert_requested(stub_2)
      end
    end
  end

  describe "#get_flexile_clearance_bank_account_id" do
    let!(:quickbooks_integration) { create(:quickbooks_integration, company:) }

    context "when Flexile clearance bank account exists in QuickBooks" do
      it "only fetches the bank account and returns it" do
        stub = WebMock.stub_request(:post, "#{client.send(:base_api_url)}/account?minorversion=#{MINOR_VERSION}")
                      .with({ body: { "Name": "Flexile.com Money Out Clearing", "AccountType": "Bank" }.to_json })

        expect(client.get_flexile_clearance_bank_account_id).to eq("94")
        assert_not_requested(stub)
      end
    end

    context "when Flexile clearance bank account does not exist in QuickBooks" do
      it "creates the bank account and returns it" do
        query = CGI.escape "select * from Account where AccountType = 'Bank' and Name = 'Flexile.com Money Out Clearing' and Active = true"
        stub_1 = WebMock.stub_request(:get, "#{client.send(:base_api_url)}/query?query=#{query}&minorversion=#{MINOR_VERSION}")
                        .to_return(
                          status: 200,
                          body: { QueryResponse: {} }.to_json,
                          headers: { content_type: "application/json" }
                        )
        stub_2 = WebMock.stub_request(:post, "#{client.send(:base_api_url)}/account?minorversion=#{MINOR_VERSION}")
                        .with({ body: { "Name": "Flexile.com Money Out Clearing", "AccountType": "Bank" }.to_json })
                        .to_return(
                          status: 200,
                          body: { Account: { Id: "100" } }.to_json,
                          headers: { content_type: "application/json" }
                        )

        expect(client.get_flexile_clearance_bank_account_id).to eq("100")
        assert_requested(stub_1)
        assert_requested(stub_2)
      end
    end
  end

  describe "#get_accounts_payable" do
    let!(:quickbooks_integration) { create(:quickbooks_integration, company:) }

    it "fetches the accounts payable and returns them" do
      query = CGI.escape "select * from Account where AccountType = 'Accounts Payable' and Active = true startposition 1 maxresults 1000"
      stub = WebMock.stub_request(:get, "#{client.send(:base_api_url)}/query?query=#{query}&minorversion=#{MINOR_VERSION}")
                    .to_return(
                      status: 200,
                      body: {
                        QueryResponse: {
                          Account: [
                            {
                              Id: "33",
                              Name: "Accounts Payable (A/P)",
                              AccountType: "Accounts Payable",
                              AccountSubType: "Accounts Payable",
                              Active: true,
                              Classification: "Liability",
                              AccountAlias: "A/P",
                              MetaData: {
                                CreateTime: "2019-10-01T12:00:00-07:00",
                                LastUpdatedTime: "2019-10-01T12:00:00-07:00",
                              },
                            }
                          ],
                        },
                      }.to_json,
                      headers: { content_type: "application/json" }
                    )

      expect(client.get_accounts_payable_accounts).to match_array([{ id: "33", name: "Accounts Payable (A/P)" }])
      assert_requested(stub)
    end
  end

  describe "#sync_data_for" do
    context "when integration does not exist" do
      it "does not make any requests and returns nil" do
        expect_any_instance_of(IntegrationApi::Quickbooks).to_not receive(:make_authenticated_request)
        expect_any_instance_of(LockManager).to_not receive(:lock!)
        expect(client.sync_data_for(object: contractor)).to eq(nil)
      end
    end

    context "when integration exists" do
      let!(:quickbooks_integration) { create(:quickbooks_integration, company:) }

      context "and is out of sync" do
        before do
          quickbooks_integration.update!(status: Integration.statuses[:out_of_sync], sync_error: "error")
        end

        it "does not make any requests and returns nil" do
          expect_any_instance_of(IntegrationApi::Quickbooks).to_not receive(:make_authenticated_request)
          expect_any_instance_of(LockManager).to_not receive(:lock!)
          expect(client.sync_data_for(object: contractor)).to eq(nil)
        end
      end

      context "when object is a contractor" do
        it "syncs data back to Quickbooks" do
          expect(client.send(:lock_manager)).to receive(:lock!).with(quickbooks_integration.cache_key).and_call_original
          expect(client.send(:lock_manager)).to receive(:lock!).with(contractor.cache_key).and_call_original

          expect do
            client.sync_data_for(object: contractor)
          end.to change { quickbooks_integration.reload.last_sync_at }
             .and change { IntegrationRecord.count }.by(1)

          integration_record = IntegrationRecord.last
          expect(integration_record.sync_token).to eq("0")
          expect(integration_record.integration_external_id).to be_present
          expect(integration_record.integratable_type).to eq("CompanyWorker")
          expect(integration_record.integratable_id).to eq(contractor.id)
        end

        context "when contractor already exists in Quickbooks" do
          let(:contractor) { create(:company_worker, company:, user: create(:user, email: "caro@example.com", legal_name: "Caro Example")) }

          it "does not sync data back and creates an integration record" do
            expect do
              client.sync_data_for(object: contractor)
            end.to change { quickbooks_integration.reload.last_sync_at }
               .and change { IntegrationRecord.count }.by(1)

            integration_record = IntegrationRecord.last
            expect(integration_record.sync_token).to eq("17")
            expect(integration_record.integration_external_id).to eq("85")
            expect(integration_record.integratable_type).to eq("CompanyWorker")
            expect(integration_record.integratable_id).to eq(contractor.id)
          end
        end

        context "when an invalid grant error is returned" do
          let(:json_body) { { error_description: "Invalid authorization code", error: "invalid_grant" }.to_json }

          before do
            quickbooks_integration.update!(
              expires_at: 1.hour.ago.iso8601,
              refresh_token_expires_at: 1.hour.ago.iso8601,
            )
          end

          it "does not sync data back and disables the integration" do
            stub = WebMock.stub_request(:post, "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer")
                          .with(body:
                                  {
                                    grant_type: "refresh_token",
                                    refresh_token: quickbooks_integration.refresh_token,
                                  })
                          .to_return(
                            status: 401,
                            body: json_body,
                            headers: { content_type: "application/json" }
                          )
            expect(client.send(:lock_manager)).to receive(:lock!).with(quickbooks_integration.cache_key).twice.and_call_original
            expect(client.send(:lock_manager)).to_not receive(:lock!).with(contractor.cache_key)
            expect do
              client.sync_data_for(object: contractor)
            end.to change { quickbooks_integration.reload.status }.to(Integration.statuses[:out_of_sync])
               .and change { IntegrationRecord.count }.by(0)
            assert_requested(stub, times: 4)
          end
        end
      end

      context "when object is an invoice" do
        let!(:contractor_integration_record) { create(:integration_record, integration: quickbooks_integration, integratable: contractor, integration_external_id: "85") }
        let(:invoice) { create(:invoice, company:, user: contractor.user, invoice_date: "2023-06-30") }

        it "syncs data back to Quickbooks" do
          expect(client.send(:lock_manager)).to receive(:lock!).with(quickbooks_integration.cache_key).and_call_original
          expect(client.send(:lock_manager)).to receive(:lock!).with(invoice.cache_key).and_call_original
          expect do
            client.sync_data_for(object: invoice)
          end.to change { quickbooks_integration.reload.last_sync_at }
             .and change { IntegrationRecord.count }.by(2)

          expect(invoice.reload.sync_token).to eq("0")
          expect(invoice.integration_external_id).to be_present
          invoice_line_item = invoice.invoice_line_items.last
          expect(invoice_line_item.sync_token).to be_nil
          expect(invoice_line_item.integration_external_id).to be_present
        end

        context "when invoice includes expenses" do
          let!(:invoice_expense) { create(:invoice_expense, description: "Air Canada ticket", invoice:) }

          it "syncs data back to Quickbooks" do
            expect(client.send(:lock_manager)).to receive(:lock!).with(quickbooks_integration.cache_key).and_call_original
            expect(client.send(:lock_manager)).to receive(:lock!).with(invoice.cache_key).and_call_original
            expect do
              client.sync_data_for(object: invoice)
            end.to change { quickbooks_integration.reload.last_sync_at }
               .and change { IntegrationRecord.count }.by(3)

            expect(invoice.reload.sync_token).to eq("0")
            expect(invoice.integration_external_id).to be_present
            invoice_line_item = invoice.invoice_line_items.last
            expect(invoice_line_item.sync_token).to be_nil
            expect(invoice_line_item.integration_external_id).to be_present
            expect(invoice_expense.reload.sync_token).to be_nil
            expect(invoice_expense.integration_external_id).to be_present
          end
        end
      end

      context "when object is a payment" do
        let(:contractor) { create(:company_worker, company:) }
        let!(:contractor_integration_record) { create(:integration_record, integration: quickbooks_integration, integratable: contractor, integration_external_id: "85") }
        let(:invoice) { create(:invoice, company:, user: contractor.user) }
        let!(:invoice_integration_record) { create(:integration_record, integratable: invoice, integration: quickbooks_integration, integration_external_id: "164") }
        let(:payment) { create(:payment, invoice:) }

        it "syncs data back to Quickbooks" do
          expect(client.send(:lock_manager)).to receive(:lock!).with(quickbooks_integration.cache_key).and_call_original
          expect(client.send(:lock_manager)).to receive(:lock!).with(payment.cache_key).and_call_original
          expect do
            client.sync_data_for(object: payment)
          end.to change { quickbooks_integration.reload.last_sync_at }
             .and change { IntegrationRecord.count }.by(1)

          integration_record = IntegrationRecord.last
          expect(integration_record.sync_token).to eq("0")
          expect(integration_record.integration_external_id).to be_present
          expect(integration_record.integratable_id).to eq(payment.id)
        end
      end

      context "when object is a consolidated invoice" do
        let(:consolidated_invoice) { create(:consolidated_invoice, company:, invoice_date: "2023-06-30") }

        it "syncs data back to Quickbooks" do
          expect(client.send(:lock_manager)).to receive(:lock!).with(quickbooks_integration.cache_key).twice.and_call_original
          expect(client.send(:lock_manager)).to receive(:lock!).with(consolidated_invoice.cache_key).and_call_original
          expect do
            client.sync_data_for(object: consolidated_invoice)
          end.to change { quickbooks_integration.reload.last_sync_at }
             .and change { IntegrationRecord.count }.by(2)

          integration_record = consolidated_invoice.reload.quickbooks_integration_record
          expect(integration_record.sync_token).to eq("0")
          expect(integration_record.integration_external_id).to be_present
          expect(integration_record.integratable_id).to eq(consolidated_invoice.id)

          expect(IntegrationRecord.quickbooks_journal_entry.where(integratable: consolidated_invoice).count).to eq(1)
          journal_entry = consolidated_invoice.quickbooks_journal_entry
          expect(journal_entry.sync_token).to eq("0")
          expect(journal_entry.integration_external_id).to eq("245")
        end

        context "when an alive journal entry already exists in Quickbooks" do
          let!(:journal_entry) do
            create(:integration_record, :quickbooks_journal_entry, integratable: consolidated_invoice)
          end

          it "does not sync a new journal entry" do
            expect(client.send(:lock_manager)).to receive(:lock!).with(quickbooks_integration.cache_key).and_call_original
            expect(client.send(:lock_manager)).to receive(:lock!).with(consolidated_invoice.cache_key).and_call_original
            expect do
              client.sync_data_for(object: consolidated_invoice)
            end.to change { quickbooks_integration.reload.last_sync_at }
               .and change { IntegrationRecord.count }.by(1)

            expect(consolidated_invoice.reload.sync_token).to eq("0")
            expect(consolidated_invoice.integration_external_id).to eq("206")
            expect(consolidated_invoice.quickbooks_integration_record.quickbooks_journal_entry).to eq(false)
            expect(consolidated_invoice.quickbooks_journal_entry.id).to eq(journal_entry.id)
          end
        end

        context "when a deleted journal entry already exists in Quickbooks" do
          let!(:deleted_journal_entry) do
            create(:integration_record, :quickbooks_journal_entry,
                   integratable: consolidated_invoice, deleted_at: Time.current)
          end

          it "syncs data back to Quickbooks and creates integration records" do
            expect(client.send(:lock_manager)).to receive(:lock!).with(quickbooks_integration.cache_key).twice.and_call_original
            expect(client.send(:lock_manager)).to receive(:lock!).with(consolidated_invoice.cache_key).and_call_original
            expect do
              client.sync_data_for(object: consolidated_invoice)
            end.to change { quickbooks_integration.reload.last_sync_at }
               .and change { IntegrationRecord.count }.by(2)

            integration_record = consolidated_invoice.reload.quickbooks_integration_record
            expect(integration_record.sync_token).to eq("0")
            expect(integration_record.integration_external_id).to be_present
            expect(integration_record.integratable_id).to eq(consolidated_invoice.id)

            journal_entries = IntegrationRecord.quickbooks_journal_entry.where(integratable: consolidated_invoice)
            expect(journal_entries.count).to eq(2)
            journal_entry = consolidated_invoice.quickbooks_journal_entry
            expect(journal_entry.id).to_not eq(deleted_journal_entry.id)
            expect(journal_entry.sync_token).to eq("0")
            expect(journal_entry.integration_external_id).to eq("245")
          end
        end
      end

      context "when object is a consolidated payment" do
        let!(:contractor_integration_record) { create(:integration_record, integration: quickbooks_integration, integratable: contractor, integration_external_id: "85") }
        let(:invoice) { create(:invoice, :approved, company:, user: contractor.user) }
        let!(:invoice_integration_record) { create(:integration_record, integratable: invoice, integration: quickbooks_integration, integration_external_id: "164") }
        let(:consolidated_invoice) { create(:consolidated_invoice, company:, invoices: [invoice]) }
        let!(:consolidated_invoice_integration_record) { create(:integration_record, integratable: consolidated_invoice, integration: quickbooks_integration, integration_external_id: "191") }
        let(:consolidated_payment) { create(:consolidated_payment, consolidated_invoice:, status: ConsolidatedPayment::SUCCEEDED) }

        it "syncs data back to Quickbooks" do
          expect(client.send(:lock_manager)).to receive(:lock!).with(quickbooks_integration.cache_key).and_call_original
          expect(client.send(:lock_manager)).to receive(:lock!).with(consolidated_payment.cache_key).and_call_original
          expect do
            client.sync_data_for(object: consolidated_payment)
          end.to change { quickbooks_integration.reload.last_sync_at }
             .and change { IntegrationRecord.count }.by(1)

          integration_record = IntegrationRecord.last
          expect(integration_record.sync_token).to eq("0")
          expect(integration_record.integration_external_id).to be_present
          expect(integration_record.integratable_id).to eq(consolidated_payment.id)
        end
      end
    end
  end

  describe "#fetch_quickbooks_accounts" do
    context "when :type kwarg is invalid" do
      it "raises an invalid type error" do
        expect do
          client.send(:fetch_quickbooks_accounts, type: "invalid")
        end.to raise_error(ArgumentError, "Invalid account type")
      end
    end

    context "when :type is 'Expense'" do
      context "when integration does not exist" do
        it "returns an empty array" do
          expect(client.send(:fetch_quickbooks_accounts, type: "Expense")).to eq([])
        end
      end

      context "when integration exists" do
        let!(:quickbooks_integration) { create(:quickbooks_integration, company:) }

        it "returns the expense accounts" do
          query = CGI.escape "select * from Account where AccountType = 'Expense' and Active = true startposition 1 maxresults 1000"
          stub = WebMock.stub_request(:get, "#{client.send(:base_api_url)}/query?query=#{query}&minorversion=#{MINOR_VERSION}")
                        .to_return(
                          status: 200,
                          body: {
                            QueryResponse: {
                              Account: [
                                {
                                  Id: "1",
                                  Name: "Account 1",
                                },
                                {
                                  Id: "2",
                                  Name: "Account 2",
                                }
                              ],
                            },
                          }.to_json,
                          headers: { content_type: "application/json" }
                        )

          expect(client.send(:fetch_quickbooks_accounts, type: "Expense")).to match_array(
            [
              {
                id: "1",
                name: "Account 1",
              },
              {
                id: "2",
                name: "Account 2",
              }
            ]
          )
          assert_requested(stub)
        end
      end
    end

    context "when :type is 'Bank'" do
      context "when integration does not exist" do
        it "returns an empty array" do
          expect(client.send(:fetch_quickbooks_accounts, type: "Bank")).to eq([])
        end
      end

      context "when integration exists" do
        let!(:quickbooks_integration) { create(:quickbooks_integration, company:) }

        it "returns the bank accounts" do
          expect(client.send(:fetch_quickbooks_accounts, type: "Bank")).to match_array(
            [
              {
                id: "93",
                name: "Cash on hand",
              },
              {
                id: "35",
                name: "Checking",
              },
              {
                id: "94",
                name: "Flexile.com Money Out Clearing",
              },
              {
                id: "36",
                name: "Savings",
              }
            ]
          )
        end
      end
    end

    context "when :type is 'Accounts Payable'" do
      context "when integration does not exist" do
        it "returns an empty array" do
          expect(client.send(:fetch_quickbooks_accounts, type: "Accounts Payable")).to eq([])
        end
      end

      context "when integration exists" do
        let!(:quickbooks_integration) { create(:quickbooks_integration, company:) }

        it "returns the bank accounts" do
          query = CGI.escape "select * from Account where AccountType = 'Accounts Payable' and Active = true startposition 1 maxresults 1000"
          stub = WebMock.stub_request(:get, "#{client.send(:base_api_url)}/query?query=#{query}&minorversion=#{MINOR_VERSION}")
                        .to_return(
                          status: 200,
                          body: {
                            QueryResponse: {
                              Account: [
                                {
                                  Id: "1",
                                  Name: "Accounts Payable (A/P)",
                                }
                              ],
                            },
                          }.to_json,
                          headers: { content_type: "application/json" }
                        )

          expect(client.send(:fetch_quickbooks_accounts, type: "Accounts Payable")).to match_array(
            [
              {
                id: "1",
                name: "Accounts Payable (A/P)",
              }
            ]
          )
          assert_requested(stub)
        end
      end
    end
  end

  describe "#fetch_quickbooks_entity" do
    let(:contractor) { create(:company_worker, company:) }

    context "when integration does not exist" do
      it "raises an error" do
        expect { client.fetch_quickbooks_entity(entity: "Vendor", integration_external_id: "1") }.to raise_error("Quickbooks integration does not exist")
      end
    end

    context "when integration exists" do
      let!(:quickbooks_integration) { create(:quickbooks_integration, company:) }

      context "and QBO entity does not exist" do
        it "returns an empty response" do
          expect(client.fetch_quickbooks_entity(entity: "Vendor", integration_external_id: "111111111")).to be_nil
        end
      end

      context "when QBO entity exists" do
        let!(:contractor_integration_record) { create(:integration_record, integration: quickbooks_integration, integratable: contractor, integration_external_id: "85") }

        it "returns the QBO entity" do
          expect(client.fetch_quickbooks_entity(entity: "Vendor", integration_external_id: "85")).to eq(
            {
              "Active" => true,
              "Balance" => 2780.0,
              "BillAddr" => { "Id" => "160", "Country" => "Argentina" },
              "CurrencyRef" => { "name" => "United States Dollar", "value" => "USD" },
              "DisplayName" => "Caro Example",
              "Id" => "85",
              "MetaData" => { "CreateTime" => "2022-12-30T11:17:44-08:00", "LastUpdatedTime" => "2023-07-27T13:01:33-07:00" },
              "PrimaryEmailAddr" => { "Address" => "caro@example.com" },
              "PrintOnCheckName" => "Caro Example",
              "SyncToken" => "16",
              "Vendor1099" => false,
              "domain" => "QBO",
              "sparse" => false,
            }
          )
        end
      end
    end
  end

  describe "#fetch_vendor_by_email_and_name" do
    context "when integration does not exist" do
      it "raises an error" do
        expect { client.fetch_vendor_by_email_and_name(email: "test@example.com", name: "Test") }.to raise_error("Quickbooks integration does not exist")
      end
    end

    context "when integration exists" do
      let!(:quickbooks_integration) { create(:quickbooks_integration, company:) }

      context "and QBO vendor does not exist" do
        it "returns an empty response" do
          expect(client.fetch_vendor_by_email_and_name(email: "caro@example.com", name: "Acme Example LLC")).to be_nil
        end
      end

      context "when QBO vendor exists" do
        let(:user) { create(:user, email: "caro@example.com", legal_name: "Caro Example") }

        before { create(:company_worker, company:, user:) }

        it "returns the QBO vendor" do
          expect(client.fetch_vendor_by_email_and_name(email: "caro@example.com", name: "Caro Example")).to eq(
            {
              "Active" => true,
              "Balance" => 4620.0,
              "BillAddr" => { "Country" => "Argentina", "Id" => "160" },
              "BillRate" => 50,
              "CurrencyRef" => { "name" => "United States Dollar", "value" => "USD" },
              "DisplayName" => "Caro Example",
              "Id" => "85",
              "MetaData" => { "CreateTime" => "2022-12-30T11:17:44-08:00", "LastUpdatedTime" => "2024-01-25T06:57:17-08:00" },
              "PrimaryEmailAddr" => { "Address" => "caro@example.com" },
              "PrintOnCheckName" => "Caro Example",
              "SyncToken" => "17",
              "V4IDPseudonym" => "00209847d5d4485cdd4b0cade8f38ad07c308d",
              "Vendor1099" => false,
              "domain" => "QBO",
              "sparse" => false,
            }
          )
        end

        context "pagination" do
          before { stub_const("#{described_class}::RECORDS_PER_PAGE", 5) }

          it "paginates results" do
            expect(client.fetch_vendor_by_email_and_name(email: "caro@example.com", name: "Caro Example")).to eq(
              {
                "Active" => true,
                "Balance" => 4620.0,
                "BillAddr" => { "Country" => "Argentina", "Id" => "160" },
                "BillRate" => 50,
                "CurrencyRef" => { "name" => "United States Dollar", "value" => "USD" },
                "DisplayName" => "Caro Example",
                "Id" => "85",
                "MetaData" => { "CreateTime" => "2022-12-30T11:17:44-08:00", "LastUpdatedTime" => "2024-01-25T06:57:17-08:00" },
                "PrimaryEmailAddr" => { "Address" => "caro@example.com" },
                "PrintOnCheckName" => "Caro Example",
                "SyncToken" => "17",
                "V4IDPseudonym" => "00209847d5d4485cdd4b0cade8f38ad07c308d",
                "Vendor1099" => false,
                "domain" => "QBO",
                "sparse" => false,
              }
            )
          end
        end
      end
    end
  end

  describe "#get_bank_accounts" do
    context "when integration does not exist" do
      it "returns an empty array" do
        expect(client.get_bank_accounts).to eq([])
      end
    end

    context "when integration exists" do
      context "when setup is incomplete" do
        before { create(:quickbooks_integration, :with_incomplete_setup, company:) }

        it "filters out the Flexile.com clearance account" do
          expect(client.get_bank_accounts).to match_array(
            [
              {
                id: "93",
                name: "Cash on hand",
              },
              {
                id: "35",
                name: "Checking",
              },
              {
                id: "36",
                name: "Savings",
              }
            ]
          )
        end
      end

      context "when setup is complete" do
        let!(:integration) { create(:quickbooks_integration, company:) }

        it "filters out the Flexile.com clearance account" do
          expect(client.get_bank_accounts).to match_array(
            [
              {
                id: "93",
                name: "Cash on hand",
              },
              {
                id: "35",
                name: "Checking",
              },
              {
                id: "36",
                name: "Savings",
              }
            ]
          )
        end

        context "when access token expired" do
          before { integration.update!(expires_at: 1.day.ago) }

          it "returns an empty array and updates the integration" do
            allow(Bugsnag).to receive(:notify).and_call_original
            expect(client.get_bank_accounts).to eq([])
            expect(integration.reload.sync_error).to eq("Unauthorized")
            expect(integration.status).to eq("out_of_sync")
            expect(Bugsnag).to have_received(:notify).once
          end
        end
      end
    end
  end

  describe "#fetch_company_financials" do
    context "when integration does not exist" do
      it "raises an error" do
        expect { client.fetch_company_financials }.to raise_error("Quickbooks integration does not exist")
      end
    end

    context "when integration exists" do
      let!(:quickbooks_integration) { create(:quickbooks_integration, company:) }

      it "returns the profit and loss for the last month by default" do
        expect(client.fetch_company_financials).to eq({
          revenue: 4427.30,
          net_income: -767.71,
        })
      end

      it "returns the profit and loss for the last quarter when called with the right `date_filter`" do
        expect(client.fetch_company_financials(date_filter: "last fiscal quarter")).to eq({
          revenue: 1774.25,
          net_income: 724.59,
        })
      end

      it "returns the profit and loss for the last year when called with the right `date_filter`" do
        # No recorded financials for the last fiscal year, so all values are 0
        expect(client.fetch_company_financials(date_filter: "last fiscal year")).to eq({
          revenue: 0,
          net_income: 0,
        })
      end

      it "returns the profit and loss for a custom month when called with the `custom_month` argument" do
        expect(client.fetch_company_financials(custom_month: Date.new(2024, 1))).to eq({
          revenue: 391.25,
          net_income: 91.25,
        })
      end

      it "returns the profit and loss for the custom month when called with both `custom_month` and `date_filter` arguments" do
        expect(client.fetch_company_financials(custom_month: Date.new(2024, 1), date_filter: "last fiscal quarter"))
          .to eq({
            revenue: 391.25,
            net_income: 91.25,
          })
      end
    end
  end
end
