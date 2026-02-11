# frozen_string_literal: true

class AdminMailer < ApplicationMailer
  def custom(to:, subject:, body:, attached: {}, cc: nil, reply_to: nil)
    attached.each_pair do |key, value|
      attachments[key] = value
    end
    mail(to:, subject:, cc:, reply_to:) do |format|
      format.html { render html: body }
    end
  end
end
