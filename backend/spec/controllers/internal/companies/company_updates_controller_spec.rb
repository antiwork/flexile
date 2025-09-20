# frozen_string_literal: true

RSpec.describe Internal::Companies::CompanyUpdatesController do
  let(:company) { create(:company) }
  let(:admin_user) { create(:user) }
  let(:company_administrator) { create(:company_administrator, company: company, user: admin_user) }
  let!(:company_investor) { create(:company_investor, company: company) }
  let(:company_update) { create(:company_update, company: company) }

  before do
    allow(controller).to receive(:authenticate_user_json!).and_return(true)

    Current.user = admin_user
    Current.company = company
    Current.company_administrator = company_administrator

    allow(controller).to receive(:current_context) do
      Current.user = admin_user
      Current.company = company
      Current.company_administrator = company_administrator
      CurrentContext.new(user: admin_user, company: company)
    end
  end

  describe "GET #index" do
    it "returns company updates props for admin" do
      presenter_double = instance_double(CompanyUpdatesPresenter)
      expected_result = { updates: [], pagy: {} }

      allow(CompanyUpdatesPresenter).to receive(:new)
        .with(hash_including(company: company, params: an_instance_of(ActionController::Parameters)))
        .and_return(presenter_double)
      allow(presenter_double).to receive(:admin_props)
        .and_return(expected_result)
      allow(Current).to receive(:company_administrator?).and_return(true)

      get :index, params: { company_id: company.external_id }

      expect(response).to have_http_status(:ok)
      expect(response.parsed_body).to eq(expected_result.with_indifferent_access)
      expect(presenter_double).to have_received(:admin_props)
    end

    it "returns company updates props for non-admin" do
      presenter_double = instance_double(CompanyUpdatesPresenter)
      expected_result = { updates: [], pagy: {} }

      allow(CompanyUpdatesPresenter).to receive(:new)
        .with(hash_including(company: company, params: an_instance_of(ActionController::Parameters)))
        .and_return(presenter_double)
      allow(presenter_double).to receive(:props)
        .and_return(expected_result)
      allow(Current).to receive(:company_administrator?).and_return(false)

      get :index, params: { company_id: company.external_id }

      expect(response).to have_http_status(:ok)
      expect(response.parsed_body).to eq(expected_result.with_indifferent_access)
      expect(presenter_double).to have_received(:props)
    end
  end

  describe "GET #new" do
    it "returns form props for new company update" do
      presenter_double = instance_double(CompanyUpdatePresenter)
      expected_result = { financial_periods: [], recipient_count: {} }

      allow(CompanyUpdatePresenter).to receive(:new)
        .and_return(presenter_double)
      allow(presenter_double).to receive(:form_props)
        .and_return(expected_result)

      get :new, params: { company_id: company.external_id }

      expect(response).to have_http_status(:ok)
      expect(response.parsed_body).to eq(expected_result.with_indifferent_access)
      expect(presenter_double).to have_received(:form_props)
    end
  end

  describe "GET #edit" do
    it "returns form props for existing company update" do
      presenter_double = instance_double(CompanyUpdatePresenter)
      expected_result = { financial_periods: [], recipient_count: {}, company_update: {} }

      allow(CompanyUpdatePresenter).to receive(:new)
        .with(company_update)
        .and_return(presenter_double)
      allow(presenter_double).to receive(:form_props)
        .and_return(expected_result)

      get :edit, params: { company_id: company.external_id, id: company_update.external_id }

      expect(response).to have_http_status(:ok)
      expect(response.parsed_body).to eq(expected_result.with_indifferent_access)
      expect(presenter_double).to have_received(:form_props)
    end
  end

  describe "POST #create" do
    let(:valid_params) { { company_update: { title: "Test Update", body: "Test body content" } } }

    context "when creation succeeds" do
      it "creates company update and returns it" do
        service_result = { company_update: company_update }
        presenter_double = instance_double(CompanyUpdatePresenter)
        expected_result = { id: company_update.external_id, title: "Test Update" }

        allow(CreateOrUpdateCompanyUpdate).to receive(:new)
          .with(hash_including(company: company, company_update_params: an_instance_of(ActionController::Parameters)))
          .and_return(double(perform!: service_result))
        allow(CompanyUpdatePresenter).to receive(:new)
          .with(company_update)
          .and_return(presenter_double)
        allow(presenter_double).to receive(:props)
          .and_return(expected_result)

        post :create, params: { company_id: company.external_id }.merge(valid_params)

        expect(response).to have_http_status(:created)
        expect(response.parsed_body).to eq({ "company_update" => expected_result }.with_indifferent_access)
      end

      it "publishes company update when publish param is true" do
        service_result = { company_update: company_update }
        presenter_double = instance_double(CompanyUpdatePresenter)
        expected_result = { id: company_update.external_id, title: "Test Update" }

        allow(CreateOrUpdateCompanyUpdate).to receive(:new)
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
    end

    context "when creation fails" do
      it "returns unprocessable entity with error message" do
        invalid_update = CompanyUpdate.new
        invalid_update.validate # populate errors
        allow(CreateOrUpdateCompanyUpdate).to receive(:new)
          .and_raise(ActiveRecord::RecordInvalid.new(invalid_update))

        post :create, params: { company_id: company.external_id, company_update: { title: "", body: "" } }

        expect(response).to have_http_status(:unprocessable_entity)
        expect(response.parsed_body["error_message"]).to eq(invalid_update.errors.full_messages.to_sentence)
      end
    end
  end

  describe "PUT #update" do
    let(:update_params) { { company_update: { title: "Updated Title", body: "Updated body" } } }

    it "updates company update successfully" do
      presenter_double = instance_double(CompanyUpdatePresenter)
      expected_result = { id: company_update.external_id, title: "Updated Title" }

      allow(CreateOrUpdateCompanyUpdate).to receive(:new)
        .with(hash_including(company: company, company_update: company_update, company_update_params: an_instance_of(ActionController::Parameters)))
        .and_return(double(perform!: nil))
      allow(CompanyUpdatePresenter).to receive(:new)
        .with(company_update)
        .and_return(presenter_double)
      allow(presenter_double).to receive(:props)
        .and_return(expected_result)

      put :update, params: { company_id: company.external_id, id: company_update.external_id }.merge(update_params)

      expect(response).to have_http_status(:ok)
      expect(response.parsed_body).to eq({ "company_update" => expected_result }.with_indifferent_access)
    end

    it "publishes company update when publish param is true" do
      allow(CreateOrUpdateCompanyUpdate).to receive(:new)
        .and_return(double(perform!: nil))
      publish_double = double(perform!: nil)
      allow(PublishCompanyUpdate).to receive(:new)
        .with(company_update)
        .and_return(publish_double)

      put :update, params: { company_id: company.external_id, id: company_update.external_id, publish: "true" }.merge(update_params)

      expect(PublishCompanyUpdate).to have_received(:new).with(company_update)
    end

    it "returns unprocessable entity when update fails" do
      invalid_update = CompanyUpdate.new
      invalid_update.validate # populate errors
      allow(CreateOrUpdateCompanyUpdate).to receive(:new)
        .and_raise(ActiveRecord::RecordInvalid.new(invalid_update))

      put :update, params: { company_id: company.external_id, id: company_update.external_id, company_update: { title: "", body: "" } }

      expect(response).to have_http_status(:unprocessable_entity)
      expect(response.parsed_body["error_message"]).to eq(invalid_update.errors.full_messages.to_sentence)
    end
  end

  describe "POST #send_test_email" do
    it "sends test email and returns ok" do
      allow(CompanyUpdateMailer).to receive(:update_published)
        .with(company_update_id: company_update.id, user_id: admin_user.id)
        .and_return(double(deliver_now: true))

      post :send_test_email, params: { company_id: company.external_id, id: company_update.external_id }

      expect(response).to have_http_status(:ok)
      expect(CompanyUpdateMailer).to have_received(:update_published).with(company_update_id: company_update.id, user_id: admin_user.id)
    end
  end

  describe "POST #publish" do
    it "publishes the company update and returns the update props" do
      presenter_double = instance_double(CompanyUpdatePresenter)
      expected_result = { id: company_update.external_id, title: company_update.title }
      publish_double = double(perform!: company_update)

      allow(PublishCompanyUpdate).to receive(:new)
        .with(company_update)
        .and_return(publish_double)
      allow(CompanyUpdatePresenter).to receive(:new)
        .with(company_update)
        .and_return(presenter_double)
      allow(presenter_double).to receive(:props)
        .and_return(expected_result)

      post :publish, params: { company_id: company.external_id, id: company_update.external_id }

      expect(response).to have_http_status(:ok)
      expect(response.parsed_body).to eq({ "company_update" => expected_result }.with_indifferent_access)
      expect(PublishCompanyUpdate).to have_received(:new).with(company_update)
      expect(presenter_double).to have_received(:props)
    end

    it "denies access if not a company administrator" do
      company_administrator.destroy!
      Current.company_administrator = nil

      post :publish, params: { company_id: company.external_id, id: company_update.external_id }

      expect(response).to have_http_status(:forbidden)
    end
  end

  describe "GET #show" do
    it "returns company update props" do
      presenter_double = instance_double(CompanyUpdatePresenter)
      expected_result = { id: company_update.external_id, title: company_update.title }

      allow(CompanyUpdatePresenter).to receive(:new)
        .with(company_update)
        .and_return(presenter_double)
      allow(presenter_double).to receive(:props)
        .and_return(expected_result)

      get :show, params: { company_id: company.external_id, id: company_update.external_id }

      expect(response).to have_http_status(:ok)
      expect(response.parsed_body).to eq(expected_result.with_indifferent_access)
      expect(presenter_double).to have_received(:props)
    end
  end

  describe "DELETE #destroy" do
    it "destroys the company update" do
      allow_any_instance_of(CompanyUpdate).to receive(:destroy!).and_call_original

      delete :destroy, params: { company_id: company.external_id, id: company_update.external_id }

      expect(response).to have_http_status(:no_content)
      expect(CompanyUpdate.find_by(id: company_update.id)).to be_nil
    end
  end

  describe "authorization" do
    context "when user is not a company administrator" do
      before do
        company_administrator.destroy!
        Current.company_administrator = nil
      end

      it "denies access to create action" do
        post :create, params: { company_id: company.external_id, company_update: { title: "Test", body: "Test" } }
        expect(response).to have_http_status(:forbidden)
      end

      it "denies access to update action" do
        put :update, params: { company_id: company.external_id, id: company_update.external_id, company_update: { title: "Test", body: "Test" } }
        expect(response).to have_http_status(:forbidden)
      end

      it "denies access to destroy action" do
        delete :destroy, params: { company_id: company.external_id, id: company_update.external_id }
        expect(response).to have_http_status(:forbidden)
      end
    end
  end
end
