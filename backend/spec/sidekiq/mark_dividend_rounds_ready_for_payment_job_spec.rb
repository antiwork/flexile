# frozen_string_literal: true

RSpec.describe MarkDividendRoundsReadyForPaymentJob, type: :job do
  describe "#perform" do
    let(:company) { create(:company) }

    context "when dividend rounds have reached their issuance date" do
      it "marks them as ready for payment" do
        # Create dividend rounds with different issuance dates
        past_dividend_round = create(:dividend_round,
                                     company: company,
                                     issued_at: 2.days.ago,
                                     ready_for_payment: false)

        today_dividend_round = create(:dividend_round,
                                      company: company,
                                      issued_at: Date.current,
                                      ready_for_payment: false)

        future_dividend_round = create(:dividend_round,
                                       company: company,
                                       issued_at: 2.days.from_now,
                                       ready_for_payment: false)

        expect { described_class.new.perform }
          .to change { past_dividend_round.reload.ready_for_payment }.from(false).to(true)
          .and change { today_dividend_round.reload.ready_for_payment }.from(false).to(true)
          .and not_change { future_dividend_round.reload.ready_for_payment }
      end
    end

    context "when dividend rounds are already ready for payment" do
      it "does not update them" do
        dividend_round = create(:dividend_round,
                                company: company,
                                issued_at: 1.day.ago,
                                ready_for_payment: true)

        expect { described_class.new.perform }
          .not_to change { dividend_round.reload.ready_for_payment }
      end
    end

    context "when no dividend rounds need updating" do
      it "does not raise an error" do
        expect { described_class.new.perform }.not_to raise_error
      end
    end
  end
end
