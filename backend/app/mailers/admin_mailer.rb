# frozen_string_literal: true

class AdminMailer < ApplicationMailer
  def custom(to:, subject:, body:, attached: {})
    attached.each_pair do |key, value|
      attachments[key] = value
    end
    mail(to:, subject:) do |format|
      format.html { render html: body }
    end
  end
end
