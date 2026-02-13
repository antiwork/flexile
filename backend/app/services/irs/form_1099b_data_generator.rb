# frozen_string_literal: true

class Irs::Form1099bDataGenerator < Irs::BaseFormDataGenerator
  def payee_ids
    @_payee_ids ||= total_amounts_for_tax_year_by_user_compliance_info_id.map { _1["id"] }
  end

  def type_of_return = "B ".ljust(2) # Proceeds from broker and barter exchange transactions

  def amount_codes = "24".ljust(18) # Amount code 2 = Gross proceeds, Amount code 4 = Federal income tax withheld

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
                                                               document_type: :form_1099b,
                                                               deleted_at: nil,
                                                             })
                                                    .where(country_code: "US")
    end

    def total_amounts_for_tax_year_by_user_compliance_info_id
      sql = user_compliance_infos.joins(:dividends)
                                 .merge(Dividend.for_tax_year(tax_year).return_of_capital)
                                 .select("user_compliance_infos.id," \
                                         "SUM(dividends.total_amount_in_cents) AS total_proceeds_in_cents," \
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
      total_proceeds_for_payee = payee_amounts["total_proceeds_in_cents"].to_i.to_s.rjust(12, "0")
      withheld_tax_for_payee = payee_amounts["withheld_tax_in_cents"].to_i.to_s.rjust(12, "0")

      [
        "B",
        tax_year.to_s,
        required_blanks(1), # Corrected return indicator
        name_control[0..3].ljust(4), # Payee name control
        type_of_tin,
        normalized_tax_id_for(user_compliance_info),
        user_compliance_info.id.to_s.rjust(20), # Unique issuer account number for payee
        required_blanks(14),
        "".rjust(12, "0"), # Payment amount 1 (unused)
        total_proceeds_for_payee, # Payment amount 2 (Gross proceeds)
        "".rjust(12, "0"), # Payment amount 3 (unused)
        withheld_tax_for_payee, # Payment amount 4 (Federal income tax withheld)
        "".rjust(144, "0"), # Remaining payment amount fields (5-16)
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
        "".rjust(18, "0"), # Payment amount 1 total (unused)
        total_amounts_for_tax_year_by_user_compliance_info_id.map { _1["total_proceeds_in_cents"] }.sum.to_i.to_s.rjust(18, "0"), # Payment amount 2 total (Gross proceeds)
        "".rjust(18, "0"), # Payment amount 3 total (unused)
        total_amounts_for_tax_year_by_user_compliance_info_id.map { _1["withheld_tax_in_cents"] }.sum.to_i.to_s.rjust(18, "0"), # Payment amount 4 total (Federal income tax withheld)
        "".rjust(216, "0"), # Remaining amount totals (5-16)
        required_blanks(160),
        sequence_number(payee_ids.count + offset),
        required_blanks(241),
        "\n\n",
      ].join
    end
end

### Usage:
=begin
company = Company.find(company_id)
transmitter_company = Company.find(transmitter_company_id)
tax_year = 2025
is_test = false
attached = { "IRS-1099-B-#{tax_year}.txt" => Irs::Form1099bDataGenerator.new(company:, transmitter_company:, tax_year:, is_test:).process }
AdminMailer.custom(to: ["admin@example.com"], subject: "[Flexile] 1099-B #{tax_year} IRS FIRE tax report #{is_test ? "test " : ""}file", body: "Attached", attached:).deliver_now
=end
