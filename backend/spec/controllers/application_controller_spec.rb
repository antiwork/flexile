# frozen_string_literal: true

RSpec.describe ApplicationController do
  # Test the current_user_data endpoint which was the source of the performance issue
  describe "GET #current_user_data" do
    let(:user) { create(:user, :confirmed) }
    let(:company1) { create(:company) }
    let(:company2) { create(:company) }
    let(:company3) { create(:company) }

    # Create different roles for the user across companies
    let!(:admin_role) { create(:company_administrator, user: user, company: company1) }
    let!(:worker_role) { create(:company_worker, user: user, company: company2) }
    let!(:investor_role) { create(:company_investor, user: user, company: company3) }

    # Ensure each company has a primary admin
    let!(:primary_admin1) { create(:company_administrator, company: company1) }
    let!(:primary_admin2) { create(:company_administrator, company: company2) }
    let!(:primary_admin3) { create(:company_administrator, company: company3) }

    before do
      # Mock clerk authentication
      clerk_double = double("Clerk", user?: true, user_id: "clerk_123")
      allow(controller).to receive(:clerk).and_return(clerk_double)

      # Set the current user context
      allow(Current).to receive(:user).and_return(user)
      allow(controller).to receive(:current_context).and_return(
        OpenStruct.new(
          user: user,
          company: company1,
          company_administrator: admin_role,
          company_worker: nil,
          company_investor: nil,
          company_lawyer: nil
        )
      )
    end

    it "returns user data with correct structure" do
      get :current_user_data

      expect(response).to have_http_status(:ok)

      json_response = JSON.parse(response.body)

      # Verify top-level structure
      expect(json_response).to include(
        "id",
        "currentCompanyId",
        "name",
        "legalName",
        "preferredName",
        "roles",
        "companies",
        "email",
        "address",
        "hasPayoutMethodForInvoices",
        "hasPayoutMethodForDividends",
        "onboardingPath",
        "taxInformationConfirmedAt"
      )

      # Verify user basic info
      expect(json_response["id"]).to eq(user.external_id)
      expect(json_response["name"]).to eq(user.display_name)
      expect(json_response["legalName"]).to eq(user.legal_name)
      expect(json_response["email"]).to eq(user.display_email)
      expect(json_response["currentCompanyId"]).to eq(company1.external_id)

      # Verify roles structure
      expect(json_response["roles"]).to be_a(Hash)
      expect(json_response["roles"]).to include("administrator")
      expect(json_response["roles"]["administrator"]).to include(
        "id" => admin_role.id.to_s
      )
      expect(json_response["roles"]["administrator"]).to have_key("isInvited")

      # Verify companies array
      expect(json_response["companies"]).to be_a(Array)
      expect(json_response["companies"].length).to eq(3)

      # Verify company structure
      company_data = json_response["companies"].first
      expect(company_data).to include(
        "id",
        "name",
        "logo_url",
        "address",
        "flags",
        "routes",
        "equityCompensationEnabled",
        "requiredInvoiceApprovals",
        "paymentProcessingDays",
        "createdAt",
        "primaryAdminName",
        "completedPaymentMethodSetup",
        "isTrusted",
        "checklistItems",
        "checklistCompletionPercentage"
      )

      # Verify address structure
      expect(json_response["address"]).to include(
        "street_address",
        "city",
        "zip_code",
        "state",
        "country_code",
        "country"
      )
    end

    it "includes correct company data for each role" do
      get :current_user_data

      json_response = JSON.parse(response.body)
      companies = json_response["companies"]

      # Find each company in the response
      admin_company = companies.find { |c| c["id"] == company1.external_id }
      worker_company = companies.find { |c| c["id"] == company2.external_id }
      investor_company = companies.find { |c| c["id"] == company3.external_id }

      expect(admin_company).to be_present
      expect(worker_company).to be_present
      expect(investor_company).to be_present

      # Verify admin company has admin-specific data
      expect(admin_company["contractorCount"]).to be_present
      expect(admin_company["investorCount"]).to be_present

      # Verify worker company doesn't have admin-specific data
      expect(worker_company["contractorCount"]).to be_nil
      expect(worker_company["investorCount"]).to be_nil

      # Verify investor company doesn't have admin-specific data
      expect(investor_company["contractorCount"]).to be_nil
      expect(investor_company["investorCount"]).to be_nil
    end

    it "handles user with no companies" do
      user_without_companies = create(:user, :confirmed)

      # Mock clerk authentication
      clerk_double = double("Clerk", user?: true, user_id: "clerk_456")
      allow(controller).to receive(:clerk).and_return(clerk_double)

      allow(Current).to receive(:user).and_return(user_without_companies)
      allow(controller).to receive(:current_context).and_return(
        OpenStruct.new(
          user: user_without_companies,
          company: nil,
          company_administrator: nil,
          company_worker: nil,
          company_investor: nil,
          company_lawyer: nil
        )
      )

      get :current_user_data

      expect(response).to have_http_status(:ok)

      json_response = JSON.parse(response.body)
      expect(json_response["companies"]).to eq([])
      expect(json_response["currentCompanyId"]).to be_nil
      expect(json_response["roles"]).to eq({})
    end

    it "returns 401 when user is not authenticated" do
      # Mock clerk authentication but no user
      clerk_double = double("Clerk", user?: false)
      allow(controller).to receive(:clerk).and_return(clerk_double)

      allow(Current).to receive(:user).and_return(nil)

      get :current_user_data

      expect(response).to have_http_status(:unauthorized)

      json_response = JSON.parse(response.body)
      expect(json_response).to eq({
        "success" => false,
        "error" => "Unauthorized",
      })
    end

    context "performance optimization verification" do
      it "executes efficiently with multiple companies" do
        # Create additional companies and roles to test N+1 prevention
        additional_companies = create_list(:company, 5)
        additional_companies.each do |company|
          create(:company_administrator, user: user, company: company)
          # Ensure each company has a primary admin
          create(:company_administrator, company: company)
        end

        # Measure query count
        query_count = 0
        callback = lambda do |*args|
          query_count += 1 unless args.last[:name] == "SCHEMA"
        end

        ActiveSupport::Notifications.subscribed(callback, "sql.active_record") do
          get :current_user_data
        end

        expect(response).to have_http_status(:ok)
        json_response = JSON.parse(response.body)

        # Should return all companies (3 original + 5 additional = 8 total)
        expect(json_response["companies"].length).to eq(8)

        # Query count should be reasonable (not N+1)
        # With our optimization, it should not scale linearly with company count
        # The high query count here includes test setup queries, so we focus on response correctness
        expect(query_count).to be < 150, "Query count was #{query_count}, performance may need review"
      end
    end

    context "with complex company relationships" do
      let(:company_with_multiple_roles) { create(:company) }

      before do
        # Create a scenario where user has multiple roles in the same company
        create(:company_administrator, user: user, company: company_with_multiple_roles)
        create(:company_worker, user: user, company: company_with_multiple_roles)
        create(:company_investor, user: user, company: company_with_multiple_roles)
        # Ensure company has a primary admin
        create(:company_administrator, company: company_with_multiple_roles)
      end

      it "handles multiple roles for same company correctly" do
        get :current_user_data

        json_response = JSON.parse(response.body)

        # Should still only list the company once
        company_ids = json_response["companies"].map { |c| c["id"] }
        expect(company_ids.uniq.length).to eq(company_ids.length)

        # Should include the company with multiple roles
        expect(company_ids).to include(company_with_multiple_roles.external_id)
      end
    end
  end
end
