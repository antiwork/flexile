# frozen_string_literal: true

module HelperWidget
  extend ActiveSupport::Concern

  included do
    helper_method :show_helper_widget?, :helper_widget_host, :helper_widget_email_hmac
  end

  def helper_widget_host
    GlobalConfig.get("HELPER_WIDGET_HOST", "https://app.helper.ai")
  end

  def show_helper_widget?
    !Rails.env.test? && Current.user && Flipper.enabled?(:helper_widget, Current.user)
  end

  def helper_widget_email_hmac(timestamp)
    message = "#{Current.user.email}:#{timestamp}"

    OpenSSL::HMAC.hexdigest(
      "sha256",
      GlobalConfig.dig("helper", "widget_key"),
      message
    )
  end
end
