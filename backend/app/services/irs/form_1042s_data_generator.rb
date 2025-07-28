# frozen_string_literal: true

class Irs::Form1042sDataGenerator < Irs::BaseFormDataGenerator
  def payee_ids
    @_payee_ids ||= data_for_tax_year_by_user_compliance_info_id.map { _1["id"] }
  end

  def type_of_return = "06" # Dividends

  def amount_codes = "1502" # Chapter 3 + Chapter 4 status codes

  def serialize_form_data
    result = ""
    user_compliance_infos.find_each.with_index(3) do |user_compliance_info, index|
      result += serialize_payee_record(user_compliance_info:, index:)
    end
    result + reconciliation_record
  end

  private
    def test_file_indicator = is_test ? "TEST" : required_blanks(4)

    def payee_province_code(user_compliance_info)
      payee_is_from_canada = user_compliance_info.country_code == "CA"
      return required_blanks(2) unless payee_is_from_canada
      user_compliance_info.state.upcase
    end

    def user_compliance_infos
      return @_user_compliance_infos if defined?(@_user_compliance_infos)

      @_user_compliance_infos = UserComplianceInfo.includes(:user)
                                                    .joins(:documents)
                                                    .where(documents:
                                                             {
                                                               company:,
                                                               year: tax_year,
                                                               name: Document::FORM_1042_S,
                                                               deleted_at: nil,
                                                               document_type: :tax_document,
                                                             })
                                                    .where.not(country_code: "US")
    end

    def data_for_tax_year_by_user_compliance_info_id
      sql = user_compliance_infos.joins(:dividends)
                                 .merge(Dividend.for_tax_year(tax_year))
                                 .select("user_compliance_infos.id," \
                                         "MAX(dividends.withholding_percentage) as withholding_percentage," \
                                         "CAST(ROUND(SUM(dividends.total_amount_in_cents) / 100.0) AS INTEGER) AS total_amount_in_usd," \
                                         "CAST(ROUND(SUM(dividends.net_amount_in_cents) / 100.0) AS INTEGER) AS net_amount_in_usd," \
                                         "CAST(ROUND(SUM(dividends.withheld_tax_cents) / 100.0) AS INTEGER) AS withheld_tax_in_usd")
                                 .group("user_compliance_infos.id")
                                 .to_sql
      @_total_amounts_for_tax_year_by_user_compliance_info_id ||= ApplicationRecord.connection.execute(sql).to_a
    end

    def serialize_payee_record(user_compliance_info:, index:)
      payee_data = data_for_tax_year_by_user_compliance_info_id.find { _1["id"] == user_compliance_info.id }
      chapter_3_tax_rate = payee_data["withholding_percentage"]
      chapter_3_exemption_code = chapter_3_tax_rate == TaxWithholdingCalculator::TAX_RATE_FOR_COUNTRIES_WITHOUT_TREATY ? "00" : "04"
      country_code = user_compliance_info.country_code
      date_of_birth = user_compliance_info.birth_date.present? ?
                        user_compliance_info.birth_date.strftime("%Y%m%d") :
                        required_blanks(8)
      billing_entity_name = user_compliance_info.business_entity ?
                              user_compliance_info.business_name :
                              user_compliance_info.legal_name

      [
        "Q",
        "0", # Return indicator; 0 = Original, 1 = Amended
        "0", # Pro Rata Basis Reporting; 0 = No, 1 = Yes
        type_of_return,
        payee_data["total_amount_in_usd"].to_s.rjust(12, "0"),
        "".rjust(12, "0"),
        payee_data["net_amount_in_usd"].to_s.rjust(12, "0"),
        chapter_3_tax_rate.to_s.ljust(4, "0"),
        chapter_3_exemption_code, # Chapter 3 exemption code
        country_code,
        "0000", # Chapter 4 tax rate
        "15", # Chapter 4 exemption code
        required_blanks(4),
        "".rjust(12, "0"), # Unused payment amount fields
        required_blanks(22),
        normalized_tax_field(billing_entity_name, 120),
        normalized_tax_field(user_compliance_info.street_address, 80),
        normalized_tax_field(user_compliance_info.city, 40),
        required_blanks(2),
        payee_province_code(user_compliance_info),
        country_code,
        normalized_tax_field(user_compliance_info.zip_code, 9),
        required_blanks(10),
        payee_data["withheld_tax_in_usd"].to_s.rjust(12, "0"), # U.S. federal wax withheld
        "".rjust(12, "0"), # Unused payment amount fields
        payee_data["withheld_tax_in_usd"].to_s.rjust(12, "0"), # Total withholding credit
        required_blanks(321),
        "".rjust(12, "0"), # Unused state income tax withheld
        required_blanks(34),
        normalized_tax_field(normalized_tax_id_for(user_compliance_info), 22), # Recipient's foreign TIN
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
        sequence_number(index),
        "\n\n",
      ].join
    end

    def transmitter_record
      [
        "T",
        tax_year.to_s,
        normalized_tax_id_for(transmitter_company), # Payer TIN
        normalized_tax_field(transmitter_company.name, 40), # Transmitter name
        normalized_tax_field(transmitter_company.street_address, 40),
        normalized_tax_field(transmitter_company.city, 20),
        transmitter_company.state,
        required_blanks(4), # Province code + country code (only required for foreign transmitters)
        normalized_tax_field(transmitter_company.zip_code, 9),
        transmitter_administrator_legal_name.ljust(40), # Transmitter contact name
        normalized_tax_field(transmitter_company.phone_number, 20),
        GlobalConfig.dig("irs", "tcc_1042"), # Transmitter control code
        test_file_indicator,
        required_blanks(812),
        sequence_number(1),
        "\n\n",
      ].join
    end

    def issuer_record
      [
        "W",
        "0", # Return indicator; 0 = Original, 1 = Amended
        "0", # Pro Rata Basis Reporting; 0 = No, 1 = Yes
        normalized_tax_id_for(company),
        "0", # Withholding agent indicator; 0 = EIN
        normalized_tax_field(company.name, 120),
        normalized_tax_field(company.street_address, 80),
        normalized_tax_field(company.city, 40),
        company.state,
        required_blanks(4), # Province code + country code (only required for foreign issuers)
        normalized_tax_field(company.zip_code, 9),
        tax_year.to_s,
        company_administrator_legal_name.ljust(45),
        "CEO".ljust(45), # Withholding agent's department title
        normalized_tax_field(company.phone_number, 20),
        "0", # Final return indicator
        "3", # Withholding indicator
        required_blanks(148),
        amount_codes,
        required_blanks(474),
        sequence_number(2),
        "\n\n",
      ].join
    end

    def reconciliation_record
      offset = 3 # 1 for transmitter record, 1 for issuer record, 1 for payee records

      [
        "C",
        payee_ids.count.to_s.rjust(8, "0"),
        required_blanks(6),
        data_for_tax_year_by_user_compliance_info_id.map { _1["total_amount_in_usd"] }.sum.to_i.to_s.rjust(15, "0"), # Total dividends amount
        data_for_tax_year_by_user_compliance_info_id.map { _1["withheld_tax_in_usd"] }.sum.to_i.to_s.rjust(15, "0"), # Total withheld amount
        required_blanks(965),
        sequence_number(payee_ids.count + offset),
        "\n\n",
      ].join
    end

    def end_of_transmission_record
      offset = 4 # 1 for transmitter record, 1 for issuer record, 1 for payee records, 1 for end of issuer record
      [
        "F",
        "1".rjust(3, "0"),
        required_blanks(1006),
        sequence_number(payee_ids.count + offset),
        "\n\n",
      ].join
    end
end

### Usage:
=begin
company = Company.is_gumroad.sole
tax_year = 2023
is_test = false
attached = { "IRS-1042-S-#{tax_year}.txt" => Irs::Form1042sDataGenerator.new(company:, tax_year:, is_test:).process }
AdminMailer.custom(to: ["raulp@hey.com"], subject: "[Flexile] 1042-S 2023 IRS FIRE tax report #{is_test ? "test " : ""}file", body: "Attached", attached:).deliver_now
=end
