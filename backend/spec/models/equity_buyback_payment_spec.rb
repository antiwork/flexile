# frozen_string_literal: true

require "shared_examples/wise_payment_examples"

RSpec.describe EquityBuybackPayment do
  include_examples "Wise payments" do
    let(:allows_other_payment_methods) { true }
    let(:payment) { build(:equity_buyback_payment) }
  end

  describe "associations" do
    it { is_expected.to have_and_belong_to_many(:equity_buybacks).join_table(:equity_buybacks_equity_buyback_payments) }
    it { is_expected.to belong_to(:wise_credential).optional(true) }
    it { is_expected.to belong_to(:wise_recipient).optional(true) }
  end

  describe "validations" do
    it { is_expected.to validate_presence_of(:status) }
    it { is_expected.to validate_numericality_of(:total_transaction_cents).is_greater_than_or_equal_to(0).only_integer.allow_nil }
    it { is_expected.to validate_numericality_of(:transfer_fee_cents).is_greater_than_or_equal_to(0).only_integer.allow_nil }
    it { is_expected.to validate_presence_of(:processor_name) }
    it { is_expected.to validate_inclusion_of(:processor_name).in_array(%w[wise blockchain]) }
    it { is_expected.to validate_presence_of(:equity_buybacks) }

    context "when processor_name is 'wise'" do
      subject { build(:equity_buyback_payment, processor_name: EquityBuybackPayment::PROCESSOR_WISE) }

      it { is_expected.to validate_presence_of(:wise_credential_id) }
    end

    context "when processor_name is 'blockchain'" do
      subject { build(:equity_buyback_payment, processor_name: EquityBuybackPayment::PROCESSOR_BLOCKCHAIN) }

      it { is_expected.not_to validate_presence_of(:wise_credential_id) }
    end
  end

  describe "aliases" do
    it "aliases wise_transfer_status to transfer_status" do
      expect(described_class.attribute_alias(:wise_transfer_status)).to eq("transfer_status")
    end
  end

  describe "scopes" do
    describe ".wise" do
      let!(:wise_payment) { create(:equity_buyback_payment) }
      let!(:eth_payment) { create(:equity_buyback_payment, processor_name: EquityBuybackPayment::PROCESSOR_BLOCKCHAIN) }

      it "returns the equity buyback payment processed via Wise" do
        expect(described_class.wise).to eq([wise_payment])
      end
    end
  end

  describe "#wise_transfer_reference" do
    it "returns the reference" do
      expect(build(:equity_buyback_payment).wise_transfer_reference).to eq("EB")
    end
  end
end
