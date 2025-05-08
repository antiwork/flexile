# frozen_string_literal: true

class CreateShareCertificatePdfJob
  include Sidekiq::Job
  sidekiq_options retry: 5

  def perform(share_holding_id)
    share_holding = ShareHolding.find(share_holding_id)
    company_investor = share_holding.company_investor
    company = company_investor.company
    company_administrator = company.primary_admin
    locals = {
      share_holding:,
      company:,
      admin_name: company_administrator.user.legal_name,
    }
    html = ApplicationController.render template: "ssr/share_certificate",
                                        locals:,
                                        layout: "pdf",
                                        formats: [:html]
    pdf_content = Grover.new(html,
                             landscape: true, print_background: true,
                             margin: { top: "1.5cm", left: "1.5cm", bottom: "1.5cm", right: "1.5cm" },
                             launch_args: ["--disable-web-security", "--no-sandbox", "--disable-setuid-sandbox"],
                             executable_path: ENV["PUPPETEER_EXECUTABLE_PATH"]).to_pdf

    certificate_name = "#{share_holding.name} Share Certificate"
    share_certificate = Document.new(company:, document_type: :share_certificate, name: certificate_name, year: Time.current.year)
    share_certificate.attachments.attach(
      io: StringIO.new(pdf_content),
      filename: "#{certificate_name}.pdf",
      content_type: "application/pdf",
    )
    share_certificate.signatures.build(user: company_investor.user, title: "Signer", signed_at: Time.current)
    share_certificate.save!
  end
end
