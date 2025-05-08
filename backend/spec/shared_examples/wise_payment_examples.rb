# frozen_string_literal: true

RSpec.shared_examples_for "Wise payments" do
  describe "associations" do
    it { is_expected.to belong_to(:wise_credential).optional(allows_other_payment_methods) }
    it { is_expected.to belong_to(:wise_recipient).optional(true) }
  end

  describe "validations" do
    it { is_expected.to validate_inclusion_of(:wise_transfer_status).in_array(Payment::ALL_STATES).allow_nil }
  end

  describe "#in_failed_state?" do
    let(:failure_states) do
      [Payments::Wise::CANCELLED, Payments::Wise::FUNDS_REFUNDED, Payments::Wise::CHARGED_BACK]
    end

    it "returns `true` for states that depict a failure" do
      Payments::Wise::ALL_STATES.each do |state|
        payment.wise_transfer_status = state
        expect(payment.in_failed_state?).to eq(failure_states.include?(state))
      end
    end
  end

  describe "#in_processing_state?" do
    let(:processing_states) do
      [Payments::Wise::PROCESSING, Payments::Wise::FUNDS_CONVERTED, Payments::Wise::BOUNCED_BACK]
    end

    it "returns `true` for intermediary states" do
      Payments::Wise::ALL_STATES.each do |state|
        payment.wise_transfer_status = state
        expect(payment.in_processing_state?).to eq(processing_states.include?(state))
      end
    end
  end
end
