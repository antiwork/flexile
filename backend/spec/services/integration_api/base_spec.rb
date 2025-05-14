# frozen_string_literal: true

RSpec.describe IntegrationApi::Base do
  let(:company) { create(:company) }
  let(:state) { Base64.strict_encode64("#{company.external_id}:#{company.name}") }

  subject(:client) { described_class.new(company_id: company.id) }

  describe "delegations" do
    it { is_expected.to delegate_method(:account_id).to(:integration).allow_nil }
    it { is_expected.to delegate_method(:access_token).to(:integration).allow_nil }
  end

  describe "#valid_oauth_state?" do
    it "returns true if the state is valid" do
      expect(client.send(:valid_oauth_state?, state)).to eq(true)
    end

    it "returns false if the state is invalid" do
      expect(client.send(:valid_oauth_state?, Base64.strict_encode64("invalid"))).to eq(false)
    end
  end
end
