# frozen_string_literal: true

RSpec.describe ConsolidatedInvoicesInvoice do
  describe "associations" do
    it { is_expected.to belong_to(:consolidated_invoice) }
    it { is_expected.to belong_to(:invoice) }
  end
end
