# frozen_string_literal: true

require "shared_examples/wise_payment_examples"

RSpec.describe Payment do
  include_examples "Wise payments" do
    let(:allows_other_payment_methods) { false }
    let(:payment) { build(:payment) }
  end

  describe "associations" do
    it { is_expected.to belong_to(:invoice) }
    it { is_expected.to have_many(:balance_transactions).class_name("PaymentBalanceTransaction") }
  end

  describe "validations" do
    it { is_expected.to validate_presence_of(:status) }
    it { is_expected.to validate_inclusion_of(:status).in_array(Payment::DEFAULT_STATUSES) }
    it { is_expected.to validate_presence_of(:net_amount_in_cents) }
    it { is_expected.to validate_numericality_of(:net_amount_in_cents).is_greater_than_or_equal_to(1).only_integer }
    it { is_expected.to validate_numericality_of(:transfer_fee_in_cents).is_greater_than_or_equal_to(0).only_integer.allow_nil }
  end

  describe "delegations" do
    it { is_expected.to delegate_method(:company).to(:invoice) }
  end

  describe "scopes" do
    describe ".successful" do
      it "returns payments with succeeded status" do
        (Payment::DEFAULT_STATUSES - [Payment::SUCCEEDED]).each do |status|
          create(:payment, status:)
        end
        successful = create_list(:payment, 2, status: Payment::SUCCEEDED)
        expect(described_class.successful).to match_array successful
      end
    end
  end

  describe "#marked_failed?" do
    it "returns `true` if status is failed" do
      payment = build(:payment)
      expect(payment.marked_failed?).to eq(false)

      payment.status = Payment::FAILED
      expect(payment.marked_failed?).to eq(true)
    end
  end


  describe "#wise_transfer_reference" do
    it "returns the reference" do
      expect(build(:payment).wise_transfer_reference).to eq("PMT")
    end
  end
end
