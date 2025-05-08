# frozen_string_literal: true

require "shared_examples/wise_payment_examples"

RSpec.describe DividendPayment do
  include_examples "Wise payments" do
    let(:allows_other_payment_methods) { true }
    let(:payment) { build(:dividend_payment) }
  end

  describe "associations" do
    it { is_expected.to have_and_belong_to_many(:dividends).join_table(:dividends_dividend_payments) }
    it { is_expected.to belong_to(:wise_credential).optional(true) }
    it { is_expected.to belong_to(:wise_recipient).optional(true) }
  end

  describe "validations" do
    it { is_expected.to validate_presence_of(:status) }
    it { is_expected.to validate_numericality_of(:total_transaction_cents).is_greater_than_or_equal_to(0).only_integer.allow_nil }
    it { is_expected.to validate_numericality_of(:transfer_fee_in_cents).is_greater_than_or_equal_to(0).only_integer.allow_nil }
    it { is_expected.to validate_presence_of(:processor_name) }
    it { is_expected.to validate_inclusion_of(:processor_name).in_array(%w[wise blockchain]) }
    it { is_expected.to validate_presence_of(:dividends) }

    context "when processor_name is 'wise'" do
      subject { build(:dividend_payment, processor_name: DividendPayment::PROCESSOR_WISE) }

      it { is_expected.to validate_presence_of(:wise_credential_id) }
    end

    context "when processor_name is 'blockchain'" do
      subject { build(:dividend_payment, processor_name: DividendPayment::PROCESSOR_BLOCKCHAIN) }

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
      let!(:wise_payment) { create(:dividend_payment) }
      let!(:eth_payment) { create(:dividend_payment, processor_name: DividendPayment::PROCESSOR_BLOCKCHAIN) }

      it "returns the dividend payment processed via Wise" do
        expect(described_class.wise).to eq([wise_payment])
      end
    end
  end

  describe "#wise_transfer_reference" do
    it "returns the reference" do
      expect(build(:dividend_payment).wise_transfer_reference).to eq("DIV")
    end
  end
end
