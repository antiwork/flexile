# frozen_string_literal: true

RSpec.describe CompanyRole do
  it { is_expected.to belong_to(:company) }
  it { is_expected.to have_many(:company_workers) }
  it { is_expected.to have_many(:expense_cards) }
  it { is_expected.to have_one(:rate).conditions(order: { id: :desc }).class_name("CompanyRoleRate").required(true).autosave(true) }

  it { is_expected.to validate_presence_of(:company_id) }
  it { is_expected.to validate_presence_of(:name) }

  describe "concerns" do
    it "includes Deletable" do
      expect(described_class.ancestors).to include(Deletable)
    end
  end

  describe "validations" do
    it "prevents deleting the role if it still has active contractors associated" do
      company_role = create(:company_role)
      contractor = create(:company_worker, company_role:)
      company_role.update(deleted_at: Date.yesterday)
      expect(company_role.errors.full_messages).to eq ["Cannot delete role with active contractors"]

      contractor.update!(ended_at: Date.yesterday)
      company_role.update(deleted_at: Date.yesterday)
      expect(company_role.valid?).to eq true
    end
  end

  describe "delegations" do
    it { is_expected.to delegate_method(:pay_rate_in_subunits).to(:rate) }
    it { is_expected.to delegate_method(:pay_rate_type).to(:rate) }
    it { is_expected.to delegate_method(:hourly?).to(:rate) }
    it { is_expected.to delegate_method(:project_based?).to(:rate) }
    it { is_expected.to delegate_method(:salary?).to(:rate) }
  end

  describe "#expense_card_has_limit?" do
    it "returns true if expense card spending limit is greater than 0, false otherwise" do
      role = build(:company_role, expense_card_spending_limit_cents: 100_00)
      expect(role.expense_card_has_limit?).to eq true

      role.expense_card_spending_limit_cents = 0
      expect(role.expense_card_has_limit?).to eq false
    end
  end
end
