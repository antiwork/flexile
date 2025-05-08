# frozen_string_literal: true

module CapybaraHelpers
  def wait_for_ajax
    Timeout.timeout(Capybara.default_max_wait_time) do
      loop until finished_all_ajax_requests?
    end
  end

  def wait_for_navigation
    current_path = page.current_path
    Timeout.timeout(Capybara.default_max_wait_time) do
      loop do
        return if page.current_path != current_path
        sleep 0.1
      end
    end
  end

  def clipboard_text
    page.driver.browser.execute_cdp(
      "Browser.grantPermissions",
      origin: "#{PROTOCOL}://#{DOMAIN}",
      permissions: ["clipboardReadWrite", "clipboardSanitizedWrite"]
    )
    page.evaluate_async_script("navigator.clipboard.readText().then(arguments[0])")
  end

  private
    def finished_all_ajax_requests?
      page.evaluate_script(<<~EOS)
        (typeof window.jQuery === 'undefined' || jQuery.active === 0) && !window.__activeRequests
      EOS
    end
end
