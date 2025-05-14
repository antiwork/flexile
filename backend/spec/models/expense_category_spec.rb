# frozen_string_literal: true

RSpec.describe ExpenseCategory do
  describe "associations" do
    it { is_expected.to belong_to(:company) }
    it { is_expected.to have_many(:invoice_expenses) }
  end

  describe "validations" do
    it { is_expected.to validate_presence_of(:name) }
    it { is_expected.to validate_presence_of(:company) }
  end
end
