# frozen_string_literal: true

RSpec.describe ConsolidatedPaymentBalanceTransaction do
  describe "associations" do
    it { is_expected.to belong_to(:consolidated_payment).optional(false) }
  end
end
