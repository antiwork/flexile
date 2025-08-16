# frozen_string_literal: true

RSpec.describe Internal::Companies::DividendRoundsController do
  let(:company) { create(:company) }
  let(:admin_user) { create(:user) }
  let(:company_administrator) { create(:company_administrator, company: company, user: admin_user) }
  let(:dividend_round) { create(:dividend_round, company: company) }

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

  describe "GET #payment_status" do
    let!(:dividend1) { create(:dividend, dividend_round: dividend_round, status: Dividend::ISSUED, total_amount_in_cents: 50000) }
    let!(:dividend2) { create(:dividend, dividend_round: dividend_round, status: Dividend::PROCESSING, total_amount_in_cents: 75000) }
    let!(:dividend3) { create(:dividend, dividend_round: dividend_round, status: Dividend::PAID, total_amount_in_cents: 100000) }
    let!(:failed_payment) { create(:dividend_payment, dividends: [dividend1], status: Payment::FAILED) }

    it "returns payment statistics for the dividend round" do
      get :payment_status, params: { company_id: company.external_id, id: dividend_round.id }

      expect(response).to have_http_status(:ok)
      json_response = response.parsed_body

      expect(json_response["total_amount_cents"]).to eq(225000)
      expect(json_response["total_recipients"]).to eq(3)
      expect(json_response["pending"]).to eq(1) # dividend1 with ISSUED status
      expect(json_response["processing"]).to eq(1) # dividend2
      expect(json_response["completed"]).to eq(1) # dividend3
      expect(json_response["failed"]).to eq(1) # dividend1 has failed payment
      expect(json_response["retained"]).to eq(0)
    end

    it "returns 404 for non-existent dividend round" do
      get :payment_status, params: { company_id: company.external_id, id: 999999 }

      expect(response).to have_http_status(:not_found)
    end

    it "authorizes the request with show action" do
      expect(controller).to receive(:authorize).with(dividend_round, :show?)
      get :payment_status, params: { company_id: company.external_id, id: dividend_round.id }
    end
  end

  describe "POST #process_payments" do
    let!(:user1) { create(:user, tax_information_confirmed_at: 1.day.ago) }
    let!(:user2) { create(:user, tax_information_confirmed_at: 1.day.ago) }
    let!(:bank_account1) { create(:wise_recipient, user: user1, used_for_dividends: true) }
    let!(:bank_account2) { create(:wise_recipient, user: user2, used_for_dividends: true) }
    let!(:company_investor1) { create(:company_investor, company: company, user: user1) }
    let!(:company_investor2) { create(:company_investor, company: company, user: user2) }
    let!(:dividend1) { create(:dividend, dividend_round: dividend_round, company_investor: company_investor1, status: Dividend::ISSUED) }
    let!(:dividend2) { create(:dividend, dividend_round: dividend_round, company_investor: company_investor2, status: Dividend::ISSUED) }

    before do
      # Mock the Sidekiq job
      allow(PayAllDividendsJob).to receive(:perform_async)
    end

    it "marks round as ready for payment and queues payment job" do
      post :process_payments, params: { company_id: company.external_id, id: dividend_round.id }

      expect(response).to have_http_status(:ok)
      json_response = response.parsed_body

      expect(json_response["success"]).to be true
      expect(json_response["dividend_round_id"]).to eq(dividend_round.id)
      expect(json_response["message"]).to eq("Payment processing initiated")
      expect(json_response["payments_queued"]).to eq(2) # Both dividends are eligible

      dividend_round.reload
      expect(dividend_round.ready_for_payment).to be true
      expect(PayAllDividendsJob).to have_received(:perform_async).with(dividend_round.id)
    end

    it "counts ready dividends correctly" do
      # Create dividends with different eligibility criteria
      ineligible_user = create(:user, tax_information_confirmed_at: nil)
      ineligible_investor = create(:company_investor, company: company, user: ineligible_user)
      create(:dividend, dividend_round: dividend_round, company_investor: ineligible_investor, status: Dividend::ISSUED)

      post :process_payments, params: { company_id: company.external_id, id: dividend_round.id }

      expect(response).to have_http_status(:ok)
      json_response = response.parsed_body

      # Should only count eligible dividends (those with confirmed tax info and bank accounts)
      # Only the 2 eligible dividends should be counted, not the ineligible one
      expect(json_response["payments_queued"]).to eq(2)
    end

    it "returns 404 for non-existent dividend round" do
      post :process_payments, params: { company_id: company.external_id, id: 999999 }

      expect(response).to have_http_status(:not_found)
    end

    it "handles update failures" do
      allow_any_instance_of(DividendRound).to receive(:update!).and_raise(ActiveRecord::RecordInvalid.new(DividendRound.new))

      post :process_payments, params: { company_id: company.external_id, id: dividend_round.id }

      expect(response).to have_http_status(:unprocessable_entity)
      json_response = response.parsed_body
      expect(json_response["error"]).to include("Failed to process payments")
    end

    it "handles unexpected errors" do
      allow(PayAllDividendsJob).to receive(:perform_async).and_raise(StandardError.new("Job queue error"))

      post :process_payments, params: { company_id: company.external_id, id: dividend_round.id }

      expect(response).to have_http_status(:internal_server_error)
      json_response = response.parsed_body
      expect(json_response["error"]).to eq("Failed to process payments")
    end

    it "authorizes the request with update action" do
      expect(controller).to receive(:authorize).with(dividend_round, :update?)
      post :process_payments, params: { company_id: company.external_id, id: dividend_round.id }
    end
  end
end
