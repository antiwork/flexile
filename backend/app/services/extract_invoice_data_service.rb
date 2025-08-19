# frozen_string_literal: true

require "base64"

class ExtractInvoiceDataService
  def initialize(pdf_file)
    @pdf_file = pdf_file
  end

  def call
    client = OpenAI::Client.new(request_timeout: 120)

    pdf_content = @pdf_file.read
    @pdf_file.rewind if @pdf_file.respond_to?(:rewind)

    encoded_pdf = Base64.strict_encode64(pdf_content)
    pdf_data_url = "data:application/pdf;base64,#{encoded_pdf}"

    response = client.responses.create(
      parameters: {
        model: "gpt-5-nano-2025-08-07",
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_file",
                filename: @pdf_file.respond_to?(:original_filename) ? @pdf_file.original_filename : "invoice.pdf",
                file_data: pdf_data_url,
              },
              {
                type: "input_text",
                text: "Analyze this document. Return JSON with these exact fields:
{
  \"is_invoice\": boolean,
  \"confidence\": 0-100,
  \"invoice_number\": string or null,
  \"invoice_date\": \"YYYY-MM-DD\" or null,
  \"total_amount\": number or null,
  \"line_items\": array or null
}

If is_invoice is false, set all invoice fields to null. Only extract invoice data if you're confident this is actually an invoice. Return only valid JSON, no other text.",
              }
            ],
          }
        ],
      }
    )

    content = nil
    if response["output"] && response["output"].is_a?(Array)
      message_output = response["output"].find { |item| item["type"] == "message" }
      if message_output && message_output["content"]
        text_content = message_output["content"].find { |c| c["type"] == "output_text" }
        content = text_content["text"] if text_content
      end
    end

    if content.nil? || content.empty?
      Rails.logger.error "OpenAI returned empty content"
      return { success: false, error: "OpenAI returned empty response" }
    end

    cleaned_content = content.gsub(/```json\n?/, "").gsub(/```\n?/, "").strip
    extracted_data = JSON.parse(cleaned_content)

    if extracted_data["is_invoice"].nil? || extracted_data["is_invoice"] == false
      return {
        success: false,
        error: "This document does not appear to be an invoice",
      }
    end

    invoice_number = extracted_data["invoice_number"]
    total_amount = extracted_data["total_amount"]
    line_items = extracted_data["line_items"]

    if (invoice_number.nil? || invoice_number.to_s.strip.empty?) &&
       (total_amount.nil? || total_amount == 0) &&
       (line_items.nil? || line_items.empty?)
      return {
        success: false,
        error: "This document does not appear to be an invoice",
      }
    end

    { success: true, data: extracted_data }
  rescue JSON::ParserError => e
    Rails.logger.error "JSON parsing failed: #{e.message}, content: #{content}"
    { success: false, error: "Unable to process the AI response" }
  rescue Faraday::TimeoutError => e
    Rails.logger.error "OpenAI timeout: #{e.message}"
    { success: false, error: "Request timed out. Please try again." }
  rescue => e
    Rails.logger.error "Invoice extraction failed: #{e.class} - #{e.message}"
    if e.respond_to?(:response) && e.response
      Rails.logger.error "Response body: #{e.response[:body]}"
    end
    { success: false, error: "Unable to extract invoice data" }
  end

  private
    attr_reader :pdf_file
end
