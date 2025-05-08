# frozen_string_literal: true

RSpec.describe ProcessCapTableUpload do
  describe "#call" do
    let(:company) { create(:company) }
    let(:uploader) { create(:user) }
    let(:cap_table_upload) { create(:cap_table_upload, :with_json_file, company: company, user: uploader) }
    let(:excel_cap_table_upload) { create(:cap_table_upload, :with_excel_file, company: company, user: uploader) }
    let(:openai_response) do
      {
        "choices" => [
          {
            "message" => {
              "content" => {
                "share_classes" => [
                  {
                    "name" => "Common Stock",
                    "original_issue_price_in_dollars" => 0.01,
                  },
                  {
                    "name" => "Series Seed Preferred Stock",
                    "original_issue_price_in_dollars" => 1.00,
                  }
                ],
                "investors" => [
                  {
                    "name" => "John Doe",
                    "email" => "john@example.com",
                    "country" => "United States",
                    "share_holdings" => [
                      {
                        "name" => "CS-1",
                        "issued_at" => "2024-01-01",
                        "share_class" => "Common Stock",
                        "number_of_shares" => 1_000_000,
                        "share_price_usd" => 0.01,
                        "total_amount_in_cents" => 1_000_00,
                      }
                    ],
                  },
                  {
                    "name" => "Jane Smith",
                    "email" => "jane@example.com",
                    "country" => "United States",
                    "share_holdings" => [
                      {
                        "name" => "PS-1",
                        "issued_at" => "2024-01-02",
                        "share_class" => "Series Seed Preferred Stock",
                        "number_of_shares" => 500_000,
                        "share_price_usd" => 1.00,
                        "total_amount_in_cents" => 500_000_00,
                      }
                    ],
                  }
                ],
                "option_pools" => [
                  {
                    "share_class" => "Common Stock",
                    "authorized_shares" => 1_000_000,
                    "issued_shares" => 100_000,
                    "name" => "2024 Options Pool",
                  }
                ],
                "company_values" => {
                  "fully_diluted_shares" => 11_500_000,
                },
              }.to_json,
            },
          }
        ],
      }
    end

    let(:openai_client) { instance_double(OpenAI::Client) }

    before do
      allow(OpenAI::Client).to receive(:new).and_return(openai_client)
      allow(openai_client).to receive(:chat).and_return(openai_response)
    end

    context "when company has existing cap table data" do
      it "raises error when company has option pools" do
        create(:option_pool, company:)
        expect { described_class.new(cap_table_upload: cap_table_upload).call }
          .to raise_error(ProcessCapTableUpload::ExistingCapTableError, /Cannot process cap table upload/)
      end

      it "raises error when company has share classes" do
        create(:share_class, company:)
        expect { described_class.new(cap_table_upload: cap_table_upload).call }
          .to raise_error(ProcessCapTableUpload::ExistingCapTableError, /Cannot process cap table upload/)
      end

      it "raises error when company has investors" do
        create(:company_investor, company:)
        expect { described_class.new(cap_table_upload: cap_table_upload).call }
          .to raise_error(ProcessCapTableUpload::ExistingCapTableError, /Cannot process cap table upload/)
      end

      it "raises error when company has share holdings" do
        investor = create(:company_investor, company:)
        create(:share_holding, company_investor: investor)
        expect { described_class.new(cap_table_upload: cap_table_upload).call }
          .to raise_error(ProcessCapTableUpload::ExistingCapTableError, /Cannot process cap table upload/)
      end
    end

    context "with JSON file" do
      subject(:process_cap_table) { described_class.new(cap_table_upload: cap_table_upload).call }

      it "creates share classes" do
        expect { process_cap_table }.to change(ShareClass, :count).by(2)

        common = ShareClass.find_by(name: "Common Stock")
        expect(common).to have_attributes(
          original_issue_price_in_dollars: 0.01
        )

        preferred = ShareClass.find_by(name: "Series Seed Preferred Stock")
        expect(preferred).to have_attributes(
          original_issue_price_in_dollars: 1.00
        )
      end

      it "writes parsed data to cap_table_upload" do
        process_cap_table
        parsed_data = cap_table_upload.reload.parsed_data
        expect(parsed_data).to include(
          "share_classes" => a_collection_including(
            a_hash_including("name" => "Common Stock", "original_issue_price_in_dollars" => 0.01),
            a_hash_including("name" => "Series Seed Preferred Stock", "original_issue_price_in_dollars" => 1.00)
          ),
          "investors" => a_collection_including(
            a_hash_including("name" => "John Doe", "email" => "john@example.com"),
            a_hash_including("name" => "Jane Smith", "email" => "jane@example.com")
          )
        )
      end

      it "creates users and company investors" do
        expect { process_cap_table }.to change { User.where.not(id: uploader.id).count }.by(2)
          .and change(CompanyInvestor, :count).by(2)

        john = User.find_by(email: "john@example.com")
        expect(john).to have_attributes(
          legal_name: "John Doe",
          preferred_name: "John Doe",
          country_code: "United States"
        )

        john_investor = john.company_investors.first
        expect(john_investor).to have_attributes(
          investment_amount_in_cents: 1_000_00
        )

        jane = User.find_by(email: "jane@example.com")
        expect(jane).to have_attributes(
          legal_name: "Jane Smith",
          preferred_name: "Jane Smith",
          country_code: "United States"
        )

        jane_investor = jane.company_investors.first
        expect(jane_investor).to have_attributes(
          total_shares: 500_000,
          investment_amount_in_cents: 500_000_00
        )
      end

      it "creates share holdings" do
        expect { process_cap_table }.to change(ShareHolding, :count).by(2)

        john_holding = ShareHolding.find_by(name: "CS-1")
        expect(john_holding).to have_attributes(
          issued_at: Date.new(2024, 1, 1),
          originally_acquired_at: Date.new(2024, 1, 1),
          number_of_shares: 1_000_000,
          share_price_usd: 0.01,
          total_amount_in_cents: 1_000_00,
          share_holder_name: "John Doe"
        )

        jane_holding = ShareHolding.find_by(name: "PS-1")
        expect(jane_holding).to have_attributes(
          issued_at: Date.new(2024, 1, 2),
          originally_acquired_at: Date.new(2024, 1, 2),
          number_of_shares: 500_000,
          share_price_usd: 1.00,
          total_amount_in_cents: 500_000_00,
          share_holder_name: "Jane Smith"
        )
      end

      it "creates option pools" do
        expect { process_cap_table }.to change(OptionPool, :count).by(1)

        pool = OptionPool.last
        expect(pool).to have_attributes(
          authorized_shares: 1_000_000,
          issued_shares: 100_000,
          name: "2024 Options Pool",
        )
        expect(pool.share_class.name).to eq("Common Stock")
      end

      it "finds existing users instead of creating new ones" do
        existing_user = create(:user, email: "john@example.com")

        expect { process_cap_table }.to change { User.where.not(id: uploader.id).count }.by(1)
        expect(CompanyInvestor.first.user).to eq(existing_user)
      end
    end

    context "with Excel file" do
      subject(:process_cap_table) { described_class.new(cap_table_upload: excel_cap_table_upload).call }

      let(:workbook) { instance_double(RubyXL::Workbook) }
      let(:row1) { instance_double(RubyXL::Row, cells: [instance_double(RubyXL::Cell, value: "Header 1"), instance_double(RubyXL::Cell, value: "Header 2")]) }
      let(:row2) { instance_double(RubyXL::Row, cells: [instance_double(RubyXL::Cell, value: "Data 1"), instance_double(RubyXL::Cell, value: "Data 2")]) }
      let(:sheet1) do
        instance_double(RubyXL::Worksheet,
                        sheet_name: "Common Stock",
                        each: [row1, row2])
      end

      before do
        allow(RubyXL::Parser).to receive(:parse).and_return(workbook)
        allow(workbook).to receive(:worksheets).and_return([sheet1])
        allow(sheet1).to receive(:each).and_yield(row1).and_yield(row2)
        allow(row1).to receive(:[]).with(0).and_return(row1.cells[0])
        allow(row2).to receive(:[]).with(0).and_return(row2.cells[0])
      end

      it "converts Excel file to text format" do
        expect(openai_client).to receive(:chat) do |params|
          expect(params[:parameters][:messages].second[:content]).to eq(
            "---Common Stock\nHeader 1,Header 2\nData 1,Data 2"
          )
          openai_response
        end

        process_cap_table
      end
    end
  end
end
