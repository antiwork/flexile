# frozen_string_literal: true

RSpec.describe EquityContractCountrySupport do
  describe "#supported?" do
    let(:supported_country_user) { build(:user, country_code: "GB") }
    let(:unsupported_country_user) { build(:user, country_code: "FR") }

    context "when the user is from a supported country" do
      subject { described_class.new(supported_country_user) }

      it "returns true" do
        expect(subject.supported?).to be true
      end
    end

    context "when the user is from an unsupported country" do
      subject { described_class.new(unsupported_country_user) }

      it "returns false" do
        expect(subject.supported?).to be false
      end
    end
  end
end
