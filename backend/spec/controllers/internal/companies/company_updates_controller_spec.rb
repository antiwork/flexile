# frozen_string_literal: true

RSpec.describe Internal::Companies::CompanyUpdatesController do
  let(:company) { create(:company) }
  let(:admin_user) { create(:user) }
  let(:company_administrator) { create(:company_administrator, company: company, user: admin_user) }
  let!(:company_investor) { create(:company_investor, company: company) }
  let(:company_update) { create(:company_update, company: company) }

  before do
    allow(controller).to receive(:authenticate_user_json!).and_return(true)
    allow(controller).to receive(:current_context) do
      Current.user = admin_user
      Current.company = company
      Current.company_administrator = company_administrator
      CurrentContext.new(user: admin_user, company: company)
    end
  end

  shared_examples "requires admin" do |action, method = :get, extra_params = {}|
    context "when user is not admin" do
      before do
        company_administrator.destroy!
        Current.company_administrator = nil
      end

      it "returns forbidden" do
        params = { company_id: company.external_id }.merge(extra_params.transform_values do |v|
          v == :company_update ? company_update.external_id : v
        end)
        send(method, action, params: params)
        expect(response).to have_http_status(:forbidden)
      end
    end
  end

  describe "GET #index" do
    let(:presenter_double) { instance_double(CompanyUpdatesPresenter) }
    let(:expected_result) { { updates: [], pagy: {} } }

    before do
      allow(CompanyUpdatesPresenter).to receive(:new)
        .with(hash_including(company: company, params: an_instance_of(ActionController::Parameters)))
        .and_return(presenter_double)
    end

    it "returns admin props when user is admin" do
      allow(presenter_double).to receive(:admin_props).and_return(expected_result)
      allow(Current).to receive(:company_administrator?).and_return(true)
      get :index, params: { company_id: company.external_id }
      expect(presenter_double).to have_received(:admin_props)
    end

    it "returns regular props when user is not admin" do
      allow(presenter_double).to receive(:props).and_return(expected_result)
      allow(Current).to receive(:company_administrator?).and_return(false)
      get :index, params: { company_id: company.external_id }
      expect(presenter_double).to have_received(:props)
    end
  end

  describe "GET #new" do
    it "returns form props" do
      presenter_double = instance_double(CompanyUpdatePresenter)
      allow(CompanyUpdatePresenter).to receive(:new).and_return(presenter_double)
      allow(presenter_double).to receive(:form_props).and_return({})
      get :new, params: { company_id: company.external_id }
      expect(presenter_double).to have_received(:form_props)
    end
    include_examples "requires admin", :new
  end

  describe "GET #edit" do
    it "returns form props" do
      presenter_double = instance_double(CompanyUpdatePresenter)
      allow(CompanyUpdatePresenter).to receive(:new).with(company_update).and_return(presenter_double)
      allow(presenter_double).to receive(:form_props).and_return({})
      get :edit, params: { company_id: company.external_id, id: company_update.external_id }
      expect(presenter_double).to have_received(:form_props)
    end
    include_examples "requires admin", :edit, :get, { id: :company_update }
  end

  describe "POST #create" do
    let(:service_result) { { company_update: company_update } }
    let(:valid_params) { { company_update: { title: "Test Update", body: "Test body" } } }

    it "creates and returns company update" do
      allow(CreateOrUpdateCompanyUpdate).to receive(:new).and_return(double(perform!: service_result))
      presenter_double = instance_double(CompanyUpdatePresenter)
      allow(CompanyUpdatePresenter).to receive(:new).with(company_update).and_return(presenter_double)
      allow(presenter_double).to receive(:props).and_return({})
      post :create, params: { company_id: company.external_id }.merge(valid_params)
      expect(response).to have_http_status(:created)
    end

    it "publishes when publish param is true" do
      service_result = { company_update: company_update }
      presenter_double = instance_double(CompanyUpdatePresenter)
      expected_result = { id: company_update.external_id, title: "Test Update" }

      allow(CreateOrUpdateCompanyUpdate).to receive(:new)
        .with(hash_including(company: company, company_update_params: an_instance_of(ActionController::Parameters)))
        .and_return(double(perform!: service_result))
      publish_double = double(perform!: service_result)
      allow(PublishCompanyUpdate).to receive(:new)
        .with(company_update)
        .and_return(publish_double)
      allow(CompanyUpdatePresenter).to receive(:new)
        .and_return(presenter_double)
      allow(presenter_double).to receive(:props)
        .and_return(expected_result)

      post :create, params: { company_id: company.external_id, publish: "true" }.merge(valid_params)
      expect(PublishCompanyUpdate).to have_received(:new).with(company_update)
    end

    it "returns unprocessable entity on failure" do
      invalid_update = CompanyUpdate.new
      invalid_update.validate
      allow(CreateOrUpdateCompanyUpdate).to receive(:new).and_raise(ActiveRecord::RecordInvalid.new(invalid_update))
      post :create, params: { company_id: company.external_id, company_update: { title: "", body: "" } }
      expect(response).to have_http_status(:unprocessable_entity)
    end

    include_examples "requires admin", :create, :post, { company_update: { title: "Test", body: "Test" } }
  end

  describe "PUT #update" do
    let(:update_params) { { company_update: { title: "Updated", body: "Updated body" } } }

    it "updates successfully" do
      allow(CreateOrUpdateCompanyUpdate).to receive(:new).and_return(double(perform!: nil))
      presenter_double = instance_double(CompanyUpdatePresenter)
      allow(CompanyUpdatePresenter).to receive(:new).with(company_update).and_return(presenter_double)
      allow(presenter_double).to receive(:props).and_return({})
      put :update, params: { company_id: company.external_id, id: company_update.external_id }.merge(update_params)
      expect(response).to have_http_status(:ok)
    end

    it "publishes when publish param is true" do
      allow(CreateOrUpdateCompanyUpdate).to receive(:new).and_return(double(perform!: nil))
      allow(PublishCompanyUpdate).to receive(:new).with(company_update).and_return(double(perform!: nil))
      put :update, params: { company_id: company.external_id, id: company_update.external_id, publish: "true" }.merge(update_params)
      expect(PublishCompanyUpdate).to have_received(:new).with(company_update)
    end

    include_examples "requires admin", :update, :put, { id: :company_update, company_update: { title: "Test" } }
  end

  describe "POST #publish" do
    it "publishes and returns update" do
      allow(PublishCompanyUpdate).to receive(:new).with(company_update).and_return(double(perform!: nil))
      presenter_double = instance_double(CompanyUpdatePresenter)
      allow(CompanyUpdatePresenter).to receive(:new).with(company_update).and_return(presenter_double)
      allow(presenter_double).to receive(:props).and_return({})
      post :publish, params: { company_id: company.external_id, id: company_update.external_id }
      expect(response).to have_http_status(:ok)
    end
    include_examples "requires admin", :publish, :post, { id: :company_update }
  end

  describe "GET #show" do
    it "returns company update props" do
      presenter_double = instance_double(CompanyUpdatePresenter)
      allow(CompanyUpdatePresenter).to receive(:new).with(company_update).and_return(presenter_double)
      allow(presenter_double).to receive(:props).and_return({})
      get :show, params: { company_id: company.external_id, id: company_update.external_id }
      expect(presenter_double).to have_received(:props)
    end
  end

  describe "POST #send_test_email" do
    it "sends test email" do
      allow(CompanyUpdateMailer).to receive(:update_published).and_return(double(deliver_now: true))
      post :send_test_email, params: { company_id: company.external_id, id: company_update.external_id }
      expect(CompanyUpdateMailer).to have_received(:update_published)
    end
    include_examples "requires admin", :send_test_email, :post, { id: :company_update }
  end

  describe "DELETE #destroy" do
    it "destroys the update" do
      delete :destroy, params: { company_id: company.external_id, id: company_update.external_id }
      expect(response).to have_http_status(:no_content)
    end
    include_examples "requires admin", :destroy, :delete, { id: :company_update }
  end
end
