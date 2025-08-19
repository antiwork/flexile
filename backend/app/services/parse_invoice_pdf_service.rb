# frozen_string_literal: true

class ParseInvoicePdfService
  include ActiveSupport::Configurable

  config_accessor :openai_client, default: -> { OpenAI::Client.new }

  def initialize(pdf_file)
    @pdf_file = pdf_file
  end

  def perform
    return { success: false, error: "PDF file is required" } unless @pdf_file.present?

    begin
      # Extract text from PDF
      pdf_text = extract_text_from_pdf

      # Parse with OpenAI
      parsed_data = parse_with_openai(pdf_text)

      { success: true, data: parsed_data }
    rescue => e
      Rails.logger.error "PDF parsing failed: #{e.message}"
      { success: false, error: "Failed to parse PDF: #{e.message}" }
    end
  end

  private

  def extract_text_from_pdf
    require 'pdf-reader'

    reader = PDF::Reader.new(@pdf_file.path)
    text = reader.pages.map(&:text).join("\n")

    # Clean up the text
    text.gsub(/\s+/, ' ').strip
  end

  def parse_with_openai(pdf_text)
    prompt = build_prompt(pdf_text)

    response = openai_client.chat(
      parameters: {
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are an expert at extracting structured data from invoice PDFs. Return only valid JSON."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.1,
        max_tokens: 2000
      }
    )

    json_response = response.dig("choices", 0, "message", "content")
    JSON.parse(json_response)
  end

  def build_prompt(pdf_text)
    <<~PROMPT
      Extract the following information from this invoice PDF and return it as JSON:

      {
        "invoice_number": "string or null",
        "invoice_date": "YYYY-MM-DD or null",
        "due_date": "YYYY-MM-DD or null",
        "total_amount": "number or null",
        "currency": "string or null",
        "bill_from": {
          "name": "string or null",
          "address": "string or null",
          "email": "string or null"
        },
        "bill_to": {
          "name": "string or null",
          "address": "string or null",
          "email": "string or null"
        },
        "line_items": [
          {
            "description": "string",
            "quantity": "number",
            "unit_price": "number",
            "total": "number"
          }
        ],
        "notes": "string or null",
        "tax_amount": "number or null",
        "subtotal": "number or null"
      }

      Rules:
      - Return only valid JSON
      - Use null for missing values
      - Convert all amounts to numbers (remove currency symbols)
      - Parse dates in YYYY-MM-DD format
      - Extract line items with description, quantity, unit price, and total
      - If a field cannot be found, use null

      PDF Text:
      #{pdf_text}
    PROMPT
  end
end


