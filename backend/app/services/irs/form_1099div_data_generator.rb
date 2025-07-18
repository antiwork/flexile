# frozen_string_literal: true

class Irs::Form1099divDataGenerator < Irs::BaseFormDataGenerator
  def payee_ids
    @_payee_ids ||= total_amounts_for_tax_year_by_user_compliance_info_id.map { _1["id"] }
  end

  def type_of_return = "1".ljust(2) # Dividends

  def amount_codes = "12A".ljust(18) # Total ordinary dividends + qualified dividends amount + tax withheld amounts for DIV form

  def serialize_form_data
    result = ""
    user_compliance_infos.find_each.with_index(3) do |user_compliance_info, index|
      result += serialize_payee_record(user_compliance_info:, index:)
    end
    result + end_of_issuer_record
  end

  private
    def user_compliance_infos
      return @_user_compliance_infos if defined?(@_user_compliance_infos)

      @_user_compliance_infos = UserComplianceInfo.includes(:user)
                                                    .joins(:documents)
                                                    .where(documents:
                                                             {
                                                               company:,
                                                               year: tax_year,
                                                               name: Document::FORM_1099_DIV,
                                                               deleted_at: nil,
                                                               document_type: :tax_document,
                                                             })
                                                    .where(country_code: "US")
    end

    def total_amounts_for_tax_year_by_user_compliance_info_id
      sql = user_compliance_infos.joins(:dividends)
                                 .merge(Dividend.for_tax_year(tax_year))
                                 .select("user_compliance_infos.id," \
                                         "SUM(dividends.total_amount_in_cents) AS total_amount_in_cents," \
                                         "SUM(dividends.qualified_amount_cents) AS qualified_amount_in_cents," \
                                         "SUM(dividends.withheld_tax_cents) AS withheld_tax_in_cents")
                                 .group("user_compliance_infos.id")
                                 .to_sql
      @_total_amounts_for_tax_year_by_user_compliance_info_id ||= ApplicationRecord.connection.execute(sql).to_a
    end

    def serialize_payee_record(user_compliance_info:, index:)
      user_name = normalized_tax_field(user_compliance_info.legal_name)
      first_name = user_name.split[0..-2].join(" ")
      last_name = user_name.split.last
      type_of_tin = user_compliance_info.business_entity? ? "1" : "2"
      name_control = user_compliance_info.business_entity? ? user_compliance_info.business_name.upcase : last_name
      payee_amounts = total_amounts_for_tax_year_by_user_compliance_info_id.find { _1["id"] == user_compliance_info.id }
      total_amount_for_payee = payee_amounts["total_amount_in_cents"].to_i.to_s.rjust(12, "0")
      qualified_dividends_amount_for_payee = payee_amounts["qualified_amount_in_cents"].to_i.to_s.rjust(12, "0")
      withheld_tax_amount_for_payee = payee_amounts["withheld_tax_in_cents"].to_i.to_s.rjust(12, "0")

      [
        "B",
        tax_year.to_s,
        required_blanks(1), # Corrected return indicator
        name_control[0..3].ljust(4), # Payee name control
        type_of_tin,
        normalized_tax_id_for(user_compliance_info),
        user_compliance_info.id.to_s.rjust(20), # Unique issuer account number for payee
        required_blanks(14),
        total_amount_for_payee,
        qualified_dividends_amount_for_payee,
        "".rjust(84, "0"), # Unused payment amount fields
        withheld_tax_amount_for_payee,
        "".rjust(96, "0"), # Unused payment amount fields
        required_blanks(17),
        "#{last_name} #{first_name}".ljust(80),
        normalized_tax_field(user_compliance_info.street_address, 40),
        required_blanks(40),
        normalized_tax_field(user_compliance_info.city, 40),
        user_compliance_info.state,
        normalized_tax_field(user_compliance_info.zip_code, 9),
        required_blanks(1),
        sequence_number(index),
        required_blanks(215),
        "".rjust(24, "0"), # Unused state + local tax withheld amount fields
        required_blanks(2),
        "\n\n",
      ].join
    end

    def end_of_issuer_record
      offset = 3 # 1 for transmitter record, 1 for issuer record, 1 for payee records
      [
        "C",
        payee_ids.count.to_s.rjust(8, "0"),
        required_blanks(6),
        total_amounts_for_tax_year_by_user_compliance_info_id.map { _1["total_amount_in_cents"] }.sum.to_i.to_s.rjust(18, "0"), # Total dividends amount
        total_amounts_for_tax_year_by_user_compliance_info_id.map { _1["qualified_amount_in_cents"] }.sum.to_i.to_s.rjust(18, "0"), # Total qualified dividends amount
        "".rjust(126, "0"), # Unused amount fields
        total_amounts_for_tax_year_by_user_compliance_info_id.map { _1["withheld_tax_in_cents"] }.sum.to_i.to_s.rjust(18, "0"), # Total withheld amount
        "".rjust(144, "0"), # Unused amount fields
        required_blanks(160),
        sequence_number(payee_ids.count + offset),
        required_blanks(241),
        "\n\n",
      ].join
    end
end

### Usage:
=begin
company = Company.is_gumroad.sole
tax_year = 2023
is_test = false
attached = { "IRS-1099-DIV-#{tax_year}.txt" => Irs::Form1099divDataGenerator.new(company:, tax_year:, is_test:).process }
AdminMailer.custom(to: ["raulp@hey.com"], subject: "[Flexile] 1099-DIV 2023 IRS FIRE tax report #{is_test ? "test " : ""}file", body: "Attached", attached:).deliver_now
=end
