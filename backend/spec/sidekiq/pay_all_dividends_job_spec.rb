# frozen_string_literal: true

RSpec.describe PayAllDividendsJob do
  describe "#perform" do
    let(:company1) { create(:company) }
    let(:company2) { create(:company) }
    let(:user) do
      user = create(:user)
      user.compliance_info.update!(tax_id_status: "verified", tax_information_confirmed_at: Time.current)
      user
    end
    let(:company1_investor) { create(:company_investor, company: company1, user:) }
    let(:company2_investor) { create(:company_investor, company: company2, user:) }

    let(:dividend_round1) { create(:dividend_round, ready_for_payment: true, company: company1) }
    let(:dividend_round2) { create(:dividend_round, ready_for_payment: true, company: company1) }
    let(:dividend_round3) { create(:dividend_round, ready_for_payment: true, company: company2) }
    let(:not_ready_round) { create(:dividend_round, company: company1) } # Not ready for payment

    before do
      # Two dividends from company1, different rounds
      create(:dividend, dividend_round: dividend_round1, company_investor: company1_investor)
      create(:dividend, dividend_round: dividend_round2, company_investor: company1_investor)
      create(:investor_dividend_round, dividend_round: dividend_round1, company_investor: company1_investor)
      create(:investor_dividend_round, dividend_round: dividend_round2, company_investor: company1_investor)

      # Two dividends from company2, same round
      create(:dividend, dividend_round: dividend_round3, company_investor: company2_investor)
      create(:dividend, dividend_round: dividend_round3, company_investor: company2_investor)
      create(:investor_dividend_round, dividend_round: dividend_round3, company_investor: company2_investor)

      # One dividend that's not ready for payment
      create(:dividend, dividend_round: not_ready_round, company_investor: company1_investor)
    end

    it "schedules payment jobs for each unique investor" do
      expect { described_class.new.perform }
        .to change { InvestorDividendsPaymentJob.jobs.size }.by(2)

      expect(InvestorDividendsPaymentJob).to have_enqueued_sidekiq_job(company1_investor.id)
      expect(InvestorDividendsPaymentJob).to have_enqueued_sidekiq_job(company2_investor.id)
    end

    context "when investor is ineligible" do
      it "skips investors without verified tax ID" do
        user.compliance_info.update!(tax_id_status: "invalid")

        expect { described_class.new.perform }
          .not_to change { InvestorDividendsPaymentJob.jobs.size }
      end

      it "skips investors from restricted payout countries" do
        user.update!(country_code: "IR")

        expect { described_class.new.perform }
          .not_to change { InvestorDividendsPaymentJob.jobs.size }
      end

      it "skips investors from sanctioned countries" do
        user.update!(country_code: "RU")

        expect { described_class.new.perform }
          .not_to change { InvestorDividendsPaymentJob.jobs.size }
      end

      it "skips investors without confirmed tax information" do
        user.compliance_info.update!(tax_information_confirmed_at: nil)

        expect { described_class.new.perform }
          .not_to change { InvestorDividendsPaymentJob.jobs.size }
      end

      it "skips investors who don't have a bank account" do
        company1_investor.user.bank_accounts.destroy_all

        expect { described_class.new.perform }
          .not_to change { InvestorDividendsPaymentJob.jobs.size }
      end
    end

    describe "retained dividend emails" do
      context "when dividends aren't retained" do
        it "does not send retained dividend emails" do
          expect_any_instance_of(InvestorDividendRound).not_to receive(:send_payout_below_threshold_email)
          expect_any_instance_of(InvestorDividendRound).not_to receive(:send_sanctioned_country_email)
          described_class.new.perform
        end
      end

      context "when dividends are retained due to sanctioned country" do
        before do
          company1_investor.dividends.where(dividend_round: dividend_round1).update_all(
            status: Dividend::RETAINED,
            retained_reason: Dividend::RETAINED_REASON_COUNTRY_SANCTIONED
          )
        end

        it "sends sanctioned country emails" do
          expect_any_instance_of(InvestorDividendRound).to receive(:send_sanctioned_country_email)
          described_class.new.perform
        end
      end

      context "when dividends are retained due to being below threshold" do
        before do
          company2_investor.dividends.where(dividend_round: dividend_round3).update_all(
            status: Dividend::RETAINED,
            retained_reason: Dividend::RETAINED_REASON_BELOW_THRESHOLD
          )
        end

        it "sends below threshold emails" do
          expect_any_instance_of(InvestorDividendRound).to receive(:send_payout_below_threshold_email)
          described_class.new.perform
        end
      end

      context "when dividends have mixed statuses" do
        before do
          company2_investor.dividends.where(dividend_round: dividend_round3).first.update!(
            status: Dividend::RETAINED,
            retained_reason: Dividend::RETAINED_REASON_BELOW_THRESHOLD
          )
          company2_investor.dividends.where(dividend_round: dividend_round3).last.update!(
            status: Dividend::RETAINED,
            retained_reason: Dividend::RETAINED_REASON_COUNTRY_SANCTIONED
          )
        end

        it "does not send retained dividend emails" do
          expect_any_instance_of(InvestorDividendRound).not_to receive(:send_payout_below_threshold_email)
          expect_any_instance_of(InvestorDividendRound).not_to receive(:send_sanctioned_country_email)
          described_class.new.perform
        end
      end
    end
  end
end
