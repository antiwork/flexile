# frozen_string_literal: true

RSpec.describe Irs::BaseFormDataGenerator do
  let(:company) { build(:company) }
  let(:transmitter_company) { build(:company) }
  let(:tax_year) { 2023 }
  let(:service) { described_class.new(company:, transmitter_company:, tax_year:) }

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

  describe "#administrator_name_for" do
    let(:company) { create(:company, :completed_onboarding, name: "Test Company") }

    it "returns admin legal_name when present" do
      admin_user = company.primary_admin.user
      admin_user.update!(legal_name: "John Doe")

      result = service.send(:administrator_name_for, company)
      expect(result).to eq("John Doe")
    end

    it "falls back to admin preferred_name when legal_name is nil" do
      admin_user = company.primary_admin.user
      admin_user.update!(legal_name: nil, preferred_name: "Jane Smith")

      result = service.send(:administrator_name_for, company)
      expect(result).to eq("Jane Smith")
    end

    it "falls back to admin preferred_name when legal_name is blank" do
      admin_user = company.primary_admin.user
      admin_user.update_columns(legal_name: "", preferred_name: "Jane Smith")

      result = service.send(:administrator_name_for, company)
      expect(result).to eq("Jane Smith")
    end

    it "raises an error when both legal_name and preferred_name are nil" do
      admin_user = company.primary_admin.user
      admin_user.update!(legal_name: nil, preferred_name: nil)

      expect { service.send(:administrator_name_for, company) }
        .to raise_error("No administrator name found for company #{company.id}")
    end
  end
end
