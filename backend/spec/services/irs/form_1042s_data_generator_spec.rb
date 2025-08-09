# frozen_string_literal: true

RSpec.describe Irs::Form1042sDataGenerator do
  let(:tax_year) { 2023 }
  let!(:transmitter_company) do
    create(
      :company,
      :completed_onboarding,
      email: "hi@gumroad.com",
      name: "Gumroad, Inc.",
      tax_id: "453361423",
      street_address: "548 Market St",
      city: "San Francisco",
      state: "CA",
      zip_code: "94105",
      country_code: "US",
      phone_number: "555-123-4568"
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
  let(:non_us_resident_1) do
    user = create(:user, :without_compliance_info, country_code: "AU")
    create(:company_investor, company:, user:)
    user
  end
  let(:non_us_resident_2) do
    user = create(:user, :without_compliance_info, legal_name: "Răzvan Flex",
                                                   country_code: "CA", city: "Calgary", state: "AB")
    create(:company_investor, company:, user:)
    user
  end
  let(:non_us_resident_3) do
    user = create(:user, :without_compliance_info, country_code: "AE")
    create(:company_investor, company:, user:)
    user
  end
  let(:non_us_resident_4) do
    user = create(:user, :without_compliance_info, country_code: "RO")
    create(:company_investor, company:, user:)
    user
  end
  let!(:non_us_user_compliance_info_1) do
    create(:user_compliance_info, :non_us_resident, :confirmed, user: non_us_resident_1, country_code: "AU")
  end
  let!(:non_us_user_compliance_info_2) do
    create(:user_compliance_info, :non_us_resident, :confirmed,
           user: non_us_resident_2,
           legal_name: "Răzvan Flex",
           country_code: "CA",
           city: "Calgary",
           state: "AB")
  end
  let!(:non_us_user_compliance_info_3) do
    create(:user_compliance_info, :non_us_resident, :confirmed, user: non_us_resident_3, country_code: "AE")
  end
  let!(:non_us_user_compliance_info_4) do
    create(:user_compliance_info, :non_us_resident, :confirmed, user: non_us_resident_4, country_code: "RO")
  end

  subject(:service) { described_class.new(company:, tax_year:) }

  before do
    create(:user_compliance_info, :us_resident, user: us_resident, tax_information_confirmed_at: 1.day.ago, deleted_at: 1.hour.ago)
    create(:user_compliance_info, :us_resident, user: us_resident, tax_information_confirmed_at: Time.current)
    create(:user_compliance_info, :us_resident, user: us_resident_2, city: "APO", state: "AE", tax_information_confirmed_at: 1.day.ago, deleted_at: 1.hour.ago)
    create(:user_compliance_info, :non_us_resident, user: non_us_resident_1, tax_information_confirmed_at: 1.day.ago, deleted_at: 1.hour.ago)

    company_investor = non_us_resident_1.company_investors.first!
    create(:dividend, :paid, company_investor:, company:, user_compliance_info: non_us_user_compliance_info_1,
                             total_amount_in_cents: 10_00,
                             net_amount_in_cents: 8_50,
                             withheld_tax_cents: 1_50,
                             withholding_percentage: 15,
                             created_at: Date.new(tax_year, 4, 1),
                             paid_at: Date.new(tax_year, 4, 7))
    create(:dividend, :paid, company_investor:, company:, user_compliance_info: non_us_user_compliance_info_1,
                             total_amount_in_cents: 10_00,
                             net_amount_in_cents: 8_50,
                             withheld_tax_cents: 1_50,
                             withholding_percentage: 15,
                             created_at: Date.new(tax_year, 7, 1),
                             paid_at: Date.new(tax_year, 7, 7))

    create(:dividend, :paid, company_investor: non_us_resident_2.company_investors.first!, company:,
                             user_compliance_info: non_us_user_compliance_info_2,
                             total_amount_in_cents: 100_00,
                             net_amount_in_cents: 85_00,
                             withheld_tax_cents: 15_00,
                             withholding_percentage: 15,
                             created_at: Date.new(tax_year, 1, 1),
                             paid_at: Date.new(tax_year, 1, 7))

    create(:dividend, company_investor: non_us_resident_3.company_investors.first!, company:,
                      user_compliance_info: non_us_user_compliance_info_3,
                      total_amount_in_cents: 10_00,
                      net_amount_in_cents: 7_00,
                      withheld_tax_cents: 3_00,
                      withholding_percentage: 30,
                      created_at: Date.new(tax_year, 1, 1))
    create(:dividend, :paid, company_investor: non_us_resident_3.company_investors.first!, company:,
                             user_compliance_info: non_us_user_compliance_info_3,
                             total_amount_in_cents: 10_00,
                             net_amount_in_cents: 7_00,
                             withheld_tax_cents: 3_00,
                             withholding_percentage: 30,
                             created_at: Date.new(tax_year, 4, 1),
                             paid_at: Date.new(tax_year, 4, 1))

    # Dividend under $10
    create(:dividend, :paid, company_investor: non_us_resident_4.company_investors.first!, company:,
                             user_compliance_info: non_us_user_compliance_info_4,
                             total_amount_in_cents: 5_00,
                             net_amount_in_cents: 4_50,
                             withheld_tax_cents: 0_50,
                             withholding_percentage: 10,
                             created_at: Date.new(tax_year, 1, 1),
                             paid_at: Date.new(tax_year, 1, 1))

    # Unpaid dividend
    create(:dividend, company_investor:, company:,
                      user_compliance_info: non_us_user_compliance_info_1,
                      total_amount_in_cents: 10_00,
                      net_amount_in_cents: 8_50,
                      withheld_tax_cents: 1_50,
                      withholding_percentage: 15,
                      created_at: Date.new(tax_year, 1, 1))

    # Dividends for other tax years
    create(:dividend, :paid, company_investor:, company:,
                             user_compliance_info: non_us_user_compliance_info_1,
                             total_amount_in_cents: 10_00,
                             net_amount_in_cents: 8_50,
                             withheld_tax_cents: 1_50,
                             withholding_percentage: 15,
                             paid_at: Date.new(tax_year - 1, 1, 1),
                             created_at: Date.new(tax_year - 1, 1, 1))
    create(:dividend, :paid, company_investor:, company:,
                             user_compliance_info: non_us_user_compliance_info_1,
                             total_amount_in_cents: 600_00,
                             net_amount_in_cents: 510_00,
                             withheld_tax_cents: 90_00,
                             withholding_percentage: 15,
                             paid_at: Date.new(tax_year - 1, 1, 1),
                             created_at: Date.new(tax_year - 1, 1, 1))
  end

  def required_blanks(number) = "".ljust(number)

  def create_legacy_tax_documents
    create(:tax_document, :form_1042s, company:, user_compliance_info: non_us_user_compliance_info_1, tax_year:)
    create(:tax_document, :form_1042s, company:, user_compliance_info: non_us_user_compliance_info_1, tax_year: tax_year - 1)
    create(:tax_document, :form_1042s, company:, user_compliance_info: non_us_user_compliance_info_2, tax_year:)
    create(:tax_document, :form_1042s, company:, user_compliance_info: non_us_user_compliance_info_3, tax_year:)
  end

  def create_new_tax_documents
    create(:tax_doc, :form_1042s, company:, user_compliance_info: non_us_user_compliance_info_1, year: tax_year)
    create(:tax_doc, :form_1042s, company:, user_compliance_info: non_us_user_compliance_info_1, year: tax_year - 1)
    create(:tax_doc, :form_1042s, company:, user_compliance_info: non_us_user_compliance_info_2, year: tax_year)
    create(:tax_doc, :form_1042s, company:, user_compliance_info: non_us_user_compliance_info_3, year: tax_year)
  end

  def create_tax_doc(trait:, company:, user_compliance_info:, tax_year:)
    create(:tax_doc, trait, company:, user_compliance_info:, year: tax_year)
  end

  describe "#process" do
    shared_examples_for "common assertions" do
      context "when there are foreign investors with total dividends amount for tax year greater than or equal to $10" do
        it "returns a string with the correct form data" do
          records = service.process.split("\n\n")
          expect(records.size).to eq(7)

          transmitter_record, issuer_record, _, _, _, reconciliation_record, end_of_transmission_record = records

          expect(transmitter_record).to eq(
            [
              "T",
              tax_year.to_s,
              transmitter_company.tax_id, # Payer TIN
              "GUMROAD INC".ljust(40), # Company name
              normalized_tax_field(transmitter_company.street_address, 40),
              "SAN FRANCISCO".ljust(20),
              "CA", # State code
              required_blanks(4),
              normalized_tax_field(transmitter_company.zip_code, 9),
              normalized_tax_field(transmitter_company.primary_admin.user.legal_name, 40), # Issuer contact name
              normalized_tax_field(transmitter_company.phone_number, 20),
              GlobalConfig.dig("irs", "tcc_1042"), # Transmitter control code
              required_blanks(816),
              "00000001", # Sequence number
            ].join
          )

          expect(issuer_record).to eq(
            [
              "W",
              "0", # Return indicator; 0 = Original, 1 = Amended
              "0", # Pro Rata Basis Reporting; 0 = No, 1 = Yes
              normalized_tax_field(company.tax_id),
              "0", # Withholding agent indicator; 0 = EIN
              "ACME INC".ljust(120), # Company name
              normalized_tax_field(company.street_address, 80),
              "NEW YORK".ljust(40),
              "NY", # State code
              required_blanks(4), # Province code + country code (only required for foreign issuers)
              normalized_tax_field(company.zip_code, 9),
              tax_year.to_s,
              normalized_tax_field(company.primary_admin.user.legal_name.upcase, 45), # Issuer contact name
              "CEO".ljust(45), # Withholding agent's department title
              normalized_tax_field(company.phone_number, 20),
              "0", # Final return indicator
              "3", # Withholding indicator
              required_blanks(148),
              "1502", # Amount codes
              required_blanks(474),
              "00000002", # Sequence number
            ].join
          )

          [
            non_us_user_compliance_info_1,
            non_us_user_compliance_info_2,
            non_us_user_compliance_info_3,
          ].each_with_index do |user_compliance_info, index|
            dividends = user_compliance_info.dividends.for_tax_year(tax_year)
            gross_amount_in_usd = (dividends.sum(:total_amount_in_cents) / 100.to_d).round
            net_amount_in_usd = (dividends.sum(:net_amount_in_cents) / 100.to_d).round
            withheld_tax_in_usd = (dividends.sum(:withheld_tax_cents) / 100.to_d).round
            withholding_percentage = dividends.maximum(:withholding_percentage)
            chapter_3_exemption_code = withholding_percentage == TaxWithholdingCalculator::TAX_RATE_FOR_COUNTRIES_WITHOUT_TREATY ? "00" : "04"
            country_code = user_compliance_info.country_code
            province_code = country_code == "CA" ? user_compliance_info.state : required_blanks(2)
            date_of_birth = user_compliance_info.birth_date&.strftime("%Y%m%d") || required_blanks(8)

            expect(records[index + 2]).to eq(
              [
                "Q",
                "0", # Return indicator; 0 = Original, 1 = Amended
                "0", # Pro Rata Basis Reporting; 0 = No, 1 = Yes
                "06", # Type of return
                gross_amount_in_usd.to_s.rjust(12, "0"), # Gross amount paid
                "".rjust(12, "0"),
                net_amount_in_usd.to_s.rjust(12, "0"), # Net amount paid
                withholding_percentage.to_s.ljust(4, "0"), # Withholding percentage
                chapter_3_exemption_code,
                country_code, # Country code
                "0000", # Chapter 4 tax rate
                "15", # Chapter 4 exemption code
                required_blanks(4),
                "".rjust(12, "0"), # Unused payment amount fields
                required_blanks(22),
                normalized_tax_field(user_compliance_info.legal_name, 120),
                normalized_tax_field(user_compliance_info.street_address, 80),
                normalized_tax_field(user_compliance_info.city, 40),
                required_blanks(2),
                province_code,
                country_code,
                normalized_tax_field(user_compliance_info.zip_code, 9),
                required_blanks(9), # Unused recipient's US TIN
                required_blanks(1), # Reserved blanks
                withheld_tax_in_usd.to_s.rjust(12, "0"), # U.S. federal wax withheld
                "".rjust(12, "0"), # Unused payment amount fields
                withheld_tax_in_usd.to_s.rjust(12, "0"), # Total withholding credit
                required_blanks(321),
                "".rjust(12, "0"), # Unused state income tax withheld
                required_blanks(34),
                user_compliance_info.tax_id.delete("-").ljust(22), # Recipient's foreign TIN
                "3", # Chapter indicator
                required_blanks(1),
                "16", # Chapter 3 status code
                "23", # Chapter 4 status code
                required_blanks(21),
                date_of_birth,
                "".rjust(12, "0"), # Unused payment amount fields
                required_blanks(157),
                user_compliance_info.id.to_s.rjust(10, "0"), # Unique form identifier for payee
                required_blanks(13),
                "0000000#{index + 3}", # Sequence number
              ].join
            )
          end

          expect(reconciliation_record).to eq(
            [
              "C",
              "3".rjust(8, "0"), # Total number of payees
              required_blanks(6),
              "130".rjust(15, "0"), # Total dividends amount
              "21".rjust(15, "0"), # Total tax withheld amount
              required_blanks(965),
              "00000006", # Sequence number
            ].join
          )

          expect(end_of_transmission_record).to eq(
            [
              "F",
              "1".rjust(3, "0"),
              required_blanks(1006),
              "00000007", # Sequence number
            ].join
          )
        end

        context "when it is a test file" do
          it "includes the test file indicator in the transmitter record" do
            transmitter_record, _ = described_class.new(company:, tax_year:, is_test: true).process.split("\n\n")
            expect(transmitter_record).to end_with("#{GlobalConfig.dig("irs", "tcc_1042")}TEST#{required_blanks(812)}00000001")
          end
        end

        context "when payee is a business entity" do
          before { non_us_user_compliance_info_1.update!(business_entity: true, business_name: "Acme Inc.", business_type: "c_corporation") }

          it "includes the business name and in the payee record" do
            records = service.process.split("\n\n")
            expect(records.size).to eq(7)

            _, _, payee_record, _, _, _ = records
            expect(payee_record).to include(normalized_tax_field(non_us_user_compliance_info_1.business_name))
            expect(payee_record).to_not include(normalized_tax_field(non_us_user_compliance_info_1.legal_name))
          end
        end

        context "when a payee changes their residence country mid-year" do
          let!(:new_user_compliance_info) do
            non_us_resident_3.reload
            UpdateUser.new(
              user: non_us_resident_3,
              update_params: {
                country_code: "FR",
                street_address: "1 Rue de Rivoli",
                city: "Paris",
                state: "75C",
                zip_code: "75001",
              },
              confirm_tax_info: true,
            ).process
            non_us_resident_3.reload.compliance_info
          end

          before do
            create(:dividend, :paid, company_investor: non_us_resident_3.company_investors.first!, company:,
                                     user_compliance_info: new_user_compliance_info,
                                     total_amount_in_cents: 100_00,
                                     net_amount_in_cents: 85_00,
                                     withheld_tax_cents: 15_00,
                                     withholding_percentage: 15,
                                     created_at: Date.new(tax_year, 7, 1),
                                     paid_at: Date.new(tax_year, 7, 7))
            create_tax_doc(trait: :form_1042s, company:, user_compliance_info: new_user_compliance_info, tax_year:)
          end

          it "returns a string with the correct form data" do
            records = service.process.split("\n\n")
            expect(records.size).to eq(8)

            [
              non_us_user_compliance_info_1,
              non_us_user_compliance_info_2,
              non_us_user_compliance_info_3,
              new_user_compliance_info,
            ].each_with_index do |user_compliance_info, index|
              dividends = user_compliance_info.dividends.for_tax_year(tax_year)
              gross_amount_in_usd = (dividends.sum(:total_amount_in_cents) / 100.to_d).round
              net_amount_in_usd = (dividends.sum(:net_amount_in_cents) / 100.to_d).round
              withheld_tax_in_usd = (dividends.sum(:withheld_tax_cents) / 100.to_d).round
              withholding_percentage = dividends.maximum(:withholding_percentage)
              chapter_3_exemption_code = withholding_percentage == TaxWithholdingCalculator::TAX_RATE_FOR_COUNTRIES_WITHOUT_TREATY ? "00" : "04"
              country_code = user_compliance_info.country_code
              province_code = country_code == "CA" ? user_compliance_info.state : required_blanks(2)
              date_of_birth = user_compliance_info.birth_date&.strftime("%Y%m%d") || required_blanks(8)

              expect(records[index + 2]).to eq(
                [
                  "Q",
                  "0", # Return indicator; 0 = Original, 1 = Amended
                  "0", # Pro Rata Basis Reporting; 0 = No, 1 = Yes
                  "06", # Type of return
                  gross_amount_in_usd.to_s.rjust(12, "0"), # Gross amount paid
                  "".rjust(12, "0"),
                  net_amount_in_usd.to_s.rjust(12, "0"), # Net amount paid
                  withholding_percentage.to_s.ljust(4, "0"), # Withholding percentage
                  chapter_3_exemption_code,
                  country_code, # Country code
                  "0000", # Chapter 4 tax rate
                  "15", # Chapter 4 exemption code
                  required_blanks(4),
                  "".rjust(12, "0"), # Unused payment amount fields
                  required_blanks(22),
                  normalized_tax_field(user_compliance_info.legal_name, 120),
                  normalized_tax_field(user_compliance_info.street_address, 80),
                  normalized_tax_field(user_compliance_info.city, 40),
                  required_blanks(2),
                  province_code,
                  country_code,
                  normalized_tax_field(user_compliance_info.zip_code, 9),
                  required_blanks(9), # Unused recipient's US TIN
                  required_blanks(1), # Reserved blanks
                  withheld_tax_in_usd.to_s.rjust(12, "0"), # U.S. federal wax withheld
                  "".rjust(12, "0"), # Unused payment amount fields
                  withheld_tax_in_usd.to_s.rjust(12, "0"), # Total withholding credit
                  required_blanks(321),
                  "".rjust(12, "0"), # Unused state income tax withheld
                  required_blanks(34),
                  user_compliance_info.tax_id.delete("-").ljust(22), # Recipient's foreign TIN
                  "3", # Chapter indicator
                  required_blanks(1),
                  "16", # Chapter 3 status code
                  "23", # Chapter 4 status code
                  required_blanks(21),
                  date_of_birth,
                  "".rjust(12, "0"), # Unused payment amount fields
                  required_blanks(157),
                  user_compliance_info.id.to_s.rjust(10, "0"), # Unique form identifier for payee
                  required_blanks(13),
                  "0000000#{index + 3}", # Sequence number
                ].join
              )
            end

            expect(records[6]).to eq(
              [
                "C",
                "4".rjust(8, "0"), # Total number of payees
                required_blanks(6),
                "230".rjust(15, "0"), # Total dividends amount
                "36".rjust(15, "0"), # Total tax withheld amount
                required_blanks(965),
                "00000007", # Sequence number
              ].join
            )

            expect(records[7]).to eq(
              [
                "F",
                "1".rjust(3, "0"),
                required_blanks(1006),
                "00000008", # Sequence number
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
      context "when there are foreign investors with total dividends amount for tax year greater than or equal to $10" do
        it "returns an array of user compliance info ids" do
          expect(service.payee_ids).to match_array(
            [
              non_us_user_compliance_info_1.id,
              non_us_user_compliance_info_2.id,
              non_us_user_compliance_info_3.id,
            ]
          )
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
      it "returns the correct type fo return for 1042-S form" do
        expect(service.type_of_return).to eq("06")
      end
    end

    before { create_new_tax_documents }

    include_examples "common assertions"
  end

  describe "#amount_codes" do
    shared_examples_for "common assertions" do
      it "returns the correct amount codes" do
        expect(service.amount_codes).to eq("1502")
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
