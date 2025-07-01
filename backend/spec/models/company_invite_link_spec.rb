# frozen_string_literal: true

RSpec.describe CompanyInviteLink do
  let(:company) { create(:company) }
  let(:inviter) { create(:user) }

  describe "associations" do
    it { is_expected.to belong_to(:company) }
    it { is_expected.to belong_to(:inviter).class_name("User") }
  end

  describe "validations" do
    it { is_expected.to validate_presence_of(:company_id) }
    it { is_expected.to validate_presence_of(:inviter_id) }

    subject { build(:company_invite_link, company: company, inviter: inviter, token: "unique_token") }

    it "generates a token on create" do
      invite_link = described_class.create!(company: company, inviter: inviter)
      expect(invite_link.token).to be_present
    end

    it "does not allow duplicate tokens" do
      invite_link1 = described_class.create!(company: company, inviter: inviter)
      invite_link2 = described_class.new(company: company, inviter: inviter, token: invite_link1.token)
      expect(invite_link2).not_to be_valid
      expect(invite_link2.errors[:token]).to include("has already been taken")
    end

    context "when another invite exists for the same company, inviter, and document_template_id" do
      let(:document_template_id) { nil }
      before { create(:company_invite_link, company: company, inviter: inviter, document_template_id: document_template_id) }

      it "is not valid" do
        dup = described_class.new(company: company, inviter: inviter, document_template_id: document_template_id)
        expect(dup).not_to be_valid
        expect(dup.errors[:base]).to include("An invite for this company, inviter, and document template already exists")
      end
    end
  end

  describe "#reset!" do
    it "changes the token" do
      invite_link = described_class.create!(company: company, inviter: inviter)
      old_token = invite_link.token
      invite_link.reset!
      expect(invite_link.token).not_to eq(old_token)
    end
  end
end
