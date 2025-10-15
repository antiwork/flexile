# frozen_string_literal: true

RSpec.describe Internal::Companies::CapTablesController do
  let(:company) { create(:company, equity_enabled: true) }
  let(:user) { create(:user) }
  let(:company_administrator) { create(:company_administrator, company:, user:) }

  before do
    allow(controller).to receive(:authenticate_user_json!).and_return(true)
    allow(controller).to receive(:current_context) do
      Current.user = user
      Current.company = company
      Current.company_administrator = company_administrator
      CurrentContext.new(user:, company:)
    end
  end

  describe "GET #export" do
    let(:csv_content) { "Name,Outstanding shares\nTest Investor,1000\nTotal,1000" }

    before do
      allow_any_instance_of(InvestorsCsv).to receive(:generate).and_return(csv_content)
    end

    context "when user is authorized" do
      it "returns CSV content with correct headers" do
        freeze_time do
          expected_filename = "investors-#{company.name.parameterize}-#{Time.current.strftime('%Y-%m-%d_%H%M%S')}.csv"

          get :export, params: { company_id: company.id }

          expect(response).to have_http_status(:ok)
          expect(response.content_type).to eq("text/csv; charset=utf-8")
          expect(response.body).to eq(csv_content)
          expect(response.headers["Content-Disposition"]).to eq("attachment; filename=#{expected_filename}")
        end
      end
    end

    context "when user is not authorized" do
      before do
        allow(controller).to receive(:current_context) do
          CurrentContext.new(user: create(:user), company:)
        end
      end

      it "returns forbidden status" do
        get :export, params: { company_id: company.id }

        expect(response).to have_http_status(:forbidden)
      end
    end
  end

  describe "POST #create" do
    let(:investors_data) do
      [
        { userId: user.external_id, shares: 100_000 }
      ]
    end

    context "when user is authorized" do
      before do
        company_administrator
      end

      context "when service succeeds" do
        before do
          allow(CreateCapTable).to receive(:new).and_return(
            double(perform: { success: true, errors: [] })
          )
        end

        it "calls the service with correct parameters" do
          expect(CreateCapTable).to receive(:new) do |args|
            expect(args[:company]).to eq(company)
            expect(args[:investors_data].first["userId"]).to eq(user.external_id)
            expect(args[:investors_data].first["shares"]).to eq("100000")
            double(perform: { success: true, errors: [] })
          end

          post :create, params: { company_id: company.external_id, cap_table: { investors: investors_data } }
          expect(response).to have_http_status(:created)
        end
      end

      context "when service fails" do
        before do
          allow(CreateCapTable).to receive(:new).and_return(
            double(perform: { success: false, errors: ["Some error message"] })
          )
        end

        it "calls the service with correct parameters" do
          expect(CreateCapTable).to receive(:new) do |args|
            expect(args[:company]).to eq(company)
            expect(args[:investors_data].first["userId"]).to eq(user.external_id)
            expect(args[:investors_data].first["shares"]).to eq("100000")
            double(perform: { success: false, errors: ["Some error message"] })
          end

          post :create, params: { company_id: company.external_id, cap_table: { investors: investors_data } }

          expect(response).to have_http_status(:unprocessable_entity)
          expect(response.parsed_body).to eq({
            "success" => false,
            "errors" => ["Some error message"],
          })
        end
      end
    end

    context "when user is not authorized" do
      before { company_administrator.destroy! }

      it "disallows access" do
        post :create, params: { company_id: company.external_id, cap_table: { investors: investors_data } }

        expect(response).to have_http_status(:forbidden)
      end
    end

    context "when company already has existing cap table data" do
      before do
        company_administrator
        create(:share_class, company: company, name: "Series A")
      end

      it "returns forbidden status due to authorization policy" do
        post :create, params: { company_id: company.external_id, cap_table: { investors: investors_data } }

        expect(response).to have_http_status(:forbidden)
      end
    end
  end
end
