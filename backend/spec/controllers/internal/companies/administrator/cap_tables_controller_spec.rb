# frozen_string_literal: true

RSpec.describe Internal::Companies::Administrator::CapTablesController do
  let(:company) { create(:company, equity_enabled: true, share_price_in_usd: 10.0, fully_diluted_shares: 0) }
  let(:user) { create(:user) }
  let(:company_administrator) { create(:company_administrator, company: company, user: user) }
  let(:investors_data) do
    [
      { userId: user.external_id, shares: 100_000 }
    ]
  end

  before do
    allow(controller).to receive(:authenticate_user_json!).and_return(true)

    allow(controller).to receive(:current_context) do
      Current.user = user
      Current.company = company
      Current.company_administrator = company_administrator
      CurrentContext.new(user: user, company: company)
    end
  end

  describe "POST #create" do
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
