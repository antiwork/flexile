# frozen_string_literal: true

RSpec.describe VestingReportCsv do
  let(:company) { create(:company, name: "TestCo") }
  let(:user1) { create(:user, legal_name: "John Doe") }
  let(:user2) { create(:user, legal_name: "Jane Smith") }
  let(:company_investor1) { create(:company_investor, company: company, user: user1) }
  let(:company_investor2) { create(:company_investor, company: company, user: user2) }
  let(:equity_grant1) { create(:equity_grant, company_investor: company_investor1) }
  let(:equity_grant2) { create(:equity_grant, company_investor: company_investor2) }

  let(:target_date) { Date.new(2024, 6, 15) }
  let(:target_year) { target_date.year }
  let(:target_month) { target_date.month }

  before do
    create(:vesting_event,
           equity_grant: equity_grant1,
           vesting_date: target_date,
           processed_at: target_date + 1.day,
           vested_shares: 1000,
           cancelled_at: nil)

    create(:vesting_event,
           equity_grant: equity_grant2,
           vesting_date: target_date + 5.days,
           processed_at: target_date + 6.days,
           vested_shares: 500,
           cancelled_at: nil)
  end

  describe "#generate" do
    it "generates a CSV with correct headers and data" do
      csv = described_class.new(company, target_year, target_month).generate
      rows = CSV.parse(csv)

      expect(rows[0]).to eq VestingReportCsv::HEADERS
      expect(rows.length).to eq 3

      data_rows = rows[1..-1]
      expect(data_rows).to include(["June 2024", "John Doe", "1000"])
      expect(data_rows).to include(["June 2024", "Jane Smith", "500"])
    end

    it "groups vesting events by person and sums shares" do
      create(:vesting_event,
             equity_grant: equity_grant1,
             vesting_date: target_date + 10.days,
             processed_at: target_date + 11.days,
             vested_shares: 250,
             cancelled_at: nil)

      csv = described_class.new(company, target_year, target_month).generate
      rows = CSV.parse(csv)

      data_rows = rows[1..-1]
      expect(data_rows).to include(["June 2024", "John Doe", "1250"])
      expect(data_rows).to include(["June 2024", "Jane Smith", "500"])
    end

    it "excludes cancelled and unprocessed vesting events" do
      create(:vesting_event,
             equity_grant: equity_grant1,
             vesting_date: target_date,
             processed_at: nil,
             vested_shares: 999,
             cancelled_at: nil)

      create(:vesting_event,
             equity_grant: equity_grant1,
             vesting_date: target_date,
             processed_at: target_date + 1.day,
             vested_shares: 888,
             cancelled_at: Time.current)

      csv = described_class.new(company, target_year, target_month).generate
      rows = CSV.parse(csv)

      expect(rows.length).to eq 3
    end
  end
end
