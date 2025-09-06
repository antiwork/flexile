# frozen_string_literal: true

class EquityNamingService
  class << self
    def next_name(company:, collection:, prefix_length: 3)
      preceding_item = collection.order(id: :desc).first
      return "#{company.name.first(prefix_length).upcase}-1" if preceding_item.nil?

      preceding_digits = preceding_item.name.scan(/\d+\z/).last
      preceding_number = preceding_digits.to_i

      next_number = preceding_number + 1
      preceding_item.name.reverse.sub(preceding_digits.reverse, next_number.to_s.reverse).reverse
    end

    def option_holder_name(user)
      return user.legal_name unless user.business_entity?

      if ISO3166::Country[:IN] == ISO3166::Country[user.country_code]
        user.legal_name
      else
        user.business_name
      end
    end
  end
end
