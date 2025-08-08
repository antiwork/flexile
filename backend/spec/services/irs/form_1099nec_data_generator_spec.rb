# frozen_string_literal: true

RSpec.describe Irs::Form1099necDataGenerator do
  let(:tax_year) { 2023 }
  let!(:transmitter_company) do
    create(
      :company,
      :completed_onboarding,
      email: "hi@gumroad.com",
      name: "Gumroad",
      tax_id: "453361423",
      street_address: "548 Market St",
      city: "San Francisco",
      state: "CA",
      zip_code: "94105",
      country_code: "US",
      phone_number: "555-123-4567"
    )
  end
  let(:company) do
    create(
      :company,
      :completed_onboarding,
      email: "hi@acme.com",
      name: "Acme, Inc.",
      tax_id: "123456789",
      street_address: "123 Main St",
      city: "New York",
      state: "NY",
      zip_code: "10001",
      country_code: "US",
      phone_number: "555-123-4567"
    )
  end
  let(:us_resident) { create(:user, :without_compliance_info) }
  let(:us_resident_2) { create(:user, :without_compliance_info) }
  let(:us_resident_3) { create(:user, :without_compliance_info) }
  let(:non_us_resident) { create(:user, :without_compliance_info, country_code: "FR") }
  let(:service) { described_class.new(company:, tax_year:) }

  let!(:us_resident_company_worker) { create(:company_worker, company:, user: us_resident) }
  let!(:us_resident_2_company_worker) { create(:company_worker, company:, user: us_resident_2) }
  let!(:us_resident_3_company_worker) { create(:company_worker, company:, user: us_resident_3) }
  let!(:non_us_resident_company_worker) { create(:company_worker, company:, user: non_us_resident) }

  before do
    create(:user_compliance_info, :us_resident, user: us_resident, tax_information_confirmed_at: 1.day.ago, deleted_at: 1.hour.ago)
    create(:user_compliance_info, :us_resident, :confirmed, user: us_resident)
    create(:user_compliance_info, :us_resident, :confirmed, user: us_resident_2)
    create(:user_compliance_info, :non_us_resident, :confirmed, user: non_us_resident)

    create(:invoice, :paid, company_worker: us_resident_company_worker,
                            invoice_date: Date.new(tax_year, 1, 1),
                            paid_at: Date.new(tax_year, 1, 7),
                            total_amount_in_usd_cents: 200_00,)
    create(:invoice, :paid, company_worker: us_resident_company_worker,
                            invoice_date: Date.new(tax_year, 2, 1),
                            paid_at: Date.new(tax_year, 2, 7),
                            total_amount_in_usd_cents: 500_00)

    # Invoice above threshold, but paid in the next tax year
    create(:invoice, :paid, company:,
                            invoice_date: Date.new(tax_year, 12, 31),
                            paid_at: Date.new(tax_year + 1, 1, 7),
                            total_amount_in_usd_cents: 1_000_00)

    # Invoice below threshold for a US resident
    create(:invoice, :paid, company_worker: us_resident_2_company_worker,
                            invoice_date: Date.new(tax_year, 3, 1),
                            paid_at: Date.new(tax_year, 3, 7),
                            total_amount_in_usd_cents: 599_99)

    # Invoice above threshold but for a non US resident
    create(:invoice, :paid, company_worker: non_us_resident_company_worker,
                            invoice_date: Date.new(tax_year, 3, 1),
                            paid_at: Date.new(tax_year, 3, 1),
                            total_amount_in_usd_cents: 1_000_00)

    # Invoice above threshold for US resident, but without confirmed tax information
    create(:invoice, :paid, company_worker: us_resident_3_company_worker,
                            invoice_date: Date.new(tax_year, 3, 1),
                            paid_at: Date.new(tax_year, 3, 1),
                            total_amount_in_usd_cents: 1_000_00)
  end

  def required_blanks(number) = "".ljust(number)

  describe "#process" do
    context "when there are US contractors with total cash amount for tax year greater than or equal to $600" do
      before do
        # Invoices for other tax years
        create(:invoice, :paid, company_worker: us_resident_company_worker,
                                invoice_date: Date.new(tax_year - 1, 1, 1), total_amount_in_usd_cents: 600_00)
        create(:invoice, :paid, company_worker: us_resident_company_worker,
                                invoice_date: Date.new(tax_year + 1, 1, 1), total_amount_in_usd_cents: 600_00)

        # Invoices for other statuses
        create(:invoice, :failed, company_worker: us_resident_company_worker,
                                  invoice_date: Date.new(tax_year, 1, 1), total_amount_in_usd_cents: 600_00)
        create(:invoice, :approved, company_worker: us_resident_company_worker,
                                    invoice_date: Date.new(tax_year, 1, 1), total_amount_in_usd_cents: 600_00)
      end

      it "returns a string with the correct form data" do
        records = service.process.split("\n\n")
        expect(records.size).to eq(5)

        transmitter_record, issuer_record, payee_record, end_of_issuer_record, end_of_transmission_record = records
        expect(transmitter_record).to eq(
          [
            "T",
            tax_year.to_s,
            required_blanks(1), # Prior year data indicator
            transmitter_company.tax_id, # Payer TIN
            GlobalConfig.dig("irs", "tcc_1099"), # Transmitter control code
            required_blanks(9),
            "GUMROAD".ljust(80), # Transmitter name
            "GUMROAD".ljust(80), # Company name
            transmitter_company.street_address.upcase.ljust(40),
            "SAN FRANCISCO".ljust(40),
            "CA", # State code
            transmitter_company.zip_code.ljust(9),
            required_blanks(15),
            "00000001", # Total number of payees
            normalized_tax_field(transmitter_company.primary_admin.user.legal_name, 40), # Issuer contact name
            transmitter_company.phone_number.delete("-").ljust(15),
            transmitter_company.email.ljust(50),
            required_blanks(91),
            "00000001", # Sequence number
            required_blanks(10),
            "I", # Vendor indicator
            required_blanks(230),
          ].join
        )

        expect(issuer_record).to eq(
          [
            "A",
            tax_year.to_s,
            required_blanks(6),
            company.tax_id,
            "ACME", # Issuer name control
            required_blanks(1),
            "NE", # Type of return
            "1".ljust(18), # Total amount codes
            required_blanks(7),
            normalized_tax_field(company.primary_admin.user.legal_name, 80), # Issuer contact name
            "1", # Transfer indicator agent
            company.street_address.upcase.ljust(40),
            "NEW YORK".ljust(40),
            "NY", # State code
            company.zip_code.ljust(9),
            company.phone_number.delete("-").ljust(15),
            required_blanks(260),
            "00000002", # Sequence number
            required_blanks(241),
          ].join
        )

        user_compliance_info = us_resident.reload.compliance_info
        user_name = normalized_tax_field(user_compliance_info.legal_name).split
        last_name = user_name.last
        first_name = user_name[0..-2].join(" ")
        expect(payee_record).to eq(
          [
            "B",
            tax_year.to_s,
            required_blanks(1), # Corrected return indicator
            last_name[0..3].ljust(4), # Payee name control
            "2", # Type of TIN, 1 = EIN, 2 = SSN
            "000000000", # Payee TIN
            us_resident.id.to_s.rjust(20), # Unique issuer account number for payee
            required_blanks(14),
            "70000".rjust(12, "0"), # Compensation amount for payee
            "".rjust(204, "0"), # Unused payment amount fields
            required_blanks(17),
            "#{last_name} #{first_name}".ljust(80),
            normalized_tax_field(user_compliance_info.street_address, 40),
            required_blanks(40),
            normalized_tax_field(user_compliance_info.city, 40),
            user_compliance_info.state,
            normalized_tax_field(user_compliance_info.zip_code, 9),
            required_blanks(1),
            "00000003", # Sequence number
            required_blanks(241),
          ].join
        )

        expect(end_of_issuer_record).to eq(
          [
            "C",
            "1".rjust(8, "0"), # Total number of payees
            required_blanks(6),
            "70000".rjust(18, "0"), # Total invoices amount
            "".rjust(306, "0"), # Unused amount fields
            required_blanks(160),
            "00000004", # Sequence number
            required_blanks(241),
          ].join
        )

        expect(end_of_transmission_record).to eq(
          [
            "F",
            "1".rjust(8, "0"),
            "".rjust(21, "0"),
            required_blanks(469),
            "00000005", # Sequence number
            required_blanks(241),
          ].join
        )
      end

      context "when it is a test file" do
        it "includes the test file indicator in the transmitter record" do
          expect(
            described_class.new(company:, tax_year:, is_test: true).process
          ).to start_with("T#{tax_year}#{required_blanks(1)}#{transmitter_company.tax_id}#{GlobalConfig.dig("irs", "tcc_1099")}#{required_blanks(7)}T")
        end
      end

      context "when payee is a business entity" do
        before { us_resident.reload.compliance_info.update!(business_entity: true, business_name: "Acme Inc.", business_type: "llc", tax_classification: "c_corporation") }

        it "includes the business name control and EIN indicator in the payee record" do
          records = service.process.split("\n\n")
          expect(records.size).to eq(5)

          _, _, payee_record, _, _ = records
          expect(payee_record).to start_with("B#{tax_year}#{required_blanks(1)}ACME1")
        end
      end
    end

    context "when there are no invoices" do
      before { company.invoices.destroy_all }

      it "returns nil" do
        expect(service.process).to be_nil
      end
    end
  end

  describe "#payee_ids" do
    context "when there are US contractors with total cash amount for tax year greater than or equal to $600" do
      it "returns an array of user ids" do
        expect(service.payee_ids).to match_array([us_resident.id])
      end
    end

    context "when there are no invoices" do
      before { company.invoices.destroy_all }

      it "returns an empty array" do
        expect(service.payee_ids).to eq([])
      end
    end
  end

  describe "#type_of_return" do
    it "returns 'NE'" do
      expect(service.type_of_return).to eq("NE")
    end
  end

  describe "#amount_codes" do
    it "returns an 18 long string left justified with the correct amount codes set" do
      form_1099nec_amount_code = "1"
      expect(service.amount_codes).to eq(form_1099nec_amount_code + " " * 17) # 18 long string
    end
  end

  private
    def normalized_tax_field(field, length = nil)
      length ||= field.length
      I18n.transliterate(field).gsub(/[^0-9A-Za-z\s]/, "").upcase.ljust(length)
    end
end
