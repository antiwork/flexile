# frozen_string_literal: true

RSpec.describe InvestorDividendRound do
  describe "associations" do
    it { is_expected.to belong_to(:company_investor) }
    it { is_expected.to belong_to(:dividend_round) }
  end

  describe "validations" do
    before { create(:investor_dividend_round) }

    it { is_expected.to validate_uniqueness_of(:company_investor_id).scoped_to(:dividend_round_id) }
  end

  let(:investor_dividend_round) { create(:investor_dividend_round) }
  let(:investor) {  investor_dividend_round.company_investor }
  let(:dividend_round) {  investor_dividend_round.dividend_round }

  describe "#send_sanctioned_country_email" do
    before do
      create(:dividend, dividend_round:, company_investor: investor, total_amount_in_cents: 123_45)
      create(:dividend, dividend_round:, company_investor: investor, total_amount_in_cents: 678_90)
    end

    context "when the email has already been sent" do
      it "does not send the email" do
        investor_dividend_round.update!(sanctioned_country_email_sent: true)

        expect do
          investor_dividend_round.send_sanctioned_country_email
        end.not_to have_enqueued_mail(CompanyInvestorMailer, :sanctioned_dividends)
      end
    end

    context "when the email has not been sent" do
      it "sends the email and sets the relevant flag" do
        expect do
          investor_dividend_round.send_sanctioned_country_email
        end.to have_enqueued_mail(CompanyInvestorMailer, :sanctioned_dividends)
                 .with(investor.id, dividend_amount_in_cents: 123_45 + 678_90)
           .and change { investor_dividend_round.reload.sanctioned_country_email_sent }.from(false).to(true)
      end
    end
  end

  describe "#send_payout_below_threshold_email" do
    before do
      create(:dividend, dividend_round:, company_investor: investor,
                        total_amount_in_cents: 1_23, net_amount_in_cents: 1_10, withholding_percentage: 10)
      create(:dividend, dividend_round:, company_investor: investor,
                        total_amount_in_cents: 6_78, net_amount_in_cents: 6_10, withholding_percentage: 10)
    end

    context "when the email has already been sent" do
      it "does not send the email" do
        investor_dividend_round.update!(payout_below_threshold_email_sent: true)

        expect do
          investor_dividend_round.send_payout_below_threshold_email
        end.not_to have_enqueued_mail(CompanyInvestorMailer, :retained_dividends)
      end
    end

    context "when the email has not been sent" do
      it "sends the email and sets the relevant flag" do
        expect do
          investor_dividend_round.send_payout_below_threshold_email
        end.to have_enqueued_mail(CompanyInvestorMailer, :retained_dividends)
                 .with(investor.id, total_cents: 1_23 + 6_78, net_cents: 1_10 + 6_10, withholding_percentage: 10)
            .and change { investor_dividend_round.reload.payout_below_threshold_email_sent }.from(false).to(true)
      end
    end
  end

  describe "#send_dividend_issued_email" do
    context "when the email has already been sent" do
      it "does not send the email" do
        investor_dividend_round.update!(dividend_issued_email_sent: true)

        expect do
          investor_dividend_round.send_dividend_issued_email
        end.not_to have_enqueued_mail(CompanyInvestorMailer, :dividend_issued)
      end
    end

    context "when the email has not been sent" do
      it "sends the email and sets the relevant flag" do
        expect do
          investor_dividend_round.send_dividend_issued_email
        end.to have_enqueued_mail(CompanyInvestorMailer, :dividend_issued)
                 .with(investor_dividend_round_id: investor_dividend_round.id)
           .and change { investor_dividend_round.reload.dividend_issued_email_sent }.from(false).to(true)
      end
    end
  end
end
