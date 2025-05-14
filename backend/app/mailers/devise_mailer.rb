# frozen_string_literal: true

class DeviseMailer < Devise::Mailer
  helper :application
  include Devise::Controllers::UrlHelpers
  layout "mailer"

  def invitation_instructions(record, token, opts = {})
    @dividend_date = opts.delete(:dividend_date)
    super(record, token, opts)
  end
end
