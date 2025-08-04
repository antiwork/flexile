# frozen_string_literal: true

RSpec.describe VestingEvent do
  describe "associations" do
    it { is_expected.to belong_to(:equity_grant) }
  end

  describe "validations" do
    it { is_expected.to validate_presence_of(:vesting_date) }
    it { is_expected.to validate_presence_of(:vested_shares) }
    it { is_expected.to validate_numericality_of(:vested_shares).is_greater_than(0) }
    describe "cancellation_reason" do
      context "when cancelled_at is nil" do
        subject(:vesting_event) { build(:vesting_event, cancelled_at: nil) }
        it { is_expected.not_to validate_inclusion_of(:cancellation_reason).in_array(VestingEvent::CANCELLATION_REASONS.values).allow_nil }
      end

      context "when cancelled_at is not nil" do
        subject(:vesting_event) { build(:vesting_event, cancelled_at: Time.current, cancellation_reason: nil) }
        it { is_expected.to validate_inclusion_of(:cancellation_reason).in_array(VestingEvent::CANCELLATION_REASONS.values).allow_nil }
      end
    end
  end

  describe "scopes" do
    let!(:processed_event) { create(:vesting_event, processed_at: Time.current) }
    let!(:unprocessed_event) { create(:vesting_event, processed_at: nil) }
    let!(:cancelled_event) { create(:vesting_event, cancelled_at: Time.current) }

    describe "#processed" do
      it "returns processed events" do
        expect(VestingEvent.processed).to eq([processed_event])
      end
    end

    describe "#unprocessed" do
      it "returns unprocessed events" do
        expect(VestingEvent.unprocessed).to match_array([unprocessed_event, cancelled_event])
      end
    end


    describe "#cancelled" do
      it "returns cancelled events" do
        expect(VestingEvent.cancelled).to match_array([cancelled_event])
      end
    end

    describe "#not_cancelled" do
      it "returns not cancelled events" do
        expect(VestingEvent.not_cancelled).to match_array([processed_event, unprocessed_event])
      end
    end
  end

  describe "#mark_as_processed!" do
    let(:vesting_event) { create(:vesting_event) }

    it "updates the processed_at attribute" do
      vesting_event.mark_as_processed!
      expect(vesting_event.processed_at).not_to be_nil
    end

    it "sends a notification email" do
      expect do
        vesting_event.mark_as_processed!
      end.to have_enqueued_mail(CompanyWorkerMailer, :vesting_event_processed).with(vesting_event.id)
    end
  end

  describe "#mark_cancelled!" do
    it "marks the event as cancelled" do
      vesting_event = create(:vesting_event)
      vesting_event.mark_cancelled!
      expect(vesting_event.cancelled_at).not_to be_nil
      expect(vesting_event.cancellation_reason).to be_nil

      vesting_event = create(:vesting_event)
      vesting_event.mark_cancelled!(reason: VestingEvent::CANCELLATION_REASONS[:not_enough_shares_available])
      expect(vesting_event.cancelled_at).not_to be_nil
      expect(vesting_event.cancellation_reason).to eq(VestingEvent::CANCELLATION_REASONS[:not_enough_shares_available])

      vesting_event = create(:vesting_event)
      expect do
        vesting_event.mark_cancelled!(reason: "some other reason")
      end.to raise_error(ActiveRecord::RecordInvalid, "Validation failed: Cancellation reason is not included in the list")
    end
  end
end
