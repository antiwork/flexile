# frozen_string_literal: true

class Irs::Form1099necDataGenerator < Irs::BaseFormDataGenerator
  def payee_ids
    @_user_ids ||= total_cash_amount_for_tax_year_by_user_id.keys
  end

  def type_of_return = "NE".ljust(2) # Nonemployee compensation

  def amount_codes = "1".ljust(18) # Only fill in total amount for NEC form

  def serialize_form_data
    result = ""
    UserComplianceInfo.alive
                      .where(user_id: payee_ids)
                      .select("DISTINCT ON (user_id) *")
                      .order(:user_id, tax_information_confirmed_at: :desc)
                      .each
                      .with_index(3) do |user_compliance_info, index|
      result += serialize_payee_record(user_compliance_info:, index:)
    end
    result + end_of_issuer_record
  end

  private
    def total_cash_amount_for_tax_year_by_user_id
      sql = company.company_workers
                   .with_required_tax_info_for(tax_year:)
                   .joins(:invoices).merge(Invoice.alive.for_tax_year(tax_year))
                   .select("invoices.user_id, SUM(invoices.cash_amount_in_cents) AS total_cash_amount_in_cents")
                   .where("user_compliance_infos.tax_information_confirmed_at IS NOT NULL")
                   .group("invoices.user_id")
                   .having("SUM(invoices.cash_amount_in_cents) >= ?", CompanyWorker::MIN_COMPENSATION_AMOUNT_FOR_1099_NEC)
                   .to_sql
      @_total_cash_amount_for_tax_year_by_user_id ||= ApplicationRecord.connection
                                                                        .execute(sql)
                                                                        .to_a
                                                                        .to_h(&:values)
    end

    def serialize_payee_record(user_compliance_info:, index:)
      user_name = normalized_tax_field(user_compliance_info.legal_name)
      first_name = user_name.split[0..-2].join(" ")
      last_name = user_name.split.last
      type_of_tin = user_compliance_info.business_entity? ? "1" : "2"
      name_control = user_compliance_info.business_entity? ? user_compliance_info.business_name.upcase : last_name
      compensation_amount_for_payee = total_cash_amount_for_tax_year_by_user_id.fetch(user_compliance_info.user_id)
                                                                               .to_i
                                                                               .to_s
                                                                               .rjust(12, "0")

      [
        "B",
        tax_year.to_s,
        required_blanks(1), # Corrected return indicator
        name_control[0..3].ljust(4), # Payee name control
        type_of_tin,
        normalized_tax_id_for(user_compliance_info),
        user_compliance_info.user_id.to_s.rjust(20), # Unique issuer account number for payee
        required_blanks(14),
        compensation_amount_for_payee,
        "".rjust(204, "0"), # Unused payment amount fields
        required_blanks(17),
        "#{last_name} #{first_name}".ljust(80),
        normalized_tax_field(user_compliance_info.street_address, 40),
        required_blanks(40),
        normalized_tax_field(user_compliance_info.city, 40),
        user_compliance_info.state,
        normalized_tax_field(user_compliance_info.zip_code, 9),
        required_blanks(1),
        sequence_number(index),
        required_blanks(241),
        "\n\n",
      ].join
    end

    def end_of_issuer_record
      offset = 3 # 1 for transmitter record, 1 for issuer record, 1 for payee records
      [
        "C",
        payee_ids.count.to_s.rjust(8, "0"),
        required_blanks(6),
        total_cash_amount_for_tax_year_by_user_id.values.sum.to_i.to_s.rjust(18, "0"), # Total invoices amount
        "".rjust(306, "0"), # Unused amount fields
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
tax_year = 2023
is_test = false
attached = { "IRS-1099-NEC-#{tax_year}.txt" => Irs::Form1099necDataGenerator.new(company:, tax_year:, is_test:).process }
AdminMailer.custom(to: ["raulp@hey.com", "solson@earlygrowth.com"], subject: "[Flexile] 1099-NEC 2023 IRS FIRE tax report #{is_test ? "test " : ""}file", body: "Attached", attached:).deliver_now
=end
