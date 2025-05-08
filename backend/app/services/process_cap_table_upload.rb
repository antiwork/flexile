# frozen_string_literal: true

class ProcessCapTableUpload
  class ExistingCapTableError < StandardError; end

  class DebugFile
    def initialize(path)
      @path = path
    end

    def download
      File.read(@path)
    end

    def filename
      ActiveStorage::Filename.new(Pathname.new(@path))
    end
  end

  def initialize(cap_table_upload:, debug_file_path: nil)
    @cap_table_upload = cap_table_upload
    @company = cap_table_upload.company
    @debug_file_path = debug_file_path
  end

  def call
    validate_no_existing_cap_table!

    file_content = if excel_file?
      convert_excel_to_text
    else
      file.download.force_encoding("UTF-8")
    end

    prompt = <<~PROMPT
      Find the information I need for this from the file and return data in this sort of JSON format.
      Don't stray from the JSON format as the result will be used by code that relies on the structure.
      Every key which has an array value could have multiple items irrespective of how many items are shown in the sample JSON.
      Ignore fully cancelled shares and option pools with no avaiable shares.
      Note that the JSON structure only represents the kind of values, please replace them with actual values.
      If you can't find the information, leave the value as null.

      {
          "share_classes": [
              {
                  "name": <string>,
                  "original_issue_price_in_dollars": <decimal number>
              },
              {
                  "name": <string>,
                  "original_issue_price_in_dollars": <decimal number>
              }
          ],
          "investors": [
              {
                  "name": "someone",
                  "email": "someone@somewhere.com",
                  "country": "United States",
                  "share_holdings": [
                      {
                          "name": <certificate or security identifier/name>,
                          "issued_at": <date>,
                          "originally_acquired_at": <date>,
                          "share_class": "Common",
                          "number_of_shares": <number>,
                          "share_price_usd": <decimal number>,
                          "total_amount_in_cents": <number>
                      },
                      {
                          "name": <certificate or security identifier/name>,
                          "issued_at": <date>,
                          "originally_acquired_at": <date>,
                          "share_class": "Common",
                          "number_of_shares": <number>,
                          "share_price_usd": <decimal number>,
                          "total_amount_in_cents": <number>
                      }
                  ]
              },
              {
                  "name": "someone else",
                  "email": "someoneelse@somewhere.com",
                  "country": "United States",
                  "share_holdings": [
                      {
                          "name": <certificate or security identifier/name>,
                          "issued_at": <date>,
                          "share_class": "Series Seed Preferred Stock",
                          "number_of_shares": <number>,
                          "share_price_usd": <decimal number>,
                          "total_amount_in_cents": <number>
                      },
                      {
                          name: <certificate or security identifier/name>,
                          "issued_at": <date>,
                          "share_class": "Series Seed Preferred Stock",
                          "number_of_shares": <number>,
                          "share_price_usd": <decimal number>,
                          "total_amount_in_cents": <number>
                      }
                  ]
              }
          ],
          "option_pools": [
              {
                  "share_class": "Common",
                  "authorized_shares": <number>,
                  "issued_shares": <number>,
                  "name": "2024 Options pool"
              }
          ],
          "company_values": {
              "fully_diluted_shares": <number>
          }
      }
    PROMPT

    schema = {
      "type" => "object",
      "properties" => {
        "share_classes" => {
          "type" => "array",
          "items" => {
            "type" => "object",
            "properties" => {
              "name" => { "type" => ["string", "null"] },
              "original_issue_price_in_dollars" => { "type" => ["number", "null"] },
            },
            "required" => ["name"],
          },
        },
        "investors" => {
          "type" => "array",
          "items" => {
            "type" => "object",
            "properties" => {
              "name" => { "type" => ["string", "null"] },
              "email" => { "type" => ["string", "null"] },
              "country" => { "type" => ["string", "null"] },
              "share_holdings" => {
                "type" => "array",
                "items" => {
                  "type" => "object",
                  "properties" => {
                    "name" => { "type" => ["string", "null"] },
                    "issued_at" => { "type" => ["string", "null"], "format" => "date" },
                    "originally_acquired_at" => { "type" => ["string", "null"], "format" => "date" },
                    "share_class" => { "type" => ["string", "null"] },
                    "number_of_shares" => { "type" => ["integer", "null"] },
                    "share_price_usd" => { "type" => ["number", "null"] },
                    "total_amount_in_cents" => { "type" => ["integer", "null"] },
                  },
                  "required" => ["name", "issued_at", "share_class", "number_of_shares", "share_price_usd", "total_amount_in_cents"],
                },
              },
            },
            "required" => ["name", "email", "country", "share_holdings"],
          },
        },
        "option_pools" => {
          "type" => "array",
          "items" => {
            "type" => "object",
            "properties" => {
              "share_class" => { "type" => ["string", "null"] },
              "authorized_shares" => { "type" => ["integer", "null"] },
              "issued_shares" => { "type" => ["integer", "null"] },
              "name" => { "type" => ["string", "null"] },
            },
            "required" => ["share_class", "authorized_shares", "issued_shares", "name"],
          },
        },
        "company_values" => {
          "type" => "object",
          "properties" => {
            "fully_diluted_shares" => { "type" => ["integer", "null"] },
          },
          "required" => ["fully_diluted_shares"],
        },
      },
      "required" => ["share_classes", "investors", "company_values"],
    }

    client = OpenAI::Client.new(request_timeout: 300)
    response = client.chat(
      parameters: {
        messages: [
          { role: "system", content: prompt },
          { role: "user", content: file_content },
        ],
        model: "o3-mini",
      }
    )
    Rails.logger.info("OpenAI response for cap table parsing: #{response.inspect}")

    response_content = response.dig("choices", 0, "message", "content").to_s.strip

    data = JSON.parse(response_content)
    Rails.logger.info("Parsed response body from OpenAI for cap table parsing: #{data.inspect}")
    begin
      JSON::Validator.validate!(schema, data)
    rescue JSON::Schema::ValidationError => e
      Rails.logger.error("Cap table parsing validation failed. Error: #{e.message}")
      Rails.logger.error("Invalid response: #{data.inspect}")
      raise
    end
    Rails.logger.error("Cap table parsing validation succeeded")

    cap_table_upload.update!(parsed_data: data)

    return unless Rails.env.test?

    ApplicationRecord.transaction do
      share_classes = {}
      data["share_classes"].each do |share_class_data|
        share_classes[share_class_data["name"]] = ShareClass.create!(
          company:,
          name: share_class_data["name"],
          original_issue_price_in_dollars: share_class_data["original_issue_price_in_dollars"]
        )
      end

      data["investors"].each do |investor_data|
        user = User.find_or_create_by!(email: investor_data["email"]) do |u|
          u.legal_name = investor_data["name"]
          u.preferred_name = investor_data["name"]
          u.country_code = investor_data["country"]
          u.password = SecureRandom.hex
          u.confirmed_at = Time.current
        end

        company_investor = user.company_investors.create!(
          company:,
          investment_amount_in_cents: investor_data["share_holdings"].sum { |h| h["total_amount_in_cents"] }
        )

        investor_data["share_holdings"].each do |holding|
          ShareHolding.create!(
            company_investor:,
            name: holding["name"],
            issued_at: holding["issued_at"],
            originally_acquired_at: holding["issued_at"],
            share_class: share_classes[holding["share_class"]],
            number_of_shares: holding["number_of_shares"],
            share_price_usd: holding["share_price_usd"],
            total_amount_in_cents: holding["total_amount_in_cents"],
            share_holder_name: investor_data["name"]
          )
        end
      end

      data["option_pools"]&.each do |pool_data|
        OptionPool.create!(
          company:,
          share_class: share_classes[pool_data["share_class"]],
          authorized_shares: pool_data["authorized_shares"],
          issued_shares: pool_data["issued_shares"],
          name: pool_data["name"],
        )
      end
    end
  end

  private
    attr_reader :cap_table_upload, :company

    def file
      if @debug_file_path
        DebugFile.new(@debug_file_path)
      else
        cap_table_upload.files.first
      end
    end

    def validate_no_existing_cap_table!
      errors = []
      errors << "option pools" if company.option_pools.exists?
      errors << "share classes" if company.share_classes.exists?
      errors << "investors" if company.company_investors.exists?
      errors << "share holdings" if company.share_holdings.exists?

      if errors.any?
        raise ExistingCapTableError, "Cannot process cap table upload: company already has #{errors.to_sentence}"
      end
    end

    def excel_file?
      file.filename.extension.downcase.in?(["xlsx", "xls"])
    end

    def convert_excel_to_text
      Tempfile.create(["cap_table", file.filename.extension]) do |temp_file|
        temp_file.binmode
        temp_file.write(file.download)
        temp_file.rewind

        workbook = RubyXL::Parser.parse(temp_file.path)

        workbook.worksheets.filter_map do |sheet|
          next if sheet.nil?

          tmp = []
          sheet.each do |row|
            next if row.nil? || row[0].nil? || row[0].value.blank?
            tmp << row.cells.map { |cell| cell&.value.to_s }.join(",")
          end
          tmp.compact!

          next if tmp.empty?

          ["---#{sheet.sheet_name}", *tmp].join("\n")
        end.join("\n\n")
      end
    end
end
