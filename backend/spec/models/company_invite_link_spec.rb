# frozen_string_literal: true

RSpec.describe CompanyInviteLink do
  let(:company) { create(:company) }

  describe "associations" do
    it { is_expected.to belong_to(:company) }
  end

  describe "validations" do
    it { is_expected.to validate_presence_of(:company_id) }

    subject { build(:company_invite_link, company: company, token: "unique_token") }

    it "generates a token on create" do
      invite_link = described_class.create!(company: company)
      expect(invite_link.token).to be_present
    end

    it "does not allow duplicate tokens" do
      invite_link1 = described_class.create!(company: company)
      invite_link2 = described_class.new(company: company, token: invite_link1.token)
      expect(invite_link2).not_to be_valid
      expect(invite_link2.errors[:token]).to include("has already been taken")
    end

    context "when another invite exists for the same company and document_template_id" do
      let(:document_template_id) { nil }
      before { create(:company_invite_link, company: company, document_template_id: document_template_id) }

      it "is not valid" do
        dup = described_class.new(company: company, document_template_id: document_template_id)
        expect(dup).not_to be_valid
      end
    end
  end

  describe "#reset!" do
    it "changes the token" do
      invite_link = described_class.create!(company: company)
      old_token = invite_link.token
      invite_link.reset!
      expect(invite_link.token).not_to eq(old_token)
    end
  end
end
