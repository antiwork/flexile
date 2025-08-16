# frozen_string_literal: true

RSpec.describe PaymentAccountPolicy do
  let(:company) { create(:company) }
  let(:admin_user) { create(:user, without_bank_account: true) }
  let(:lawyer_user) { create(:user, without_bank_account: true) }
  let(:regular_user) { create(:user, without_bank_account: true) }

  let(:admin_company_user) { create(:company_administrator, company: company, user: admin_user) }
  let(:lawyer_company_user) { create(:company_lawyer, company: company, user: lawyer_user) }
  let(:regular_company_user) { create(:company_investor, company: company, user: regular_user) }
  let(:admin_context) { CurrentContext.new(user: admin_user, company: company) }
  let(:lawyer_context) { CurrentContext.new(user: lawyer_user, company: company) }
  let(:regular_context) { CurrentContext.new(user: regular_user, company: company) }
  let(:nil_context) { CurrentContext.new(user: nil, company: company) }

  describe "#index?" do
    context "when user is an admin" do
      before { admin_company_user }

      it "allows access" do
        policy = described_class.new(admin_context, :payment_account)
        expect(policy.index?).to be true
      end
    end

    context "when user is a lawyer" do
      before { lawyer_company_user }

      it "allows access" do
        policy = described_class.new(lawyer_context, :payment_account)
        expect(policy.index?).to be true
      end
    end

    context "when user is neither admin nor lawyer" do
      before { regular_company_user }

      it "denies access" do
        policy = described_class.new(regular_context, :payment_account)
        expect(policy.index?).to be false
      end
    end

    context "when user is nil" do
      it "denies access" do
        policy = described_class.new(nil_context, :payment_account)
        expect(policy.index?).to be false
      end
    end
  end

  describe "#update?" do
    context "when user is an admin" do
      before { admin_company_user }

      it "allows access" do
        policy = described_class.new(admin_context, :payment_account)
        expect(policy.update?).to be true
      end
    end

    context "when user is a lawyer" do
      before { lawyer_company_user }

      it "allows access" do
        policy = described_class.new(lawyer_context, :payment_account)
        expect(policy.update?).to be true
      end
    end

    context "when user is neither admin nor lawyer" do
      before { regular_company_user }

      it "denies access" do
        policy = described_class.new(regular_context, :payment_account)
        expect(policy.update?).to be false
      end
    end

    context "when user is nil" do
      it "denies access" do
        policy = described_class.new(nil_context, :payment_account)
        expect(policy.update?).to be false
      end
    end
  end
end