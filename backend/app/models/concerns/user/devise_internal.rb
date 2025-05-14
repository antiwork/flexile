# frozen_string_literal: true

module User::DeviseInternal
  extend ActiveSupport::Concern

  # Enable unconfirmed users to sign in
  def active_for_authentication? = true

  protected
    def send_devise_notification(notification, *args)
      message = devise_mailer.send(notification, self, *args)
      message.deliver_later(queue: "mailers", wait: 3.seconds)
    end
end
