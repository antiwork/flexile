# frozen_string_literal: true

class CreatePdf
  attr_reader :body_html, :recipient_country_code

  def initialize(body_html:, recipient_country_code: nil)
    @body_html = body_html
    @recipient_country_code = recipient_country_code
  end

  def perform
    html = ApplicationController.render template: "templates/pdf",
                                        locals: { body_html: },
                                        layout: false,
                                        formats: [:html]
    Grover.new(html,
               format: page_size,
               print_background: true,
               margin: { top: "2cm", left: "2cm", bottom: "2cm", right: "2cm" },
               launch_args: ["--disable-web-security", "--no-sandbox", "--disable-setuid-sandbox"],
               executable_path: ENV["PUPPETEER_EXECUTABLE_PATH"]).to_pdf
  end

  private
    def page_size
      recipient_country_code&.in?(%w[US CA]) ? "Legal" : "A4"
    end
end
