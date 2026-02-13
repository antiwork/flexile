# frozen_string_literal: true

RSpec.describe Irs::Form1099bDataGenerator do
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
  let(:us_resident) do
    user = create(:user, :without_compliance_info)
    create(:company_investor, company:, user:)
    user
  end
  let(:us_resident_2) do
    user = create(:user, :without_compliance_info)
    create(:company_investor, company:, user:)
    user
  end
  let(:non_us_resident) do
    user = create(:user, :without_compliance_info, country_code: "FR")
    create(:company_investor, company:, user:)
    user
  end
  let!(:user_compliance_info) do
    create(:user_compliance_info, :us_resident, user: us_resident, tax_information_confirmed_at: 1.day.ago, deleted_at: 1.hour.ago)
    create(:user_compliance_info, :us_resident, :confirmed, user: us_resident)
  end
  let!(:user_compliance_info_2) do
    create(:user_compliance_info, :us_resident, user: us_resident_2, city: "APO", state: "AE", tax_information_confirmed_at: 1.day.ago, deleted_at: 1.hour.ago)
  end
  let!(:non_us_user_compliance_info) { create(:user_compliance_info, :non_us_resident, :confirmed, user: non_us_resident) }
  let!(:roc_dividend_round) { create(:dividend_round, company:, return_of_capital: true) }
  let!(:non_roc_dividend_round) { create(:dividend_round, company:, return_of_capital: false) }

  subject(:service) { described_class.new(company:, transmitter_company:, tax_year:) }

  before do
    company_investor = us_resident.company_investors.first!

    # Return-of-capital dividends for us_resident (should be included)
    create(:dividend, :paid, company_investor:, company:, user_compliance_info:,
                             dividend_round: roc_dividend_round,
                             total_amount_in_cents: 500_00,
                             withheld_tax_cents: 0,
                             created_at: Date.new(tax_year, 6, 1),
                             paid_at: Date.new(tax_year, 6, 15))
    create(:dividend, :paid, company_investor:, company:, user_compliance_info:,
                             dividend_round: roc_dividend_round,
                             total_amount_in_cents: 300_00,
                             withheld_tax_cents: 0,
                             created_at: Date.new(tax_year, 9, 1),
                             paid_at: Date.new(tax_year, 9, 15))

    # Non-ROC dividend for us_resident (should NOT be included in 1099-B)
    create(:dividend, :paid, company_investor:, company:, user_compliance_info:,
                             dividend_round: non_roc_dividend_round,
                             total_amount_in_cents: 1000_00,
                             created_at: Date.new(tax_year, 3, 1),
                             paid_at: Date.new(tax_year, 3, 15))

    # Return-of-capital dividend for us_resident_2 with tax withheld
    company_investor_2 = us_resident_2.company_investors.first!
    create(:dividend, :paid, company_investor: company_investor_2, company:,
                             user_compliance_info: user_compliance_info_2,
                             dividend_round: roc_dividend_round,
                             total_amount_in_cents: 200_00,
                             withheld_tax_cents: 48_00,
                             withholding_percentage: 24,
                             created_at: Date.new(tax_year, 6, 1),
                             paid_at: Date.new(tax_year, 6, 15))

    # Non-US resident with ROC dividend (should NOT appear - non-US)
    non_us_resident.update!(citizenship_country_code: "FR")
    company_investor_3 = non_us_resident.company_investors.first!
    create(:dividend, :paid, company_investor: company_investor_3, company:,
                             user_compliance_info: non_us_user_compliance_info,
                             dividend_round: roc_dividend_round,
                             total_amount_in_cents: 500_00,
                             created_at: Date.new(tax_year, 6, 1),
                             paid_at: Date.new(tax_year, 6, 15))
  end

  def create_new_tax_documents
    create(:document, document_type: :form_1099b, company:, user_compliance_info:, year: tax_year)
    create(:document, document_type: :form_1099b, company:, user_compliance_info: user_compliance_info_2, year: tax_year)
  end

  def required_blanks(number) = "".ljust(number)

  describe "#process" do
    before { create_new_tax_documents }

    context "when there are US investors with return-of-capital dividends for the tax year" do
      before do
        # ROC dividends for other tax years (should not be included)
        create(:dividend, :paid, company:, company_investor: us_resident.company_investors.first!, user_compliance_info:,
                                 dividend_round: roc_dividend_round,
                                 total_amount_in_cents: 500_00,
                                 created_at: Date.new(tax_year - 1, 1, 1),
                                 paid_at: Date.new(tax_year - 1, 1, 1))
        create(:dividend, :paid, company:, company_investor: us_resident.company_investors.first!, user_compliance_info:,
                                 dividend_round: roc_dividend_round,
                                 total_amount_in_cents: 500_00,
                                 created_at: Date.new(tax_year + 1, 1, 1),
                                 paid_at: Date.new(tax_year + 1, 1, 1))
      end

      it "returns a string with the correct form data" do
        records = service.process.split("\n\n")
        expect(records.size).to eq(6)

        transmitter_record, issuer_record, payee_record_1, payee_record_2, end_of_issuer_record, end_of_transmission_record = records
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
            "00000002", # Total number of payees
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
            "B ", # Type of return (Broker transactions)
            "24".ljust(18), # Amount codes (2 = Gross proceeds, 4 = Federal tax withheld)
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

        user_name = normalized_tax_field(user_compliance_info.legal_name).split
        last_name = user_name.last
        first_name = user_name[0..-2].join(" ")
        expect(payee_record_1).to eq(
          [
            "B",
            tax_year.to_s,
            required_blanks(1), # Corrected return indicator
            last_name[0..3].ljust(4), # Payee name control
            "2", # Type of TIN, 1 = EIN, 2 = SSN
            "000000000", # Payee TIN
            user_compliance_info.id.to_s.rjust(20), # Unique issuer account number for payee
            required_blanks(14),
            "".rjust(12, "0"), # Payment amount 1 (unused)
            "80000".rjust(12, "0"), # Payment amount 2 (Gross proceeds: 500_00 + 300_00)
            "".rjust(12, "0"), # Payment amount 3 (unused)
            "".rjust(12, "0"), # Payment amount 4 (Federal tax withheld: 0)
            "".rjust(144, "0"), # Remaining payment amount fields (5-16)
            required_blanks(17),
            "#{last_name} #{first_name}".ljust(80),
            normalized_tax_field(user_compliance_info.street_address, 40),
            required_blanks(40),
            normalized_tax_field(user_compliance_info.city, 40),
            user_compliance_info.state,
            normalized_tax_field(user_compliance_info.zip_code, 9),
            required_blanks(1),
            "00000003", # Sequence number
            required_blanks(215),
            "".rjust(24, "0"), # Unused state + local tax withheld amount fields
            required_blanks(2),
          ].join
        )

        user_name_2 = normalized_tax_field(user_compliance_info_2.legal_name).split
        last_name_2 = user_name_2.last
        first_name_2 = user_name_2[0..-2].join(" ")
        expect(payee_record_2).to eq(
          [
            "B",
            tax_year.to_s,
            required_blanks(1), # Corrected return indicator
            last_name_2[0..3].ljust(4), # Payee name control
            "2", # Type of TIN, 1 = EIN, 2 = SSN
            "000000000", # Payee TIN
            user_compliance_info_2.id.to_s.rjust(20), # Unique issuer account number for payee
            required_blanks(14),
            "".rjust(12, "0"), # Payment amount 1 (unused)
            "20000".rjust(12, "0"), # Payment amount 2 (Gross proceeds: 200_00)
            "".rjust(12, "0"), # Payment amount 3 (unused)
            "4800".rjust(12, "0"), # Payment amount 4 (Federal tax withheld: 48_00)
            "".rjust(144, "0"), # Remaining payment amount fields (5-16)
            required_blanks(17),
            "#{last_name_2} #{first_name_2}".ljust(80),
            normalized_tax_field(user_compliance_info_2.street_address, 40),
            required_blanks(40),
            normalized_tax_field(user_compliance_info_2.city, 40),
            "AE", # Military state code
            normalized_tax_field(user_compliance_info_2.zip_code, 9),
            required_blanks(1),
            "00000004", # Sequence number
            required_blanks(215),
            "".rjust(24, "0"), # Unused state + local tax withheld amount fields
            required_blanks(2),
          ].join
        )

        expect(end_of_issuer_record).to eq(
          [
            "C",
            "2".rjust(8, "0"), # Total number of payees
            required_blanks(6),
            "".rjust(18, "0"), # Payment amount 1 total (unused)
            "100000".rjust(18, "0"), # Payment amount 2 total (Gross proceeds: 80000 + 20000)
            "".rjust(18, "0"), # Payment amount 3 total (unused)
            "4800".rjust(18, "0"), # Payment amount 4 total (Federal tax withheld)
            "".rjust(216, "0"), # Remaining amount totals (5-16)
            required_blanks(160),
            "00000005", # Sequence number
            required_blanks(241),
          ].join
        )

        expect(end_of_transmission_record).to eq(
          [
            "F",
            "1".rjust(8, "0"),
            "".rjust(21, "0"),
            required_blanks(469),
            "00000006", # Sequence number
            required_blanks(241),
          ].join
        )
      end

      context "when it is a test file" do
        it "includes the test file indicator in the transmitter record" do
          expect(
            described_class.new(company:, transmitter_company:, tax_year:, is_test: true).process
          ).to start_with("T#{tax_year}#{required_blanks(1)}#{transmitter_company.tax_id}#{GlobalConfig.dig("irs", "tcc_1099")}#{required_blanks(7)}T")
        end
      end

      context "when payee is a business entity" do
        before do
          us_resident.reload.compliance_info.update!(business_entity: true, business_name: "Acme Inc.", business_type: "s_corporation")
        end

        it "includes the business name control and EIN indicator in the payee record" do
          records = service.process.split("\n\n")
          expect(records.size).to eq(6)

          _, _, payee_record, _, _ = records
          expect(payee_record).to start_with("B#{tax_year}#{required_blanks(1)}ACME1")
        end
      end
    end

    context "when there are no return-of-capital dividends" do
      before { Dividend.joins(:dividend_round).where(dividend_rounds: { return_of_capital: true }).destroy_all }

      it "returns nil" do
        expect(service.process).to be_nil
      end
    end
  end

  describe "#payee_ids" do
    before { create_new_tax_documents }

    context "when there are US investors with return-of-capital dividends for the tax year" do
      it "returns an array of user compliance info ids" do
        expect(service.payee_ids).to match_array([user_compliance_info.id, user_compliance_info_2.id])
      end
    end

    context "when there are no return-of-capital dividends" do
      before { Dividend.joins(:dividend_round).where(dividend_rounds: { return_of_capital: true }).destroy_all }

      it "returns an empty array" do
        expect(service.payee_ids).to eq([])
      end
    end
  end

  describe "#type_of_return" do
    it "returns 'B ' for broker transactions" do
      expect(service.type_of_return).to eq("B ")
    end
  end

  describe "#amount_codes" do
    it "returns an 18 long string left justified with the correct amount codes set" do
      form_1099b_amount_codes = "24".ljust(18)
      expect(service.amount_codes.length).to eq(18)
      expect(service.amount_codes).to eq(form_1099b_amount_codes)
    end
  end

  private
    def normalized_tax_field(field, length = nil)
      length ||= field.length
      I18n.transliterate(field).gsub(/[^0-9A-Za-z\s]/, "").upcase.ljust(length)
    end
end
