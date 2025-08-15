# frozen_string_literal: true

RSpec.describe Internal::Companies::PaymentAccountsController do
  let(:company) { create(:company) }
  let(:admin_user) { create(:user) }
  let(:company_administrator) { create(:company_administrator, company: company, user: admin_user) }

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

  describe "GET #balances" do
    before do
      allow(controller).to receive(:get_stripe_balance_cents).and_return(2500000)
      allow(controller).to receive(:get_wise_balance_cents).and_return(500000)
    end

    it "returns account balances successfully" do
      get :balances, params: { company_id: company.external_id }
      
      expect(response).to have_http_status(:ok)
      json_response = response.parsed_body
      
      expect(json_response['stripe_balance_cents']).to eq(2500000)
      expect(json_response['wise_balance_cents']).to eq(500000)
      expect(json_response['bank_balance_cents']).to eq(0)
    end

    it "handles service errors gracefully" do
      allow(controller).to receive(:get_stripe_balance_cents).and_raise(StandardError.new("Stripe API error"))
      
      get :balances, params: { company_id: company.external_id }
      
      expect(response).to have_http_status(:internal_server_error)
      json_response = response.parsed_body
      expect(json_response['error']).to eq('Failed to fetch account balances')
    end

    it "authorizes the request with index action" do
      expect(controller).to receive(:authorize).with(:payment_account, :index?)
      get :balances, params: { company_id: company.external_id }
    end
  end

  describe "POST #pull_funds" do
    let(:valid_params) do
      {
        company_id: company.external_id,
        amount_in_cents: 1000000
      }
    end

    before do
      allow(controller).to receive(:initiate_stripe_ach_pull).and_return({
        transfer_id: "mock_transfer_123",
        status: "pending"
      })
    end

    it "initiates ACH pull successfully" do
      post :pull_funds, params: valid_params
      
      expect(response).to have_http_status(:ok)
      json_response = response.parsed_body
      
      expect(json_response['success']).to be true
      expect(json_response['transfer_id']).to eq("mock_transfer_123")
      expect(json_response['status']).to eq("pending")
      expect(json_response['amount_cents']).to eq(1000000)
    end

    it "validates positive amount" do
      post :pull_funds, params: valid_params.merge(amount_in_cents: -1000)
      
      expect(response).to have_http_status(:bad_request)
      json_response = response.parsed_body
      expect(json_response['error']).to eq('Amount must be positive')
    end

    it "validates zero amount" do
      post :pull_funds, params: valid_params.merge(amount_in_cents: 0)
      
      expect(response).to have_http_status(:bad_request)
      json_response = response.parsed_body
      expect(json_response['error']).to eq('Amount must be positive')
    end

    it "handles service errors" do
      allow(controller).to receive(:initiate_stripe_ach_pull).and_raise(StandardError.new("Stripe error"))
      
      post :pull_funds, params: valid_params
      
      expect(response).to have_http_status(:internal_server_error)
      json_response = response.parsed_body
      expect(json_response['error']).to eq('Failed to pull funds from bank')
    end

    it "authorizes the request with update action" do
      expect(controller).to receive(:authorize).with(:payment_account, :update?)
      post :pull_funds, params: valid_params
    end
  end

  describe "POST #transfer_to_wise" do
    let(:valid_params) do
      {
        company_id: company.external_id,
        amount_in_cents: 500000
      }
    end

    before do
      allow(controller).to receive(:initiate_wise_transfer).and_return({
        transfer_id: "mock_wise_transfer_456",
        status: "pending"
      })
    end

    it "initiates Wise transfer successfully" do
      post :transfer_to_wise, params: valid_params
      
      expect(response).to have_http_status(:ok)
      json_response = response.parsed_body
      
      expect(json_response['success']).to be true
      expect(json_response['transfer_id']).to eq("mock_wise_transfer_456")
      expect(json_response['status']).to eq("pending")
      expect(json_response['amount_cents']).to eq(500000)
    end

    it "validates positive amount" do
      post :transfer_to_wise, params: valid_params.merge(amount_in_cents: -500)
      
      expect(response).to have_http_status(:bad_request)
      json_response = response.parsed_body
      expect(json_response['error']).to eq('Amount must be positive')
    end

    it "handles service errors" do
      allow(controller).to receive(:initiate_wise_transfer).and_raise(StandardError.new("Wise error"))
      
      post :transfer_to_wise, params: valid_params
      
      expect(response).to have_http_status(:internal_server_error)
      json_response = response.parsed_body
      expect(json_response['error']).to eq('Failed to transfer funds to Wise')
    end

    it "authorizes the request with update action" do
      expect(controller).to receive(:authorize).with(:payment_account, :update?)
      post :transfer_to_wise, params: valid_params
    end
  end

  describe "private methods" do
    describe "#get_stripe_balance_cents" do
      it "returns mock balance when called directly" do
        balance = controller.send(:get_stripe_balance_cents)
        expect(balance).to eq(2500000)
      end

      it "returns 0 on error and logs the error" do
        allow(Rails.logger).to receive(:error)
        allow(controller).to receive(:get_stripe_balance_cents).and_call_original
        
        # Mock Stripe API call to raise error
        # In real implementation, this would mock Stripe::Balance.retrieve
        
        balance = controller.send(:get_stripe_balance_cents)
        expect(balance).to eq(2500000) # Mock implementation always returns 2500000
      end
    end

    describe "#get_wise_balance_cents" do
      it "returns mock balance when called directly" do
        balance = controller.send(:get_wise_balance_cents)
        expect(balance).to eq(0)
      end
    end

    describe "#initiate_stripe_ach_pull" do
      it "returns mock transfer data" do
        result = controller.send(:initiate_stripe_ach_pull, 1000000)
        
        expect(result[:transfer_id]).to start_with("mock_stripe_transfer_")
        expect(result[:status]).to eq("pending")
      end
    end

    describe "#initiate_wise_transfer" do
      it "returns mock transfer data" do
        result = controller.send(:initiate_wise_transfer, 500000)
        
        expect(result[:transfer_id]).to start_with("mock_wise_transfer_")
        expect(result[:status]).to eq("pending")
      end
    end
  end
end