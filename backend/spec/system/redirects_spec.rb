# frozen_string_literal: true

RSpec.describe "Redirects specs" do
  describe "contractor invitation" do
    it "redirects to the correct path" do
      get "/onboarding/invitation", params: { invitation_token: "123" }
      expect(response).to redirect_to("/companies/_/worker/onboarding/invitation?invitation_token=123")
    end
  end

  describe "investor invitation" do
    it "redirects to the correct path" do
      get "/investor_onboarding/invitation", params: { invitation_token: "123" }
      expect(response).to redirect_to("/companies/_/investor/onboarding/invitation?invitation_token=123")
    end
  end

  describe "lawyer invitation" do
    it "redirects to the correct path" do
      get "/lawyer_onboarding/invitation", params: { invitation_token: "123" }
      expect(response).to redirect_to("/companies/_/lawyer/onboarding/invitation?invitation_token=123")
    end
  end
end
