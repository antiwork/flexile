# frozen_string_literal: true

RSpec.describe CompanyUpdatesFinancialReport, type: :model do
  describe "associations" do
    it { is_expected.to belong_to(:company_update) }
    it { is_expected.to belong_to(:company_monthly_financial_report) }
  end
end
