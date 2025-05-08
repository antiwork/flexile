# frozen_string_literal: true

RSpec.describe Irs::BaseFormDataGenerator do
  let(:company) { build(:company) }
  let(:tax_year) { 2023 }
  let(:service) { described_class.new(company:, tax_year:) }

  describe "#process" do
    it "raises NotImplementedError" do
      expect { service.process }.to raise_error(NotImplementedError)
    end
  end

  describe "#payee_ids" do
    it "raises NotImplementedError" do
      expect { service.payee_ids }.to raise_error(NotImplementedError)
    end
  end

  describe "#type_of_return" do
    it "raises NotImplementedError" do
      expect { service.type_of_return }.to raise_error(NotImplementedError)
    end
  end

  describe "#amount_codes" do
    it "raises NotImplementedError" do
      expect { service.amount_codes }.to raise_error(NotImplementedError)
    end
  end

  describe "#serialize_form_data" do
    it "raises NotImplementedError" do
      expect { service.serialize_form_data }.to raise_error(NotImplementedError)
    end
  end
end
