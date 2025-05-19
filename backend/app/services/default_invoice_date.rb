# frozen_string_literal: true

class DefaultInvoiceDate
  def initialize(user, company)
    @user = user
    @company = company
  end

  def generate
    basic_default_date
  end

  private
    attr_reader :user, :company

    def basic_default_date
      Date.current
    end
end
