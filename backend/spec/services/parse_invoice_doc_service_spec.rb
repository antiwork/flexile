# frozen_string_literal: true

RSpec.describe ParseInvoiceDocService do
  let(:company) { create(:company) }
  let!(:expense_category) { create(:expense_category, company:, name: "Travel") }
  let(:file) { fixture_file_upload("sample.pdf", "application/pdf") }
  let(:service) { described_class.new(file:, company:) }

  let(:openai_response) do
    {
      "choices" => [
        {
          "message" => {
            "content" => JSON.generate({
              "invoice" => {
                "invoice_date" => "2024-01-15",
                "invoice_number" => "INV-2024-001",
                "notes" => "Consulting services for Q1",
              },
              "invoice_line_items" => [
                {
                  "description" => "Software Development",
                  "quantity" => 40.0,
                  "pay_rate_in_subunits" => 7500,
                  "hourly" => true,
                },
                {
                  "description" => "Code Review",
                  "quantity" => 8.0,
                  "pay_rate_in_subunits" => 8000,
                  "hourly" => true,
                }
              ],
              "invoice_expenses" => [
                {
                  "description" => "Flight to client site",
                  "expense_category_id" => expense_category.id,
                  "total_amount_in_cents" => 50000,
                }
              ],
            }),
          },
        }
      ],
    }
  end

  before do
    allow_any_instance_of(OpenAI::Client).to receive(:chat).and_return(openai_response)
  end

  describe "#process" do
    context "with valid PDF file and OpenAI response" do
      it "returns success with sanitized data" do
        result = service.process

        expect(result[:success]).to be true
        expect(result[:data]).to be_present
      end

      it "extracts and sanitizes all invoice data correctly" do
        result = service.process

        invoice_data = result[:data][:invoice]
        expect(invoice_data[:invoice_date]).to eq("2024-01-15")
        expect(invoice_data[:invoice_number]).to eq("INV-2024-001")
        expect(invoice_data[:notes]).to eq("Consulting services for Q1")

        line_items = result[:data][:invoice_line_items]
        expect(line_items.size).to eq(2)

        expect(line_items[0][:description]).to eq("Software Development")
        expect(line_items[0][:quantity]).to eq(40.0)
        expect(line_items[0][:pay_rate_in_subunits]).to eq(7500)
        expect(line_items[0][:hourly]).to be true

        expect(line_items[1][:description]).to eq("Code Review")
        expect(line_items[1][:quantity]).to eq(8.0)
        expect(line_items[1][:pay_rate_in_subunits]).to eq(8000)
        expect(line_items[1][:hourly]).to be true

        expenses = result[:data][:invoice_expenses]
        expect(expenses.size).to eq(1)
        expect(expenses[0][:description]).to eq("Flight to client site")
        expect(expenses[0][:expense_category_id]).to eq(expense_category.id)
        expect(expenses[0][:total_amount_in_cents]).to eq(50000)
      end

      it "filters out unpermitted parameters from all data types" do
        openai_response["choices"][0]["message"]["content"] = JSON.generate({
          "invoice" => {
            "invoice_date" => "2024-01-15",
            "invoice_number" => "INV-2024-001",
            "notes" => "Test notes",
            "unauthorized_field" => "should be filtered",
          },
          "invoice_line_items" => [
            {
              "description" => "Software Development",
              "quantity" => 40.0,
              "pay_rate_in_subunits" => 7500,
              "hourly" => true,
              "malicious_field" => "should be filtered",
            }
          ],
          "invoice_expenses" => [
            {
              "description" => "Travel",
              "expense_category_id" => expense_category.id,
              "total_amount_in_cents" => 50000,
              "evil_field" => "should be filtered",
            }
          ],
        })

        result = service.process

        expect(result[:data][:invoice].keys).to match_array(["invoice_date", "invoice_number", "notes"])
        expect(result[:data][:invoice_line_items][0].keys).to match_array(["description", "quantity", "pay_rate_in_subunits", "hourly"])
        expect(result[:data][:invoice_expenses][0].keys).to match_array(["description", "expense_category_id", "total_amount_in_cents"])

        expect(result[:data][:invoice]).not_to have_key(:unauthorized_field)
        expect(result[:data][:invoice_line_items][0]).not_to have_key(:malicious_field)
        expect(result[:data][:invoice_expenses][0]).not_to have_key(:evil_field)
      end
    end

    context "with minimal OpenAI response" do
      let(:minimal_response) do
        {
          "choices" => [
            {
              "message" => {
                "content" => JSON.generate({
                  "invoice" => {
                    "invoice_date" => "2024-01-15",
                    "invoice_number" => "INV-001",
                  },
                  "invoice_line_items" => [
                    {
                      "description" => "Work done",
                      "quantity" => 1,
                      "pay_rate_in_subunits" => 10000,
                      "hourly" => false,
                    }
                  ],
                }),
              },
            }
          ],
        }
      end

      before do
        allow_any_instance_of(OpenAI::Client).to receive(:chat).and_return(minimal_response)
      end

      it "handles missing optional fields" do
        result = service.process

        expect(result[:success]).to be true
        expect(result[:data][:invoice][:notes]).to be_nil
        expect(result[:data][:invoice_expenses]).to eq([])
      end
    end

    context "with empty or missing data in OpenAI response" do
      let(:no_expenses_response) do
        {
          "choices" => [
            {
              "message" => {
                "content" => JSON.generate({
                  "invoice" => {
                    "invoice_date" => "2024-01-15",
                    "invoice_number" => "INV-001",
                  },
                  "invoice_line_items" => [
                    {
                      "description" => "Work done",
                      "quantity" => 1,
                      "pay_rate_in_subunits" => 10000,
                      "hourly" => false,
                    }
                  ],
                  "invoice_expenses" => [],
                }),
              },
            }
          ],
        }
      end

      before do
        allow_any_instance_of(OpenAI::Client).to receive(:chat).and_return(no_expenses_response)
      end

      it "handles empty expenses gracefully" do
        result = service.process

        expect(result[:success]).to be true
        expect(result[:data][:invoice_expenses]).to eq([])
      end
    end

    context "when PDF conversion fails" do
      before do
        allow(MiniMagick::Image).to receive(:read).and_raise(StandardError.new("Invalid PDF"))
      end

      it "raises an error with descriptive message" do
        expect { service.process }.to raise_error("Failed to convert PDF to image: Invalid PDF")
      end
    end

    context "when OpenAI returns invalid JSON" do
      let(:invalid_json_response) do
        {
          "choices" => [
            {
              "message" => {
                "content" => "invalid json content",
              },
            }
          ],
        }
      end

      before do
        allow_any_instance_of(OpenAI::Client).to receive(:chat).and_return(invalid_json_response)
      end
    end
  end



  describe "OpenAI integration" do
    it "calls OpenAI API with correct model and gets response" do
      expect_any_instance_of(OpenAI::Client).to receive(:chat)
        .with(hash_including(
                parameters: hash_including(
                  model: "gpt-4o",
                  max_tokens: 2000,
                  temperature: 0,
                  response_format: { type: "json_object" }
                )
              ))
        .and_return(openai_response)

      result = service.process
      expect(result[:success]).to be true
    end

    it "includes company expense categories in the prompt" do
      expect_any_instance_of(OpenAI::Client).to receive(:chat) do |_, args|
        user_message = args[:parameters][:messages].find { |m| m[:role] == "user" }
        prompt_text = user_message[:content].find { |c| c[:type] == "text" }[:text]
        expect(prompt_text).to include("#{expense_category.id}: #{expense_category.name}")
        openai_response
      end

      service.process
    end
  end
end
