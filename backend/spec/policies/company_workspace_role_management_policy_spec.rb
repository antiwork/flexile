# frozen_string_literal: true

RSpec.describe CompanyWorkspaceRoleManagementPolicy do
  let(:company) { create(:company) }
  let(:admin_user) { create(:user) }
  let(:regular_user) { create(:user) }
  let(:lawyer_user) { create(:user) }

  let!(:company_administrator) { create(:company_administrator, user: admin_user, company: company) }
  let!(:company_lawyer) { create(:company_lawyer, user: lawyer_user, company: company) }

  describe "when user is a company administrator" do
    let(:current_context) { CurrentContext.new(user: admin_user, company: company) }
    subject(:policy) { described_class.new(current_context, company) }

    it "grants member management permissions for valid roles" do
      expect(policy.invite_workspace_members?("admin")).to be true
      expect(policy.invite_workspace_members?("lawyer")).to be true
    end

    it "denies managing invalid roles" do
      expect(policy.invite_workspace_members?("invalid_role")).to be false
    end
  end

  describe "when user is a regular company member" do
    let(:current_context) { CurrentContext.new(user: regular_user, company: company) }
    subject(:policy) { described_class.new(current_context, company) }

    it "denies all member management permissions" do
      expect(policy.invite_workspace_members?("admin")).to be false
      expect(policy.invite_workspace_members?("lawyer")).to be false
    end
  end

  describe "when user is a company lawyer" do
    let(:current_context) { CurrentContext.new(user: lawyer_user, company: company) }
    subject(:policy) { described_class.new(current_context, company) }

    it "denies member management permissions" do
      expect(policy.invite_workspace_members?("admin")).to be false
      expect(policy.invite_workspace_members?("lawyer")).to be false
    end
  end

  describe "when user is nil" do
    let(:current_context) { CurrentContext.new(user: nil, company: company) }
    subject(:policy) { described_class.new(current_context, company) }

    it "denies all permissions" do
      expect(policy.invite_workspace_members?("admin")).to be false
      expect(policy.invite_workspace_members?("lawyer")).to be false
    end
  end
end
