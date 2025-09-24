# frozen_string_literal: true

RSpec.describe Internal::Companies::ShareClassesController do
  let(:company) { create(:company, equity_enabled: true) }
  let(:share_class_1) { create(:share_class, company: company, name: "Common") }
  let(:share_class_2) { create(:share_class, company: company, name: "Preferred") }

  before do
    allow(controller).to receive(:authenticate_user_json!).and_return(true)
  end

  describe "GET #index" do
    context "when user is a company administrator" do
      let(:user) { create(:user) }
      let(:company_administrator) { create(:company_administrator, company: company, user: user) }

      before do
        share_class_1
        share_class_2
        allow(controller).to receive(:current_context) do
          Current.user = user
          Current.company = company
          Current.company_administrator = company_administrator
          CurrentContext.new(user: user, company: company)
        end
      end

      it "returns share classes for the company" do
        get :index, params: { company_id: company.external_id }

        expect(response).to have_http_status(:ok)
        parsed_body = response.parsed_body
        expect(parsed_body).to be_an(Array)
        expect(parsed_body.length).to eq(2)

        share_class_names = parsed_body.map { |sc| sc["name"] }
        expect(share_class_names).to include("Common", "Preferred")

        parsed_body.each do |share_class|
          expect(share_class).to have_key("id")
          expect(share_class).to have_key("name")
          expect(share_class).not_to have_key("company_id")
          expect(share_class).not_to have_key("created_at")
        end
      end
    end

    context "when user is a company lawyer" do
      let(:user) { create(:user) }
      let(:company_lawyer) { create(:company_lawyer, company: company, user: user) }

      before do
        share_class_1
        allow(controller).to receive(:current_context) do
          Current.user = user
          Current.company = company
          Current.company_lawyer = company_lawyer
          CurrentContext.new(user: user, company: company)
        end
      end

      it "returns share classes for the company" do
        get :index, params: { company_id: company.external_id }

        expect(response).to have_http_status(:ok)
        parsed_body = response.parsed_body
        expect(parsed_body).to be_an(Array)
        expect(parsed_body.length).to eq(1)
        expect(parsed_body.first["name"]).to eq("Common")
      end
    end

    context "when user is not authorized" do
      let(:user) { create(:user) }

      before do
        allow(controller).to receive(:current_context) do
          Current.user = user
          Current.company = company
          CurrentContext.new(user: user, company: company)
        end
      end

      it "forbids access" do
        get :index, params: { company_id: company.external_id }

        expect(response).to have_http_status(:forbidden)
      end
    end

    context "when company does not have equity enabled" do
      let(:company_without_equity) { create(:company, equity_enabled: false) }
      let(:user) { create(:user) }
      let(:company_administrator) { create(:company_administrator, company: company_without_equity, user: user) }

      before do
        allow(controller).to receive(:current_context) do
          Current.user = user
          Current.company = company_without_equity
          Current.company_administrator = company_administrator
          CurrentContext.new(user: user, company: company_without_equity)
        end
      end

      it "forbids access" do
        get :index, params: { company_id: company_without_equity.external_id }

        expect(response).to have_http_status(:forbidden)
      end
    end

    context "when share classes belong to different company" do
      let(:other_company) { create(:company, equity_enabled: true) }
      let(:other_share_class) { create(:share_class, company: other_company, name: "Other Common") }
      let(:user) { create(:user) }
      let(:company_administrator) { create(:company_administrator, company: company, user: user) }

      before do
        share_class_1
        other_share_class
        allow(controller).to receive(:current_context) do
          Current.user = user
          Current.company = company
          Current.company_administrator = company_administrator
          CurrentContext.new(user: user, company: company)
        end
      end

      it "only returns share classes for the current company" do
        get :index, params: { company_id: company.external_id }

        expect(response).to have_http_status(:ok)
        parsed_body = response.parsed_body
        expect(parsed_body.length).to eq(1)
        expect(parsed_body.first["name"]).to eq("Common")
      end
    end
  end
end
