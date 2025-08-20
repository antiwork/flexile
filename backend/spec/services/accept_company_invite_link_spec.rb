# frozen_string_literal: true

RSpec.describe AcceptCompanyInviteLink do
  let!(:company) { create(:company, invite_link: "token") }
  let(:user) { create(:user) }

  describe "#perform" do
    context "when the token is invalid" do
      it "returns error" do
        result = described_class.new(token: "badtoken", user: user).perform
        expect(result[:success]).to eq(false)
        expect(result[:error]).to eq("Invalid invite link")
      end
    end

    context "when the invite is valid" do
      it "creates a company_worker" do
        result = described_class.new(token: "token", user: user).perform
        expect(result[:success]).to eq(true)
        expect(result[:company]).to eq(company)
        expect(user.clients).to include(company)
      end
    end

    context "when the user is already a worker" do
      before { described_class.new(token: "token", user: user).perform }
      it "does not allow duplicate company_worker" do
        result = described_class.new(token: "token", user: user).perform
        expect(result[:success]).to eq(false)
        expect(result[:error]).to match(/already a worker/)
      end
    end

    context "when user or company_worker has errors" do
      it "returns error" do
        allow_any_instance_of(CompanyWorker).to receive(:save).and_return(false)
        result = described_class.new(token: "token", user: user).perform
        expect(result[:success]).to eq(false)
      end
    end
  end
end
