# frozen_string_literal: true

RSpec.describe Internal::Companies::InvoicesController do
  let(:company) { create(:company) }
  let(:company_administrator) { create(:company_administrator, company:) }
  let(:contractor) { create(:company_worker, company:) }
  let(:user) { contractor.user }

  before do
    allow(controller).to receive(:current_context) do
      Current.user = user
      Current.company = company
      Current.company_worker = contractor
      CurrentContext.new(user:, company:)
    end
  end

  describe "POST #create" do
    it "returns success: true on valid create with 200 JSON" do
      post :create, params: {
        company_id: company.external_id,
        invoice: {
          invoice_date: Date.current.to_s,
          invoice_number: "INV-123",
          notes: "n",
        },
        invoice_line_items: [
          { description: "Work", pay_rate_in_subunits: contractor.pay_rate_in_subunits, quantity: 1, hourly: true },
        ],
      }

      expect(response).to have_http_status(:created)
    end

    it "returns success: false with form_errors on duplicate invoice number" do
      create(:invoice, company:, user:, company_worker: contractor, invoice_number: "INV-123")

      post :create, params: {
        company_id: company.external_id,
        invoice: {
          invoice_date: Date.current.to_s,
          invoice_number: "INV-123",
          notes: "n",
        },
        invoice_line_items: [
          { description: "Work", pay_rate_in_subunits: contractor.pay_rate_in_subunits, quantity: 1, hourly: true },
        ],
      }

      expect(response).to have_http_status(:unprocessable_entity)
      body = response.parsed_body
      expect(body["error_message"]).to be_present
      expect(body["form_errors"]).to be_an(Array)
      expect(body["form_errors"].map { |e| e["path"] }).to include("invoice_number")
      msg = body["form_errors"].find { |e| e["path"] == "invoice_number" }["message"]
      expect(msg).to include("already in use")
    end
  end

  describe "PATCH #update" do
    let!(:invoice) { create(:invoice, company:, user:, company_worker: contractor, invoice_number: "INV-100") }

    it "returns success: true on valid update with 200 JSON" do
      patch :update, params: {
        company_id: company.external_id,
        id: invoice.external_id,
        invoice: { notes: "updated" },
        invoice_line_items: [
          { description: "Work", pay_rate_in_subunits: contractor.pay_rate_in_subunits, quantity: 1, hourly: true },
        ],
      }

      expect(response).to have_http_status(:no_content)
    end

    it "returns success: false with form_errors on duplicate invoice number" do
      create(:invoice, company:, user:, company_worker: contractor, invoice_number: "INV-200")

      patch :update, params: {
        company_id: company.external_id,
        id: invoice.external_id,
        invoice: { invoice_number: "INV-200" },
      }

      expect(response).to have_http_status(:unprocessable_entity)
      body = response.parsed_body
      expect(body["error_message"]).to be_present
      expect(body["form_errors"]).to be_an(Array)
      expect(body["form_errors"].map { |e| e["path"] }).to include("invoice_number")
    end
  end
end
