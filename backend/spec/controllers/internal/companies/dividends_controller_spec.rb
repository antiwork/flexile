# frozen_string_literal: true

RSpec.describe Internal::Companies::DividendsController do
  let(:company) { create(:company) }
  let(:admin_user) { create(:user) }
  let(:company_administrator) { create(:company_administrator, company: company, user: admin_user) }
  let(:company_investor) { create(:company_investor, company: company, user: admin_user) }
  let(:dividend_round) { create(:dividend_round, company: company) }
  let(:dividend) { create(:dividend, dividend_round: dividend_round, company_investor: company_investor) }

  before do
    allow(controller).to receive(:authenticate_user_json!).and_return(true)

    Current.user = admin_user
    Current.company = company
    Current.company_administrator = company_administrator
    Current.company_investor = company_investor

    allow(controller).to receive(:current_context) do
      Current.user = admin_user
      Current.company = company
      Current.company_administrator = company_administrator
      Current.company_investor = company_investor
      CurrentContext.new(user: admin_user, company: company)
    end
  end

  describe "POST #mark_ready" do
    let!(:draft_dividend) { create(:dividend, dividend_round: dividend_round, company_investor: company_investor, status: Dividend::CREATED) }

    it "marks dividend as ready for payment" do
      post :mark_ready, params: { company_id: company.external_id, id: draft_dividend.id }

      expect(response).to have_http_status(:ok)
      json_response = response.parsed_body

      expect(json_response["success"]).to be true
      expect(json_response["dividend_id"]).to eq(draft_dividend.id)
      expect(json_response["status"]).to eq(Dividend::ISSUED)

      draft_dividend.reload
      expect(draft_dividend.status).to eq(Dividend::ISSUED)
    end

    it "returns 404 for non-existent dividend" do
      post :mark_ready, params: { company_id: company.external_id, id: 999999 }

      expect(response).to have_http_status(:not_found)
    end

    it "handles update failures" do
      allow_any_instance_of(Dividend).to receive(:update!).and_raise(ActiveRecord::RecordInvalid.new(Dividend.new))

      post :mark_ready, params: { company_id: company.external_id, id: dividend.id }

      expect(response).to have_http_status(:unprocessable_entity)
      json_response = response.parsed_body
      expect(json_response["error"]).to include("Failed to mark dividend ready")
    end

    it "authorizes the request with update action" do
      expect(controller).to receive(:authorize).with(an_instance_of(Dividend), :update?)
      post :mark_ready, params: { company_id: company.external_id, id: dividend.id }
    end

    context "when called as admin (find_dividend_for_admin)" do
      it "finds dividend by company rather than company_investor" do
        other_investor = create(:company_investor, company: company)
        other_dividend = create(:dividend, dividend_round: dividend_round, company_investor: other_investor)

        post :mark_ready, params: { company_id: company.external_id, id: other_dividend.id }

        expect(response).to have_http_status(:ok)
        json_response = response.parsed_body
        expect(json_response["dividend_id"]).to eq(other_dividend.id)
      end
    end
  end

  describe "POST #retry_payment" do
    let!(:failed_dividend) { create(:dividend, dividend_round: dividend_round, company_investor: company_investor, status: Dividend::RETAINED) }

    before do
      allow(InvestorDividendsPaymentJob).to receive(:perform_async)
    end

    it "resets failed dividend and queues payment job" do
      post :retry_payment, params: { company_id: company.external_id, id: failed_dividend.id }

      expect(response).to have_http_status(:ok)
      json_response = response.parsed_body

      expect(json_response["success"]).to be true
      expect(json_response["dividend_id"]).to eq(failed_dividend.id)
      expect(json_response["status"]).to eq(Dividend::ISSUED)
      expect(json_response["message"]).to eq("Payment retry queued")

      failed_dividend.reload
      expect(failed_dividend.status).to eq(Dividend::ISSUED)
      expect(failed_dividend.retained_reason).to be_nil

      expect(InvestorDividendsPaymentJob).to have_received(:perform_async).with(company_investor.id)
    end

    it "returns 404 for non-existent dividend" do
      post :retry_payment, params: { company_id: company.external_id, id: 999999 }

      expect(response).to have_http_status(:not_found)
    end

    it "handles update failures" do
      allow_any_instance_of(Dividend).to receive(:update!).and_raise(ActiveRecord::RecordInvalid.new(Dividend.new))

      post :retry_payment, params: { company_id: company.external_id, id: failed_dividend.id }

      expect(response).to have_http_status(:unprocessable_entity)
      json_response = response.parsed_body
      expect(json_response["error"]).to include("Failed to retry payment")
    end

    it "handles job queue failures" do
      allow(InvestorDividendsPaymentJob).to receive(:perform_async).and_raise(StandardError.new("Job queue error"))

      post :retry_payment, params: { company_id: company.external_id, id: failed_dividend.id }

      expect(response).to have_http_status(:internal_server_error)
      json_response = response.parsed_body
      expect(json_response["error"]).to eq("Failed to retry payment")
    end

    it "authorizes the request with update action" do
      expect(controller).to receive(:authorize).with(an_instance_of(Dividend), :update?)
      post :retry_payment, params: { company_id: company.external_id, id: failed_dividend.id }
    end
  end

  describe "GET #show" do
    # Test the existing show action to ensure our new methods don't break existing functionality
    it "shows dividend details for company investor" do
      get :show, params: { company_id: company.external_id, id: dividend.id }

      expect(response).to have_http_status(:ok)
      json_response = response.parsed_body
      expect(json_response["id"]).to eq(dividend.id)
    end

    it "authorizes the dividend" do
      expect(controller).to receive(:authorize).with(dividend)
      get :show, params: { company_id: company.external_id, id: dividend.id }
    end
  end

  describe "POST #sign" do
    let!(:unsigned_dividend) { create(:dividend, dividend_round: dividend_round, company_investor: company_investor, signed_release_at: nil) }

    before do
      # Create a dividend round with release document
      dividend_round.update!(release_document: "Release agreement for {{investor}} - Amount: {{amount}}")

      # Mock the PDF creation and document services
      allow(CreatePdf).to receive(:new).and_return(double(perform: "mock_pdf_content"))
      allow_any_instance_of(ActionText::RichText).to receive(:attach)
    end

    it "signs the dividend release" do
      expect do
        post :sign, params: { company_id: company.external_id, id: unsigned_dividend.id }
      end.to change(Document, :count).by(1)
       .and change(DocumentSignature, :count).by(1)

      expect(response).to have_http_status(:no_content)

      unsigned_dividend.reload
      expect(unsigned_dividend.signed_release_at).to be_present
    end
  end

  describe "private method #find_dividend_for_admin" do
    it "finds dividends by company scope for admin actions" do
      other_investor = create(:company_investor, company: company)
      other_dividend = create(:dividend, dividend_round: dividend_round, company_investor: other_investor)

      # This tests that admin actions can access dividends from any investor in the company
      post :mark_ready, params: { company_id: company.external_id, id: other_dividend.id }

      expect(response).to have_http_status(:ok)
      json_response = response.parsed_body
      expect(json_response["dividend_id"]).to eq(other_dividend.id)
    end
  end
end
