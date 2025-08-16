# frozen_string_literal: true

RSpec.describe DividendComputationPolicy do
  let(:company) { create(:company) }
  let(:dividend_computation) { create(:dividend_computation, company: company) }

  let(:admin_user) { create(:user) }
  let(:lawyer_user) { create(:user) }
  let(:investor_user) { create(:user) }
  let(:worker_user) { create(:user) }

  let!(:admin_company_user) { create(:company_administrator, company: company, user: admin_user) }
  let!(:lawyer_company_user) { create(:company_lawyer, company: company, user: lawyer_user) }
  let!(:investor_company_user) { create(:company_investor, company: company, user: investor_user) }
  let!(:worker_company_user) { create(:company_worker, company: company, user: worker_user) }

  let(:admin_context) { CurrentContext.new(user: admin_user, company: company) }
  let(:lawyer_context) { CurrentContext.new(user: lawyer_user, company: company) }
  let(:investor_context) { CurrentContext.new(user: investor_user, company: company) }
  let(:worker_context) { CurrentContext.new(user: worker_user, company: company) }
  let(:nil_context) { CurrentContext.new(user: nil, company: company) }

  describe "#index?" do
    it "allows access for company administrators" do
      policy = described_class.new(admin_context, dividend_computation)
      expect(policy.index?).to be true
    end

    it "allows access for company lawyers" do
      policy = described_class.new(lawyer_context, dividend_computation)
      expect(policy.index?).to be true
    end

    it "denies access for company investors" do
      policy = described_class.new(investor_context, dividend_computation)
      expect(policy.index?).to be false
    end

    it "denies access for company workers" do
      policy = described_class.new(worker_context, dividend_computation)
      expect(policy.index?).to be false
    end

    it "denies access when user is nil" do
      policy = described_class.new(nil_context, dividend_computation)
      expect(policy.index?).to be false
    end
  end

  describe "#show?" do
    it "allows access for company administrators" do
      policy = described_class.new(admin_context, dividend_computation)
      expect(policy.show?).to be true
    end

    it "allows access for company lawyers" do
      policy = described_class.new(lawyer_context, dividend_computation)
      expect(policy.show?).to be true
    end

    it "denies access for company investors" do
      policy = described_class.new(investor_context, dividend_computation)
      expect(policy.show?).to be false
    end

    it "denies access for company workers" do
      policy = described_class.new(worker_context, dividend_computation)
      expect(policy.show?).to be false
    end

    it "denies access when user is nil" do
      policy = described_class.new(nil_context, dividend_computation)
      expect(policy.show?).to be false
    end
  end

  describe "#create?" do
    it "allows access for company administrators" do
      policy = described_class.new(admin_context, dividend_computation)
      expect(policy.create?).to be true
    end

    it "allows access for company lawyers" do
      policy = described_class.new(lawyer_context, dividend_computation)
      expect(policy.create?).to be true
    end

    it "denies access for company investors" do
      policy = described_class.new(investor_context, dividend_computation)
      expect(policy.create?).to be false
    end

    it "denies access for company workers" do
      policy = described_class.new(worker_context, dividend_computation)
      expect(policy.create?).to be false
    end

    it "denies access when user is nil" do
      policy = described_class.new(nil_context, dividend_computation)
      expect(policy.create?).to be false
    end
  end

  describe "#update?" do
    it "allows access for company administrators" do
      policy = described_class.new(admin_context, dividend_computation)
      expect(policy.update?).to be true
    end

    it "allows access for company lawyers" do
      policy = described_class.new(lawyer_context, dividend_computation)
      expect(policy.update?).to be true
    end

    it "denies access for company investors" do
      policy = described_class.new(investor_context, dividend_computation)
      expect(policy.update?).to be false
    end

    it "denies access for company workers" do
      policy = described_class.new(worker_context, dividend_computation)
      expect(policy.update?).to be false
    end

    it "denies access when user is nil" do
      policy = described_class.new(nil_context, dividend_computation)
      expect(policy.update?).to be false
    end
  end

  describe "#destroy?" do
    it "allows access for company administrators" do
      policy = described_class.new(admin_context, dividend_computation)
      expect(policy.destroy?).to be true
    end

    it "allows access for company lawyers" do
      policy = described_class.new(lawyer_context, dividend_computation)
      expect(policy.destroy?).to be true
    end

    it "denies access for company investors" do
      policy = described_class.new(investor_context, dividend_computation)
      expect(policy.destroy?).to be false
    end

    it "denies access for company workers" do
      policy = described_class.new(worker_context, dividend_computation)
      expect(policy.destroy?).to be false
    end

    it "denies access when user is nil" do
      policy = described_class.new(nil_context, dividend_computation)
      expect(policy.destroy?).to be false
    end
  end

  describe "#preview?" do
    it "allows access for company administrators" do
      policy = described_class.new(admin_context, dividend_computation)
      expect(policy.preview?).to be true
    end

    it "allows access for company lawyers" do
      policy = described_class.new(lawyer_context, dividend_computation)
      expect(policy.preview?).to be true
    end

    it "denies access for company investors" do
      policy = described_class.new(investor_context, dividend_computation)
      expect(policy.preview?).to be false
    end

    it "denies access for company workers" do
      policy = described_class.new(worker_context, dividend_computation)
      expect(policy.preview?).to be false
    end

    it "denies access when user is nil" do
      policy = described_class.new(nil_context, dividend_computation)
      expect(policy.preview?).to be false
    end
  end

  describe "#finalize?" do
    it "allows access for company administrators" do
      policy = described_class.new(admin_context, dividend_computation)
      expect(policy.finalize?).to be true
    end

    it "allows access for company lawyers" do
      policy = described_class.new(lawyer_context, dividend_computation)
      expect(policy.finalize?).to be true
    end

    it "denies access for company investors" do
      policy = described_class.new(investor_context, dividend_computation)
      expect(policy.finalize?).to be false
    end

    it "denies access for company workers" do
      policy = described_class.new(worker_context, dividend_computation)
      expect(policy.finalize?).to be false
    end

    it "denies access when user is nil" do
      policy = described_class.new(nil_context, dividend_computation)
      expect(policy.finalize?).to be false
    end
  end

  describe "#export_csv?" do
    it "allows access for company administrators" do
      policy = described_class.new(admin_context, dividend_computation)
      expect(policy.export_csv?).to be true
    end

    it "allows access for company lawyers" do
      policy = described_class.new(lawyer_context, dividend_computation)
      expect(policy.export_csv?).to be true
    end

    it "denies access for company investors" do
      policy = described_class.new(investor_context, dividend_computation)
      expect(policy.export_csv?).to be false
    end

    it "denies access for company workers" do
      policy = described_class.new(worker_context, dividend_computation)
      expect(policy.export_csv?).to be false
    end

    it "denies access when user is nil" do
      policy = described_class.new(nil_context, dividend_computation)
      expect(policy.export_csv?).to be false
    end
  end

  context "when user belongs to different company" do
    let(:other_company) { create(:company) }
    let(:other_admin_user) { create(:user) }
    let!(:other_admin_company_user) { create(:company_administrator, company: other_company, user: other_admin_user) }
    let(:other_admin_context) { CurrentContext.new(user: other_admin_user, company: company) }

    it "denies access for admin from different company" do
      policy = described_class.new(other_admin_context, dividend_computation)
      expect(policy.index?).to be false
    end
  end
end
