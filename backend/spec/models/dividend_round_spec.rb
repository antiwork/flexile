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
    let(:dividend_round) { create(:dividend_round, company: company) }
    let(:company_investor_1) { create(:company_investor, company: company) }
    let(:company_investor_2) { create(:company_investor, company: company) }
    let(:company_investor_3) { create(:company_investor, company: company) }

    before do
      # Create dividends with different statuses
      create(:dividend, dividend_round: dividend_round, company_investor: company_investor_1, status: Dividend::PENDING_SIGNUP)
      create(:dividend, dividend_round: dividend_round, company_investor: company_investor_2, status: Dividend::ISSUED)
      create(:dividend, dividend_round: dividend_round, company_investor: company_investor_3, status: Dividend::PENDING_SIGNUP)
    end

    it "only sends emails to investors with pending signup dividends" do
      allow(CompanyInvestorMailer).to receive(:dividend_issued).and_return(double(deliver_later: true))

      dividend_round.remind_dividend_investors

      # Verify that investor dividend rounds were created only for pending signup investors
      created_rounds = InvestorDividendRound.where(dividend_round: dividend_round)
      pending_investor_ids = [company_investor_1.id, company_investor_3.id]

      expect(created_rounds.count).to eq(2)
      expect(created_rounds.pluck(:company_investor_id)).to match_array(pending_investor_ids)

      # Verify that CompanyInvestorMailer was called for each pending signup investor
      expect(CompanyInvestorMailer).to have_received(:dividend_issued).twice
    end

    it "creates investor dividend rounds for pending signup investors" do
      expect { dividend_round.remind_dividend_investors }
        .to change { InvestorDividendRound.count }.by(2)
    end

    it "does not send emails to investors with issued dividends" do
      # Mock the method to track calls
      allow(CompanyInvestorMailer).to receive(:dividend_issued).and_return(double(deliver_later: true))

      dividend_round.remind_dividend_investors

      # Verify only pending signup investors got investor dividend rounds created
      pending_investor_ids = [company_investor_1.id, company_investor_3.id]
      created_rounds = InvestorDividendRound.where(dividend_round: dividend_round)

      expect(created_rounds.pluck(:company_investor_id)).to match_array(pending_investor_ids)
    end
  end

  describe "#send_dividend_emails" do
    let(:company) { create(:company) }
    let(:dividend_round) { create(:dividend_round, company: company) }
    let(:investor1) { create(:company_investor, company: company) }
    let(:investor2) { create(:company_investor, company: company) }
    let(:investor3) { create(:company_investor, company: company) }

    before do
      create(:dividend, dividend_round: dividend_round, company_investor: investor1, status: Dividend::ISSUED)
      create(:dividend, dividend_round: dividend_round, company_investor: investor2, status: Dividend::PENDING_SIGNUP)
      create(:dividend, dividend_round: dividend_round, company_investor: investor3, status: Dividend::ISSUED)
    end

    it "sends emails to all investors regardless of dividend status" do
      allow_any_instance_of(InvestorDividendRound).to receive(:send_dividend_issued_email)

      dividend_round.send_dividend_emails

      # Should create investor dividend rounds for all investors
      expect(InvestorDividendRound.where(company_investor: [investor1, investor2, investor3]).count).to eq(3)
    end
  end
end
