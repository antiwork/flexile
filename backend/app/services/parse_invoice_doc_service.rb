# frozen_string_literal: true

class ParseInvoiceDocService
  require "mini_magick"
  require "openai"

  def initialize(file:, company:)
    @file = file
    @company = company
    @openai_client = OpenAI::Client.new(request_timeout: 30)
  end

  def process
    image_data = convert_pdf_to_image_data(@file)
    process_invoice(image_data)
  end

  private
    attr_reader :file, :company, :openai_client

    def process_invoice(image_data)
      messages = build_initial_messages(image_data)
      parsed_data = parse_invoice_with_openai(messages)
      sanitized_params = sanitize_openai_response(parsed_data)

      {
        success: true,
        data: sanitized_params,
      }
    end

    def convert_pdf_to_image_data(file)
      image = MiniMagick::Image.read(file)
      image.format "png"
      image.quality 300
      image.resize "2048x2048>"

      image_blob = image.to_blob
      [Base64.strict_encode64(image_blob)]

    rescue StandardError => e
      raise "Failed to convert PDF to image: #{e.message}"
    end

    def build_initial_messages(base64_image_data)
      messages = [
        {
          role: "system",
          content: build_system_prompt,
        },
        {
          role: "user",
          content: [
            { type: "text", text: build_parsing_prompt }
          ],
        }
      ]

      base64_image_data.each do |base64_image|
        messages.last[:content] << {
          type: "image_url",
          image_url: {
            url: "data:image/png;base64,#{base64_image}",
          },
        }
      end

      messages
    end

    def parse_invoice_with_openai(messages)
      response = openai_client.chat(
        parameters: {
          model: "gpt-4o",
          messages: messages,
          max_tokens: 2000,
          temperature: 0,
          response_format: { type: "json_object" },
        }
      )

      content = response.dig("choices", 0, "message", "content")

      JSON.parse(content)
    end

    def build_system_prompt
      <<~SYSTEM_PROMPT
        You are an expert invoice data extraction assistant. Your job is to accurately extract structured data from invoice images and return it as valid JSON.

        Key responsibilities:
        1. Extract invoice metadata (date, number, notes)
        2. Parse line items for services/work performed
        3. Extract reimbursable expenses with proper categorization
        4. Ensure all monetary amounts are converted to cents (multiply by 100)
        5. Maintain data accuracy and consistency

        Critical formatting rules:
        - ALL monetary amounts must be in CENTS (multiply dollar amounts by 100)
        - Dates must be in YYYY-MM-DD format
        - Use null for missing/unclear fields
        - Be conservative when determining if work is hourly vs fixed-quantity
        - Match expense descriptions to available categories when possible

        Always respond with properly formatted JSON.
      SYSTEM_PROMPT
    end

    def build_parsing_prompt
      expense_categories = company.expense_categories.pluck(:id, :name).map { |id, name| "#{id}: #{name}" }.join(", ")

      <<~PROMPT
      Please analyze this invoice image and extract the following information as a JSON object.

      I need you to extract:

      1. **Invoice metadata:**
         - invoice_date (YYYY-MM-DD format)
         - invoice_number (string)
         - notes (any additional notes or description, optional)

      2. **Line items** (array of service/work items):
         - description (string)
         - quantity (number, can be decimal for hours)
         - pay_rate_in_subunits (rate per unit in CENTS - multiply dollar amounts by 100)
         - hourly (boolean - true if this is hourly work, false if it's a fixed quantity)

      3. **Expenses** (array of reimbursable expenses):
         - description (string)
         - expense_category_id (integer - match to one of these categories: #{expense_categories.presence || "No categories available"})
         - total_amount_in_cents (total amount in CENTS - multiply dollar amounts by 100)

      **Important formatting rules:**
      - All monetary amounts must be in CENTS (multiply by 100)
      - Dates must be in YYYY-MM-DD format
      - If you can't find a field, use null
      - For expenses, try to match descriptions to the available expense categories, or use null if no good match
      - Be conservative with hourly vs non-hourly determination

      Return ONLY a JSON object in this exact format:

      ```
      {
        "invoice": {
          "invoice_date": "2024-01-15",
          "invoice_number": "INV-001",
          "notes": "Optional notes"
        },
        "invoice_line_items": [
          {
            "description": "Software Development",
            "quantity": 40.0,
            "pay_rate_in_subunits": 10000,
            "hourly": true
          }
        ],
        "invoice_expenses": [
          {
            "description": "Travel expenses",
            "expense_category_id": 1,
            "total_amount_in_cents": 5000
          }
        ]
      }
      ```
      PROMPT
    end

    def sanitize_openai_response(parsed_data)
      params_hash = ActionController::Parameters.new(parsed_data)

      {
        invoice: invoice_params(params_hash),
        invoice_line_items: invoice_line_items_params(params_hash),
        invoice_expenses: invoice_expenses_params(params_hash),
      }
    end

    def invoice_params(params)
      params.permit(invoice: [:invoice_date, :invoice_number, :notes])[:invoice]
    end

    def invoice_line_items_params(params)
      permitted_params = [:description, :quantity, :pay_rate_in_subunits, :hourly]

      params.permit(invoice_line_items: permitted_params).fetch(:invoice_line_items, [])
    end

    def invoice_expenses_params(params)
      return [] unless params[:invoice_expenses].present?

      params.permit(invoice_expenses: [:description, :expense_category_id, :total_amount_in_cents])
            .fetch(:invoice_expenses)
    end
end

=begin
file = File.open("./invoice.pdf")
company = Company.last
ParseInvoiceDocService.new(file:, company:).process
=end
