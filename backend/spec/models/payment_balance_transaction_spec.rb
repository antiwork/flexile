# frozen_string_literal: true

RSpec.describe PaymentBalanceTransaction do
  describe "associations" do
    it { is_expected.to belong_to(:payment).optional(false) }
  end
end
