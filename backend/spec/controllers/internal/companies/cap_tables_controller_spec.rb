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
end
