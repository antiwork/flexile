# frozen_string_literal: true

class Internal::Invoices::PdfParserController < Internal::BaseController
  include JwtAuthenticatable

  def parse
    return render json: { error: "PDF file is required" }, status: :bad_request unless params[:pdf_file].present?

    pdf_file = params[:pdf_file]

    # Validate file type
    unless pdf_file.content_type == "application/pdf"
      return render json: { error: "Only PDF files are supported" }, status: :bad_request
    end

    # Validate file size (10MB limit)
    if pdf_file.size > 10.megabytes
      return render json: { error: "File size must be less than 10MB" }, status: :bad_request
    end

    result = ParseInvoicePdfService.new(pdf_file).perform

    if result[:success]
      render json: { data: result[:data] }, status: :ok
    else
      render json: { error: result[:error] }, status: :unprocessable_entity
    end
  rescue => e
    Rails.logger.error "PDF parsing error: #{e.message}"
    render json: { error: "Failed to process PDF" }, status: :internal_server_error
  end
end


