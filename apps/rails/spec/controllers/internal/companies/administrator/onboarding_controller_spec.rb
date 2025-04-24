
require "rails_helper"

RSpec.describe Internal::Companies::Administrator::OnboardingController, type: :controller do
  describe "#update" do
    let(:user) { create(:user) }
    let(:company_params) do
      {
        name: "Test Company",
        street_address: "123 Test St",
        city: "Test City",
        state: "TS",
        zip_code: "12345"
      }
    end
    let(:legal_name) { "Test User" }

    before do
      allow(Current).to receive(:user).and_return(user)
      allow(user).to receive(:initial_onboarding?).and_return(true)
      allow(ENV).to receive(:[]).with("RESEND_AUDIENCE_ID").and_return("test-audience-id")
      allow(Rails.logger).to receive(:error)
    end

    context "when Resend API call succeeds" do
      it "subscribes the administrator to the newsletter" do
        expect(Resend::Contacts).to receive(:create).with(
          audience_id: "test-audience-id",
          email: user.email,
          unsubscribed: false
        )

        post :update, params: { company: company_params, legal_name: legal_name }
        expect(response).to have_http_status(:success)
      end
    end

    context "when Resend API call fails" do
      let(:api_error) { StandardError.new("API Error") }

      before do
        allow(Resend::Contacts).to receive(:create).and_raise(api_error)
        allow(Bugsnag).to receive(:notify)
      end

      it "logs the error and notifies Bugsnag" do
        expect(Rails.logger).to receive(:error).with("Failed to subscribe administrator to Resend: API Error")
        
        expect(Bugsnag).to receive(:notify).with(api_error) do |&block|
          event = double("event")
          expect(event).to receive(:add_metadata).with(:resend, {
            action: "subscribe_administrator_to_newsletter",
            email: user.email,
            audience_id: "test-audience-id"
          })
          block.call(event)
        end

        post :update, params: { company: company_params, legal_name: legal_name }
      end

      it "completes the controller action successfully despite API errors" do
        post :update, params: { company: company_params, legal_name: legal_name }
        expect(response).to have_http_status(:success)
      end
    end

    context "when RESEND_AUDIENCE_ID is not set" do
      before do
        allow(ENV).to receive(:[]).with("RESEND_AUDIENCE_ID").and_return(nil)
      end

      it "does not call the Resend API" do
        expect(Resend::Contacts).not_to receive(:create)
        post :update, params: { company: company_params, legal_name: legal_name }
        expect(response).to have_http_status(:success)
      end
    end
  end
end
