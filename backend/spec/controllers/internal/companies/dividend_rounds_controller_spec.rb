# frozen_string_literal: true

RSpec.describe Internal::Companies::DividendRoundsController do
  let(:company) { create(:company, equity_enabled: true) }
  let(:company_administrator) { create(:company_administrator, company: company) }
  let(:dividend_computation) { create(:dividend_computation, company: company) }
  let(:investor_user) { create(:user, legal_name: "Matthew Smith") }
  let(:company_investor) { create(:company_investor, user: investor_user, company: company) }
  let(:dividend_computation_output) do
    create(:dividend_computation_output,
           dividend_computation: dividend_computation,
           company_investor: company_investor,
           share_class: "Common",
           number_of_shares: 100,
           preferred_dividend_amount_in_usd: 0,
           dividend_amount_in_usd: 1000,
           qualified_dividend_amount_usd: 0,
           total_amount_in_usd: 1000)
  end

  before do
    dividend_computation_output
    allow(controller).to receive(:current_context) do
      Current.user = company_administrator.user
      Current.company = company
      Current.company_administrator = company_administrator
      CurrentContext.new(user: company_administrator.user, company: company)
    end
  end

  describe "POST #create" do
    context "when user is an admin" do
      it "successfully creates dividend round from computation" do
        post :create, params: { company_id: company.external_id, dividend_computation_id: dividend_computation.id }

        expect(response).to have_http_status(:created)
        expect(response.parsed_body["id"]).to be_present

        dividend_computation.reload
        expect(dividend_computation.finalized_at).to be_present
      end
    end

    context "when user is a lawyer" do
      let(:lawyer_user) { create(:user) }
      let(:company_lawyer) { create(:company_lawyer, company: company, user: lawyer_user) }

      before do
        allow(controller).to receive(:current_context) do
          Current.user = lawyer_user
          Current.company = company
          Current.company_lawyer = company_lawyer
          CurrentContext.new(user: lawyer_user, company: company)
        end
      end

      it "cannot create dividend rounds" do
        post :create, params: { company_id: company.external_id, dividend_computation_id: dividend_computation.id }
        expect(response).to have_http_status(:forbidden)
      end
    end
  end
end
