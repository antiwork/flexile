# frozen_string_literal: true

RSpec.describe AutoEnableDividendPaymentsJob do
  describe "#perform" do
    let(:company_with_dividends_allowed) { create(:company, dividends_allowed: true) }
    let(:company_with_dividends_disallowed) { create(:company, dividends_allowed: false) }
    
    let!(:eligible_round_today) do
      dividend_round = build(:dividend_round, 
        company: company_with_dividends_allowed,
        status: "Issued",
        ready_for_payment: false,
        issued_at: Date.current
      )
      dividend_round.save!(validate: false)
      dividend_round
    end
    
    let!(:eligible_round_yesterday) do
      dividend_round = build(:dividend_round,
        company: company_with_dividends_allowed,
        status: "Issued", 
        ready_for_payment: false,
        issued_at: 1.day.ago
      )
      dividend_round.save!(validate: false)
      dividend_round
    end

    before do
      allow(Rails.logger).to receive(:info)
      allow(Rails.logger).to receive(:error)
    end

    describe "success paths" do
      it "enables eligible dividend rounds" do
        expect {
          described_class.new.perform
        }.to change { eligible_round_today.reload.ready_for_payment }.from(false).to(true)
         .and change { eligible_round_yesterday.reload.ready_for_payment }.from(false).to(true)
      end

      it "logs successful enabling of each round" do
        described_class.new.perform
        
        expect(Rails.logger).to have_received(:info)
          .with("Auto-enabling payment for dividend round #{eligible_round_today.id} (issued_at: #{eligible_round_today.issued_at})")
        expect(Rails.logger).to have_received(:info)
          .with("Auto-enabling payment for dividend round #{eligible_round_yesterday.id} (issued_at: #{eligible_round_yesterday.issued_at})")
      end

      it "logs summary with count of enabled rounds" do
        described_class.new.perform
        
        expect(Rails.logger).to have_received(:info)
          .with("Auto-enabled payment for 2 dividend rounds")
      end

      it "updates the updated_at timestamp" do
        freeze_time do
          expect {
            described_class.new.perform
          }.to change { eligible_round_today.reload.updated_at }.to(Time.current)
        end
      end
    end

    describe "skip paths" do
      it "skips rounds that are already ready for payment" do
        already_ready_round = build(:dividend_round,
          company: company_with_dividends_allowed,
          status: "Issued",
          ready_for_payment: true,
          issued_at: Date.current
        )
        already_ready_round.save!(validate: false)

        expect {
          described_class.new.perform
        }.not_to change { already_ready_round.reload.ready_for_payment }
      end

      it "skips rounds with wrong status" do
        paid_round = build(:dividend_round,
          company: company_with_dividends_allowed,
          status: "Paid",
          ready_for_payment: false,
          issued_at: Date.current
        )
        paid_round.save!(validate: false)

        expect {
          described_class.new.perform
        }.not_to change { paid_round.reload.ready_for_payment }
      end

      it "skips rounds issued in the future" do
        future_round = build(:dividend_round,
          company: company_with_dividends_allowed,
          status: "Issued",
          ready_for_payment: false,
          issued_at: 2.days.from_now
        )
        future_round.save!(validate: false)

        expect {
          described_class.new.perform
        }.not_to change { future_round.reload.ready_for_payment }
      end

      it "skips rounds for companies with dividends not allowed" do
        disallowed_round = build(:dividend_round,
          company: company_with_dividends_disallowed,
          status: "Issued",
          ready_for_payment: false,
          issued_at: Date.current
        )
        disallowed_round.save!(validate: false)

        expect {
          described_class.new.perform
        }.not_to change { disallowed_round.reload.ready_for_payment }
      end
    end

    describe "failure paths" do
      it "handles database errors gracefully and logs them" do
        # Create a record that will fail due to database constraint
        failing_round = build(:dividend_round,
          company: company_with_dividends_allowed,
          status: "Issued",
          ready_for_payment: false,
          issued_at: Date.current
        )
        failing_round.save!(validate: false)
        
        # Simulate a database error by setting an invalid company_id
        failing_round.update_column(:company_id, -1)

        described_class.new.perform

        # The job should continue despite the error and log appropriately
        expect(Rails.logger).to have_received(:info)
          .with(a_string_matching(/Auto-enabled payment for \d+ dividend rounds/))
      end
    end

    describe "edge cases" do
      it "handles no eligible rounds gracefully" do
        DividendRound.destroy_all

        expect {
          described_class.new.perform
        }.not_to raise_error

        expect(Rails.logger).to have_received(:info)
          .with("Auto-enabled payment for 0 dividend rounds")
      end

      it "processes rounds issued exactly at boundary (today is eligible)" do
        boundary_round = build(:dividend_round,
          company: company_with_dividends_allowed,
          status: "Issued",
          ready_for_payment: false,
          issued_at: Date.current
        )
        boundary_round.save!(validate: false)

        expect {
          described_class.new.perform
        }.to change { boundary_round.reload.ready_for_payment }.from(false).to(true)
      end
    end
  end
end