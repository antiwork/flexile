# frozen_string_literal: true

RSpec.describe Onetime::BackfillCsvDividendInvestmentAmounts do
  let(:company) { create(:company) }
  let(:dividend_round) { create(:dividend_round, company:, issued_at: 1.day.ago) }

  def build_csv(*rows)
    headers = "name,full_legal_name,investment_address_1,investment_address_2,investment_address_city,investment_address_region,investment_address_postal_code,investment_address_country,email,investment_date,investment_amount,tax_id,entity_name,dividend_amount"
    ([headers] + rows).join("\n")
  end

  def csv_row(email:, legal_name:, investment_amount:, dividend_amount: "100")
    "#{legal_name.split.first},#{legal_name},123 Main St,,New York,NY,10001,US,#{email},1/1/23,\"#{investment_amount}\",000-00-0000,,#{dividend_amount}"
  end

  describe ".perform" do
    context "matches by email" do
      let(:user) { create(:user, email: "investor@example.com") }
      let(:company_investor) { create(:company_investor, user:, company:) }
      let!(:dividend) do
        create(:dividend,
               company:,
               company_investor:,
               dividend_round:,
               number_of_shares: nil,
               investment_amount_cents: nil,
               total_amount_in_cents: 500_00)
      end

      it "sets investment_amount_cents from CSV" do
        csv = build_csv(csv_row(email: "investor@example.com", legal_name: user.legal_name, investment_amount: "$5,000.00"))

        described_class.perform(dividend_round_id: dividend_round.id, csv_data: csv, dry_run: false)

        expect(dividend.reload.investment_amount_cents).to eq(5_000_00)
      end
    end

    context "matches by legal name when email changed" do
      let(:user) { create(:user, email: "new-email@example.com", legal_name: "John Smith") }
      let(:company_investor) { create(:company_investor, user:, company:) }
      let!(:dividend) do
        create(:dividend,
               company:,
               company_investor:,
               dividend_round:,
               number_of_shares: nil,
               investment_amount_cents: nil,
               total_amount_in_cents: 500_00)
      end

      it "falls back to legal name matching" do
        csv = build_csv(csv_row(email: "old-email@example.com", legal_name: "John Smith", investment_amount: "$3,000.00"))

        described_class.perform(dividend_round_id: dividend_round.id, csv_data: csv, dry_run: false)

        expect(dividend.reload.investment_amount_cents).to eq(3_000_00)
      end
    end

    context "skips dividends that already have investment_amount_cents" do
      let(:user) { create(:user, email: "investor@example.com") }
      let(:company_investor) { create(:company_investor, user:, company:) }
      let!(:dividend) do
        create(:dividend,
               company:,
               company_investor:,
               dividend_round:,
               number_of_shares: nil,
               investment_amount_cents: 99_999_00,
               total_amount_in_cents: 500_00)
      end

      it "does not overwrite existing investment_amount_cents" do
        csv = build_csv(csv_row(email: "investor@example.com", legal_name: user.legal_name, investment_amount: "$1,000.00"))

        described_class.perform(dividend_round_id: dividend_round.id, csv_data: csv, dry_run: false)

        expect(dividend.reload.investment_amount_cents).to eq(99_999_00)
      end
    end

    context "handles currency formats" do
      let(:user) { create(:user, email: "investor@example.com") }
      let(:company_investor) { create(:company_investor, user:, company:) }
      let!(:dividend) do
        create(:dividend,
               company:,
               company_investor:,
               dividend_round:,
               number_of_shares: nil,
               investment_amount_cents: nil,
               total_amount_in_cents: 500_00)
      end

      it "parses dollar amounts with $ and commas" do
        csv = build_csv(csv_row(email: "investor@example.com", legal_name: user.legal_name, investment_amount: "$6,065.33"))

        described_class.perform(dividend_round_id: dividend_round.id, csv_data: csv, dry_run: false)

        expect(dividend.reload.investment_amount_cents).to eq(6_065_33)
      end
    end

    context "reports not found entries" do
      it "tracks emails not found in the dividend round" do
        csv = build_csv(csv_row(email: "ghost@example.com", legal_name: "Ghost User", investment_amount: "$100"))

        expect do
          described_class.perform(dividend_round_id: dividend_round.id, csv_data: csv, dry_run: false)
        end.to output(/Not found in dividend round.*ghost@example.com/m).to_stdout
      end
    end

    context "dry run mode" do
      let(:user) { create(:user, email: "investor@example.com") }
      let(:company_investor) { create(:company_investor, user:, company:) }
      let!(:dividend) do
        create(:dividend,
               company:,
               company_investor:,
               dividend_round:,
               number_of_shares: nil,
               investment_amount_cents: nil,
               total_amount_in_cents: 500_00)
      end

      it "does not update any records" do
        csv = build_csv(csv_row(email: "investor@example.com", legal_name: user.legal_name, investment_amount: "$5,000.00"))

        described_class.perform(dividend_round_id: dividend_round.id, csv_data: csv, dry_run: true)

        expect(dividend.reload.investment_amount_cents).to be_nil
      end
    end

    context "with multiple CSV rows" do
      let(:user1) { create(:user, email: "investor1@example.com") }
      let(:user2) { create(:user, email: "investor2@example.com") }
      let(:ci1) { create(:company_investor, user: user1, company:) }
      let(:ci2) { create(:company_investor, user: user2, company:) }
      let!(:dividend1) do
        create(:dividend, company:, company_investor: ci1, dividend_round:, number_of_shares: nil, investment_amount_cents: nil, total_amount_in_cents: 500_00)
      end
      let!(:dividend2) do
        create(:dividend, company:, company_investor: ci2, dividend_round:, number_of_shares: nil, investment_amount_cents: nil, total_amount_in_cents: 300_00)
      end

      it "updates all matching dividends" do
        csv = build_csv(
          csv_row(email: "investor1@example.com", legal_name: user1.legal_name, investment_amount: "$1,000.00"),
          csv_row(email: "investor2@example.com", legal_name: user2.legal_name, investment_amount: "$2,500.00"),
        )

        described_class.perform(dividend_round_id: dividend_round.id, csv_data: csv, dry_run: false)

        expect(dividend1.reload.investment_amount_cents).to eq(1_000_00)
        expect(dividend2.reload.investment_amount_cents).to eq(2_500_00)
      end
    end
  end
end
