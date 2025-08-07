# frozen_string_literal: true

RSpec.describe VestingReportEmailBody do
  let(:company) { create(:company, name: "TestCo") }
  let(:user) { create(:user, legal_name: "John Doe") }
  let(:company_investor) { create(:company_investor, company: company, user: user) }
  let(:equity_grant) { create(:equity_grant, company_investor: company_investor) }

  let(:target_date) { Date.new(2024, 6, 15) }
  let(:target_year) { target_date.year }
  let(:target_month) { target_date.month }

  describe "#generate" do
    it "generates email body with vesting information" do
      create(:vesting_event,
             equity_grant: equity_grant,
             vesting_date: target_date,
             processed_at: target_date + 1.day,
             vested_shares: 1000,
             cancelled_at: nil)

      body = described_class.new(company, target_year, target_month).generate

      expect(body).to include("June 2024:")
      expect(body).to include("John Doe, 1000")
    end

    it "returns message when no vesting events exist" do
      body = described_class.new(company, target_year, target_month).generate

      expect(body).to eq("No vesting events for June 2024.")
    end

    it "groups multiple vesting events by person" do
      create(:vesting_event,
             equity_grant: equity_grant,
             vesting_date: target_date,
             processed_at: target_date + 1.day,
             vested_shares: 1000,
             cancelled_at: nil)

      create(:vesting_event,
             equity_grant: equity_grant,
             vesting_date: target_date + 5.days,
             processed_at: target_date + 6.days,
             vested_shares: 500,
             cancelled_at: nil)

      body = described_class.new(company, target_year, target_month).generate

      expect(body).to include("June 2024:")
      expect(body).to include("John Doe, 1500")
    end
  end
end
