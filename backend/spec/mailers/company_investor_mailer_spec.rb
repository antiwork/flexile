# frozen_string_literal: true

RSpec.describe CompanyInvestorMailer do
  describe "#return_of_capital_issued" do
    let(:user) { create(:user) }
    let(:company) { create(:company) }
    let(:company_investor) { create(:company_investor, user: user, company: company, investment_amount_in_cents: 100_000) }
    let!(:dividend1) { create(:dividend, company_investor: company_investor, total_amount_in_cents: 5000, net_amount_in_cents: 4000, withheld_tax_cents: 1000, created_at: 1.year.ago) }
    let!(:dividend2) { create(:dividend, company_investor: company_investor, total_amount_in_cents: 5000, net_amount_in_cents: 4000, withheld_tax_cents: 1000, created_at: Time.current) }
    let!(:investor_dividend_round) { create(:investor_dividend_round, company_investor: company_investor, dividend_round: dividend2.dividend_round) }

    it "sends return of capital email with correct attributes" do
      mail = described_class.return_of_capital_issued(investor_dividend_round_id: investor_dividend_round.id)
      plaintext = ActionView::Base.full_sanitizer.sanitize(mail.body.encoded).gsub("\r\n", " ").gsub(/\s+/, " ").strip

      expect(mail.to).to eq([user.email])
      expect(mail.subject).to eq("Upcoming distribution from #{company.name}")
      expect(plaintext).to include(company.name)
      expect(plaintext).to include("you've been issued a return of capital amounting to $50.00. Investment amount $1,000.00 Cumulative ROI (2024 and 2025 Distributions) 10.0% Distribution amount $50.00 Taxes withheld $0.00 (Return of capital - no tax withholding applies) Total to be paid $50.00")
    end
  end

  describe "#dividend_issued" do
    let(:user) { create(:user) }
    let(:company) { create(:company) }
    let(:company_investor) { create(:company_investor, user: user, company: company, investment_amount_in_cents: 100_000) }
    let!(:dividend1) { create(:dividend, company_investor: company_investor, total_amount_in_cents: 5000, net_amount_in_cents: 4000, withheld_tax_cents: 1000, created_at: 1.year.ago) }
    let!(:dividend2) { create(:dividend, company_investor: company_investor, total_amount_in_cents: 5000, net_amount_in_cents: 4000, withheld_tax_cents: 1000, created_at: Time.current) }
    let!(:investor_dividend_round) { create(:investor_dividend_round, company_investor: company_investor, dividend_round: dividend2.dividend_round) }

    it "sends dividend email with correct attributes" do
      mail = described_class.dividend_issued(investor_dividend_round_id: investor_dividend_round.id)
      plaintext = ActionView::Base.full_sanitizer.sanitize(mail.body.encoded).gsub("\r\n", " ").gsub(/\s+/, " ").strip

      expect(mail.to).to eq([user.email])
      expect(mail.subject).to eq("Upcoming distribution from #{company.name}")
      expect(plaintext).to include(company.name)
      expect(plaintext).to include("Based on your investment of $1,000.00, you've received a distribution of $50.00. Investment amount $1,000.00 Cumulative ROI (2024 and 2025 Distributions) 10.0% Distribution amount $50.00 Taxes withheld $10.00 Total to be paid $40.00")
    end

    context "when there is only one dividend" do
      it "does not include the years in the ROI" do
        dividend1.destroy!
        mail = described_class.dividend_issued(investor_dividend_round_id: investor_dividend_round.id)
        plaintext = ActionView::Base.full_sanitizer.sanitize(mail.body.encoded).gsub("\r\n", " ").gsub(/\s+/, " ").strip

        expect(mail.to).to eq([user.email])
        expect(mail.subject).to eq("Upcoming distribution from #{company.name}")
        expect(plaintext).to include("Cumulative ROI 5.0%")
      end
    end

    context "when tax information is missing" do
      let!(:dividend1) { create(:dividend, company_investor: company_investor, total_amount_in_cents: 5000, created_at: 1.year.ago, withheld_tax_cents: nil, net_amount_in_cents: nil) }
      let!(:dividend2) { create(:dividend, company_investor: company_investor, total_amount_in_cents: 5000, created_at: Time.current, withheld_tax_cents: nil, net_amount_in_cents: nil) }
      let!(:investor_dividend_round) { create(:investor_dividend_round, company_investor: company_investor, dividend_round: dividend2.dividend_round) }

      it "calculates tax withholding and net amount" do
        allow_any_instance_of(DividendTaxWithholdingCalculator).to receive(:net_cents).and_return(4000)
        allow_any_instance_of(DividendTaxWithholdingCalculator).to receive(:cents_to_withhold).and_return(1000)

        mail = described_class.dividend_issued(investor_dividend_round_id: investor_dividend_round.id)
        plaintext = ActionView::Base.full_sanitizer.sanitize(mail.body.encoded).gsub("\r\n", " ").gsub(/\s+/, " ").strip

        expect(plaintext).to include("Distribution amount $50.00 Taxes withheld $10.00 Total to be paid $40.00")
      end
    end
  end
end
