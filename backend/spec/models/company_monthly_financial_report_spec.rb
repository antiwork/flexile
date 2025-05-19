# frozen_string_literal: true

RSpec.describe CompanyMonthlyFinancialReport do
  describe "associations" do
    it { is_expected.to belong_to(:company) }
  end

  describe "validations" do
    it { is_expected.to validate_presence_of(:year) }
    it { is_expected.to validate_presence_of(:month) }
    it { is_expected.to validate_presence_of(:net_income_cents) }
    it { is_expected.to validate_presence_of(:revenue_cents) }

    context "when another record exists" do
      let(:company) { create(:company) }

      before { create(:company_monthly_financial_report, company:) }

      it do
        is_expected.to(
          validate_uniqueness_of(:company_id)
            .scoped_to(:year, :month)
            .with_message("must have only one record per company, year, and month")
        )
      end
    end
  end
end
