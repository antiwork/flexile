# frozen_string_literal: true

RSpec.describe DividendRound do
  describe "associations" do
    it { is_expected.to belong_to(:company) }
    it { is_expected.to have_many(:dividends) }
    it { is_expected.to have_many(:investor_dividend_rounds) }
  end

  describe "validations" do
    it { is_expected.to validate_presence_of(:issued_at) }
    it { is_expected.to validate_presence_of(:number_of_shares) }
    it { is_expected.to validate_numericality_of(:number_of_shares).is_greater_than_or_equal_to(0) }
    it { is_expected.to validate_presence_of(:number_of_shareholders) }
    it { is_expected.to validate_numericality_of(:number_of_shareholders).is_greater_than(0) }
    it { is_expected.to validate_presence_of(:total_amount_in_cents) }
    it { is_expected.to validate_numericality_of(:total_amount_in_cents).is_greater_than(0) }
    it { is_expected.to validate_presence_of(:status) }
    it { is_expected.to validate_inclusion_of(:status).in_array(%w(Issued Paid)) }
  end

  describe "scopes" do
    describe ".ready_for_payment" do
      let!(:ready_for_payment_dividend_round) { create(:dividend_round, ready_for_payment: true) }
      let!(:not_ready_for_payment_dividend_round) { create(:dividend_round, ready_for_payment: false) }

      it "returns dividend rounds with ready_for_payment true" do
        expect(described_class.ready_for_payment).to eq([ready_for_payment_dividend_round])
      end
    end
  end

  describe "#remind_dividend_investors" do
    let(:company) { create(:company) }
    let(:dividend_round) { create(:dividend_round, company:) }
    let(:company_investor_1) { create(:company_investor, company:) }
    let(:company_investor_2) { create(:company_investor, company:) }
    let(:company_investor_3) { create(:company_investor, company:) }
    let(:company_investor_4) { create(:company_investor, company:) }

    before do
      # A dividend that we've emailed about already
      create(:dividend, dividend_round:, company_investor: company_investor_1,
                        status: Dividend::PENDING_SIGNUP)
      company_investor_1.investor_dividend_rounds.create!(dividend_round:, dividend_issued_email_sent: true)

      create(:dividend, dividend_round:, company_investor: company_investor_2, status: Dividend::ISSUED)

      create(:dividend, dividend_round:, company_investor: company_investor_3, status: Dividend::PENDING_SIGNUP)
      company_investor_3.investor_dividend_rounds.create!(dividend_round:)

      create(:dividend, dividend_round:, company_investor: company_investor_4, status: Dividend::PENDING_SIGNUP)
    end

    it "only sends emails to investors with dividends in the pending signup state" do
      company_investors = [company_investor_1, company_investor_3, company_investor_4]
      dividend_rounds = InvestorDividendRound.where(dividend_round:)

      expect do
        dividend_round.remind_dividend_investors
      end.to have_enqueued_mail(CompanyInvestorMailer, :dividend_issued).exactly(company_investors.size).with do |args|
        expect(args[:investor_dividend_round_id]).to eq(dividend_rounds.where(company_investor: company_investors.pop).sole.id)
      end
    end
  end
end
