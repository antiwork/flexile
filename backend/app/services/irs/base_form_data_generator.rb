# frozen_string_literal: true

class Irs::BaseFormDataGenerator
  INVALID_CHARACTERS_REGEX = /[^0-9A-Za-z\s]/
  private_constant :INVALID_CHARACTERS_REGEX

  def initialize(company:, tax_year:, is_test: false)
    @company = company
    @tax_year = tax_year
    @is_test = is_test
  end

  def process
    return if payee_ids.empty?

    data = transmitter_record
    data += issuer_record
    data += serialize_form_data
    data + end_of_transmission_record
  end

  def payee_ids
    raise NotImplementedError
  end

  def type_of_return
    raise NotImplementedError
  end

  def amount_codes
    raise NotImplementedError
  end

  def serialize_form_data
    raise NotImplementedError
  end

  private
    attr_reader :company, :tax_year, :is_test

    def transmitter_company = Company.is_gumroad.sole

    def test_file_indicator = is_test ? "T" : " "

    def required_blanks(number_of_blanks) = "".ljust(number_of_blanks)

    def sequence_number(index) = index.to_s.rjust(8, "0")

    def normalized_tax_field(field, length = nil)
      length ||= field.length
      normalized = I18n.transliterate(field).gsub(INVALID_CHARACTERS_REGEX, "").upcase
      normalized[0, length].ljust(length)
    end

    def normalized_tax_id_for(record)
      tin = record.tax_id

      raise "No TIN found for company #{record.id}" unless tin.present?

      tin.delete("-")
    end

    def transmitter_administrator_legal_name
      @_transmitter_administrator_legal_name ||= normalized_tax_field(transmitter_company.primary_admin.user.legal_name)
    end

    def company_administrator_legal_name
      @_company_administrator_legal_name ||= normalized_tax_field(company.primary_admin.user.legal_name)
    end

    def transmitter_record
      [
        "T",
        tax_year.to_s,
        required_blanks(1), # Prior year data indicator
        normalized_tax_id_for(transmitter_company), # Payer TIN
        GlobalConfig.dig("irs", "tcc_1099"), # Transmitter control code
        required_blanks(7),
        test_file_indicator,
        required_blanks(1), # Foreign entity indicator
        normalized_tax_field(transmitter_company.name, 80), # Transmitter name
        normalized_tax_field(transmitter_company.name, 80), # Company name
        normalized_tax_field(transmitter_company.street_address, 40),
        normalized_tax_field(transmitter_company.city, 40),
        transmitter_company.state,
        normalized_tax_field(transmitter_company.zip_code, 9),
        required_blanks(15),
        payee_ids.count.to_s.rjust(8, "0"), # Total number of payees
        transmitter_administrator_legal_name.ljust(40), # Transmitter contact name
        normalized_tax_field(transmitter_company.phone_number, 15),
        transmitter_company.email.ljust(50),
        required_blanks(91),
        sequence_number(1),
        required_blanks(10),
        "I", # Vendor indicator
        required_blanks(230),
        "\n\n"
      ].join
    end

    def issuer_record
      [
        "A",
        tax_year.to_s,
        required_blanks(6),
        normalized_tax_id_for(company),
        normalized_tax_field(company.name)[0..3].ljust(4), # Issuer name control
        required_blanks(1), # Last filing indicator
        type_of_return,
        amount_codes,
        required_blanks(6),
        required_blanks(1), # Foreign entity indicator
        company_administrator_legal_name.ljust(80),
        "1", # Transfer indicator agent
        normalized_tax_field(company.street_address, 40),
        normalized_tax_field(company.city, 40),
        company.state,
        normalized_tax_field(company.zip_code, 9),
        normalized_tax_field(company.phone_number, 15),
        required_blanks(260),
        sequence_number(2),
        required_blanks(241),
        "\n\n",
      ].join
    end

    def end_of_transmission_record
      offset = 4 # 1 for transmitter record, 1 for issuer record, 1 for payee records, 1 for end of issuer record
      [
        "F",
        "1".rjust(8, "0"),
        "".rjust(21, "0"),
        required_blanks(469),
        sequence_number(payee_ids.count + offset),
        required_blanks(241),
        "\n\n",
      ].join
    end
end
