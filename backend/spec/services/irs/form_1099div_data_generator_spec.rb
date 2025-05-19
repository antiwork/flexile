# frozen_string_literal: true

RSpec.describe Irs::Form1099divDataGenerator do
  let(:tax_year) { 2023 }
  let!(:transmitter_company) do
    create(
      :company,
      :completed_onboarding,
      is_gumroad: true,
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
      irs_tax_forms: true,
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
  let(:non_us_resident_1) do
    user = create(:user, :without_compliance_info, country_code: "AU")
    create(:company_investor, company:, user:)
    user
  end
  let(:non_us_resident_2) do
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
  let!(:non_us_user_compliance_info) { create(:user_compliance_info, :non_us_resident, :confirmed, user: non_us_resident_2) }

  subject(:service) { described_class.new(company:, tax_year:) }

  before do
    non_us_compliance_info_1 = create(:user_compliance_info, :us_resident, :confirmed, user: non_us_resident_1)

    company_investor = us_resident.company_investors.first!
    create(:dividend, company_investor:, company:, user_compliance_info:,
                      total_amount_in_cents: 10_00, created_at: Date.new(tax_year, 1, 1))
    create(:dividend, :paid, :qualified, company_investor:, company:, user_compliance_info:,
                                         total_amount_in_cents: 10_00,
                                         created_at: Date.new(tax_year, 4, 1),
                                         paid_at: Date.new(tax_year, 4, 7))
    create(:dividend, :paid, :qualified, company_investor:, company:, user_compliance_info:,
                                         total_amount_in_cents: 10_00,
                                         created_at: Date.new(tax_year, 7, 1),
                                         paid_at: Date.new(tax_year, 7, 7))

    create(:dividend, :paid, company_investor: us_resident_2.company_investors.first!, company:,
                             user_compliance_info: user_compliance_info_2,
                             total_amount_in_cents: 100_00,
                             withheld_tax_cents: 24_00,
                             withholding_percentage: 24,
                             created_at: Date.new(tax_year, 1, 1),
                             paid_at: Date.new(tax_year, 1, 7))

    # Dividend under $10
    create(:dividend, :paid, company_investor: non_us_resident_1.company_investors.first!, company:,
                             user_compliance_info: non_us_compliance_info_1,
                             total_amount_in_cents: 5_00,
                             created_at: Date.new(tax_year, 1, 1),
                             paid_at: Date.new(tax_year, 1, 1))

    non_us_resident_2.update!(citizenship_country_code: "FR")
    company_investor_3 = non_us_resident_2.company_investors.first!
    create(:dividend, company_investor: company_investor_3, company:,
                      user_compliance_info: non_us_user_compliance_info,
                      total_amount_in_cents: 10_00, created_at: Date.new(tax_year, 1, 1))
    create(:dividend, :paid, company_investor: company_investor_3, company:,
                             user_compliance_info: non_us_user_compliance_info,
                             total_amount_in_cents: 10_00,
                             created_at: Date.new(tax_year, 4, 1),
                             paid_at: Date.new(tax_year, 4, 1))
  end

  def create_legacy_tax_documents
    create(:tax_document, :form_1099div, company:, user_compliance_info:, tax_year:)
    create(:tax_document, :form_1099div, company:, user_compliance_info: user_compliance_info_2, tax_year:)
  end

  def create_new_tax_documents
    create(:tax_doc, :form_1099div, company:, user_compliance_info:, year: tax_year)
    create(:tax_doc, :form_1099div, company:, user_compliance_info: user_compliance_info_2, year: tax_year)
  end

  def create_tax_doc(trait:, company:, user_compliance_info:, tax_year:)
    create(:tax_doc, trait, company:, user_compliance_info:, year: tax_year)
  end

  def required_blanks(number) = "".ljust(number)

  describe "#process" do
    shared_examples_for "common assertions" do
      context "when there are US investors with total dividends amount for tax year greater than or equal to $10" do
        before do
          # Dividends for other tax years
          create(:dividend, :paid, company:, company_investor: us_resident.company_investors.first!, user_compliance_info:,
                                   created_at: Date.new(tax_year - 1, 1, 1),
                                   paid_at: Date.new(tax_year - 1, 1, 1),
                                   total_amount_in_cents: 10_00)
          create(:dividend, :paid, company:, company_investor: us_resident.company_investors.first!, user_compliance_info:,
                                   created_at: Date.new(tax_year + 1, 1, 1),
                                   paid_at: Date.new(tax_year + 1, 1, 1),
                                   total_amount_in_cents: 600_00)
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
              "1".ljust(2), # Type of return
              "12A".ljust(18), # Amount codes
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
              "2000".rjust(12, "0"), # Dividend amount for payee
              "2000".rjust(12, "0"), # Qualified dividend amount for payee
              "".rjust(192, "0"), # Unused payment amount fields
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
              "10000".rjust(12, "0"), # Compensation amount for payee
              "".rjust(96, "0"), # Unused payment amount fields
              "2400".rjust(12, "0"), # Tax withheld amount for payee
              "".rjust(96, "0"), # Unused payment amount fields
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
              "12000".rjust(18, "0"), # Total dividends amount
              "2000".rjust(18, "0"), # Qualified dividends amount
              "".rjust(126, "0"), # Unused amount fields
              "2400".rjust(18, "0"), # Total withheld amount
              "".rjust(144, "0"), # Unused amount fields
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
              described_class.new(company:, tax_year:, is_test: true).process
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

        context "when a payee changes their country of residence mid-year" do
          let(:tax_id) { Faker::IdNumber.ssn_valid.delete("-") }

          before do
            UpdateUser.new(
              user: non_us_resident_2,
              update_params: {
                country_code: "US",
                street_address: "121 Market St",
                city: "San Francisco",
                state: "CA",
                zip_code: "94100",
                tax_id:,
              },
              confirm_tax_info: true,
            ).process
            user_compliance_info = non_us_resident_2.reload.compliance_info
            company_investor = non_us_resident_2.company_investors.first!
            create(:dividend, :paid, company_investor:, company:, user_compliance_info:,
                                     total_amount_in_cents: 10_00,
                                     created_at: Date.new(tax_year, 7, 1),
                                     paid_at: Date.new(tax_year, 7, 7))

            create_tax_doc(trait: :form_1099div, company:, user_compliance_info:, tax_year:)
          end

          it "includes the payee in the form data" do
            records = service.process.split("\n\n")
            expect(records.size).to eq(7)
            _, _, _, _, payee_record, end_of_issuer_record, end_of_transmission_record = records

            user_compliance_info = non_us_resident_2.reload.compliance_info
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
                tax_id, # Payee TIN
                user_compliance_info.id.to_s.rjust(20), # Unique issuer account number for payee
                required_blanks(14),
                "1000".rjust(12, "0"), # Dividends amount for payee
                "".rjust(204, "0"), # Unused payment amount fields
                required_blanks(17),
                "#{last_name} #{first_name}".ljust(80),
                normalized_tax_field("121 Market St", 40),
                required_blanks(40),
                normalized_tax_field("San Francisco", 40),
                "CA", # State code
                normalized_tax_field("94100", 9),
                required_blanks(1),
                "00000005", # Sequence number
                required_blanks(215),
                "".rjust(24, "0"), # Unused state + local tax withheld amount fields
                required_blanks(2),
              ].join
            )

            expect(end_of_issuer_record).to eq(
              [
                "C",
                "3".rjust(8, "0"), # Total number of payees
                required_blanks(6),
                "13000".rjust(18, "0"), # Total dividends amount
                "2000".rjust(18, "0"), # Qualified dividends amount
                "".rjust(126, "0"), # Unused amount fields
                "2400".rjust(18, "0"), # Total withheld amount
                "".rjust(144, "0"), # Unused amount fields
                required_blanks(160),
                "00000006", # Sequence number
                required_blanks(241),
              ].join
            )

            expect(end_of_transmission_record).to eq(
              [
                "F",
                "1".rjust(8, "0"),
                "".rjust(21, "0"),
                required_blanks(469),
                "00000007", # Sequence number
                required_blanks(241),
              ].join
            )
          end
        end
      end

      context "when there are no dividends" do
        before { company.dividends.destroy_all }

        it "returns nil" do
          expect(service.process).to be_nil
        end
      end
    end

    before { create_new_tax_documents }

    include_examples "common assertions"
  end

  describe "#payee_ids" do
    shared_examples_for "common assertions" do
      context "when there are US investors with total dividends amount for tax year greater than or equal to $10" do
        it "returns an array of user compliance info ids" do
          expect(service.payee_ids).to match_array([user_compliance_info.id, user_compliance_info_2.id])
        end
      end

      context "when there are no dividends" do
        before { company.dividends.destroy_all }

        it "returns an empty array" do
          expect(service.payee_ids).to eq([])
        end
      end
    end

    before { create_new_tax_documents }

    include_examples "common assertions"
  end

  describe "#type_of_return" do
    shared_examples_for "common assertions" do
      it "returns the correct type fo return for 1099-DIV form" do
        expect(service.type_of_return).to eq("1".ljust(2))
      end
    end

    before { create_new_tax_documents }

    include_examples "common assertions"
  end

  describe "#amount_codes" do
    shared_examples_for "common assertions" do
      it "returns an 18 long string left justified with the correct amount codes set" do
        form_1099div_amount_codes = "12A".ljust(18)
        expect(service.amount_codes.length).to eq(18)
        expect(service.amount_codes).to eq(form_1099div_amount_codes)
      end
    end

    before { create_new_tax_documents }

    include_examples "common assertions"
  end

  private
    def normalized_tax_field(field, length = nil)
      length ||= field.length
      I18n.transliterate(field).gsub(/[^0-9A-Za-z\s]/, "").upcase.ljust(length)
    end
end
