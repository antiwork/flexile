# frozen_string_literal: true

RSpec.describe Internal::Companies::ExpenseCategoriesController do
  let(:company) { create(:company) }
  let(:admin_user) { create(:user) }
  let(:worker_user) { create(:user) }
  let(:regular_user) { create(:user) }
  let(:company_administrator) { create(:company_administrator, company: company, user: admin_user) }
  let(:company_worker) { create(:company_worker, company: company, user: worker_user) }
  let(:expense_category) { create(:expense_category, company: company) }

  describe "GET #index" do
    context "when user is company administrator" do
      before do
        allow(controller).to receive(:authenticate_user_json!).and_return(true)

        allow(controller).to receive(:current_context) do
          Current.user = admin_user
          Current.company = company
          Current.company_administrator = company_administrator
          Current.company_worker = nil
          CurrentContext.new(user: admin_user, company: company)
        end
      end

      it "returns expense categories" do
        expense_category

        get :index, params: { company_id: company.external_id }

        expect(response).to have_http_status(:ok)
        json_response = response.parsed_body
        expect(json_response).to be_an(Array)
        expect(json_response.first["id"]).to eq(expense_category.id)
        expect(json_response.first["name"]).to eq(expense_category.name)
        expect(json_response.first["expense_account_id"]).to eq(expense_category.expense_account_id)
      end
    end

    context "when user is company worker" do
      before do
        allow(controller).to receive(:authenticate_user_json!).and_return(true)

        allow(controller).to receive(:current_context) do
          Current.user = worker_user
          Current.company = company
          Current.company_administrator = nil
          Current.company_worker = company_worker
          CurrentContext.new(user: worker_user, company: company)
        end
      end

      it "returns expense categories" do
        expense_category

        get :index, params: { company_id: company.external_id }

        expect(response).to have_http_status(:ok)
        json_response = response.parsed_body
        expect(json_response).to be_an(Array)
        expect(json_response.first["id"]).to eq(expense_category.id)
      end
    end

    context "when user is not authorized" do
      before do
        allow(controller).to receive(:authenticate_user_json!).and_return(true)

        allow(controller).to receive(:current_context) do
          Current.user = regular_user
          Current.company = company
          Current.company_administrator = nil
          Current.company_worker = nil
          CurrentContext.new(user: regular_user, company: company)
        end
      end

      it "returns forbidden" do
        get :index, params: { company_id: company.external_id }

        expect(response).to have_http_status(:forbidden)
      end
    end
  end
end
