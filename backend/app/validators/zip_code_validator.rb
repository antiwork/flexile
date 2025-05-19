# frozen_string_literal: true

class ZipCodeValidator < ActiveModel::EachValidator
  def validate_each(record, attribute, value)
    value = value.to_s # Handle `nil`s

    # For US addresses, validate specific ZIP code formats
    if record.respond_to?(:country_code) && record.country_code == "US"
      is_5_digit_zip = value.match?(/\A\d{5}\z/) # 58517
      return if is_5_digit_zip

      is_9_digit_zip = value.match?(/\A\d{9}\z/) # 232854905
      return if is_9_digit_zip

      is_10_digit_zip = value.match?(/\A\d{5}[- ]\d{4}\z/) # 23285-4905, 23285 4905
      return if is_10_digit_zip
    else
      # For non-US addresses, just check that the postal code contains at least one number
      return if value.match?(/\d/)
    end

    record.errors.add(attribute, (options[:message] || "is invalid"))
  end
end
