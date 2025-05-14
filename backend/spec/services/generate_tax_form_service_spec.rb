# frozen_string_literal: true

require "support/custom_pdf_text_extractor.rb"

RSpec.describe GenerateTaxFormService do
  let(:company) do
    create(:company, :completed_onboarding, email: "hi@gumroad.com", name: "Gumroad", tax_id: "453361423",
                                            street_address: "548 Market St", city: "San Francisco", state: "CA",
                                            zip_code: "94105", country_code: "US", phone_number: "5551234567")
  end
  let(:user) do
    create(:user, :without_compliance_info, legal_name: "Jane Flex").tap do |user|
      create(:user_compliance_info, :confirmed, user:, business_entity:, business_name:, business_type:, tax_classification:)
    end
  end
  let(:tax_year) { Date.today.year }

  describe "#process" do
    subject(:generate_tax_form_service) do
      user.reload
      described_class.new(user_compliance_info:, form_name:, tax_year:, company:)
    end

    context "when the user is a company administrator" do
      let(:user) { create(:user, :company_admin) }
      let(:user_compliance_info) { user.compliance_info }
      let(:form_name) { TaxDocument::ALL_SUPPORTED_TAX_FORM_NAMES.sample }

      it "does not create a new tax document" do
        expect do
          expect(generate_tax_form_service.process).to be_nil
        end.to_not change { user_compliance_info.documents.tax_document.count }
      end
    end

    context "when the user is a company lawyer" do
      let(:user) { create(:user, :company_lawyer) }
      let(:user_compliance_info) { user.compliance_info }
      let(:form_name) { TaxDocument::ALL_SUPPORTED_TAX_FORM_NAMES.sample }

      it "does not create a new tax document" do
        expect do
          expect(generate_tax_form_service.process).to be_nil
        end.to_not change { user_compliance_info.documents.tax_document.count }
      end
    end

    shared_examples_for "existing tax document" do
      let!(:tax_document) do
        create(:tax_doc, user_compliance_info:, name: form_name, year: tax_year, company:)
      end

      it "does not create a new tax document" do
        expect do
          expect(generate_tax_form_service.process).to be_nil
        end.to_not change { user_compliance_info.documents.tax_document.count }
      end
    end

    context "when the form name is invalid" do
      let(:form_name) { "invalid_form" }
      let(:business_entity) { false }
      let(:business_name) { nil }
      let(:business_type) { nil }
      let(:tax_classification) { nil }
      let(:user_compliance_info) do
        create(:user_compliance_info, :us_resident, :confirmed, user:, tax_id: "123456789",
                                                                business_entity:, business_name:, business_type:, tax_classification:)
      end

      it "raises an ArgumentError" do
        expect { generate_tax_form_service.process }.to raise_error(ArgumentError)
      end
    end

    context "when form is a W-8BEN" do
      let(:business_entity) { false }
      let(:business_name) { nil }
      let(:business_type) { nil }
      let(:tax_classification) { nil }
      let(:form_name) { TaxDocument::FORM_W_8BEN }

      before { create(:company_worker, company:, user:) }

      context "when the user is a resident of a country with a US tax treaty" do
        let(:user_compliance_info) do
          create(:user_compliance_info, :non_us_resident, :confirmed, user:, tax_id: "123456789",
                                                                      business_entity:, business_name:, business_type:, tax_classification:)
        end

        it_behaves_like "existing tax document"

        it "creates a tax document with the correct attributes" do
          expect do
            expect(generate_tax_form_service.process).to be_an_instance_of(Document)
          end.to change { user_compliance_info.documents.tax_document.count }.by(1)

          tax_document = user_compliance_info.documents.tax_document.last
          expect(tax_document.name).to eq(form_name)
          expect(tax_document.year).to eq(tax_year)
          expect(tax_document.company_id).to eq(company.id)
          expect(tax_document.live_attachment.filename).to eq("#{tax_year}-W-8BEN-#{company.name.parameterize}-#{user.billing_entity_name.parameterize}.pdf")

          tax_document.live_attachment.open do |file|
            pdf = HexaPDF::Document.new(io: file)

            processor = CustomPDFTextExtractor.new
            pdf.pages.each { _1.process_contents(processor) }

            text = processor.texts.join("\n")
            expect(text).to include("Jane Flex")
            expect(text).to include("France")
            expect(text).to include("123456789") # FTIN
            expect(text).to include("Paris, 75C 75001")
            expect(text).to include("Article VII (Business Profits)")
            expect(text).to include("0")
            expect(text).to include("Services")
            expect(text).to include("All work is performed in France")
          end
        end
      end

      context "when the user is a resident of a country without a US tax treaty" do
        let(:user_compliance_info) do
          create(:user_compliance_info, :confirmed, user:, tax_id: "123456789", citizenship_country_code: "AR",
                                                    country_code: "AR", state: "C",
                                                    city: "Palma de Mallorca", zip_code: "76415",
                                                    street_address: "Puerta 468 Parcela Jose Eduardo", business_entity:,
                                                    business_name:, business_type:, tax_classification:)
        end

        it_behaves_like "existing tax document"

        it "creates a tax document with the correct attributes" do
          expect do
            expect(generate_tax_form_service.process).to be_an_instance_of(Document)
          end.to change { user_compliance_info.documents.tax_document.count }.by(1)

          tax_document = user_compliance_info.documents.tax_document.last
          expect(tax_document.name).to eq(form_name)
          expect(tax_document.year).to eq(tax_year)
          expect(tax_document.company_id).to eq(company.id)
          expect(tax_document.live_attachment.filename).to eq("#{tax_year}-W-8BEN-#{company.name.parameterize}-#{user.billing_entity_name.parameterize}.pdf")

          tax_document.live_attachment.open do |file|
            pdf = HexaPDF::Document.new(io: file)
            processor = CustomPDFTextExtractor.new
            pdf.pages.each { _1.process_contents(processor) }

            text = processor.texts.join("\n")
            expect(text).to include("Jane Flex")
            expect(text).to include("Argentina")
            expect(text).to include("123456789") # FTIN
            expect(text).to include("Puerta 468 Parcela Jose Eduardo")
            expect(text).to include("Palma de Mallorca, C 76415")
            expect(text).to_not include("Article VII (Business Profits)")
            expect(text).to_not include("Services")
            expect(text).to_not include("All work is performed in France")
          end
        end
      end
    end

    context "when form is a W-8BEN-E" do
      let(:business_entity) { true }
      let(:business_name) { "Flexile" }
      let(:business_type) { "partnership" }
      let(:tax_classification) { nil }
      let(:form_name) { TaxDocument::FORM_W_8BEN_E }

      before { create(:company_worker, company:, user:) }

      context "when the user is a resident of a country with a US tax treaty" do
        let(:user_compliance_info) do
          create(:user_compliance_info, :non_us_resident, :confirmed, user:, tax_id: "123456789",
                                                                      business_entity:, business_name:, business_type:, tax_classification:)
        end

        it_behaves_like "existing tax document"

        it "creates a tax document with the correct attributes" do
          expect do
            expect(generate_tax_form_service.process).to be_an_instance_of(Document)
          end.to change { user_compliance_info.documents.tax_document.count }.by(1)

          tax_document = user_compliance_info.documents.tax_document.last
          expect(tax_document.name).to eq(form_name)
          expect(tax_document.year).to eq(tax_year)
          expect(tax_document.company_id).to eq(company.id)
          expect(tax_document.live_attachment.filename).to eq("#{tax_year}-W-8BEN-E-#{company.name.parameterize}-#{user.billing_entity_name.parameterize}.pdf")

          tax_document.live_attachment.open do |file|
            pdf = HexaPDF::Document.new(io: file)
            processor = CustomPDFTextExtractor.new
            pdf.pages.each { _1.process_contents(processor) }

            text = processor.texts.join("\n")
            expect(text).to include("Flexile")
            expect(text).to include("France")
            expect(text).to include("123456789") # FTIN
            expect(text).to include("1st Street")
            expect(text).to include("Paris, 75C 75001")
            expect(text).to include("Article VII (Business Profits)")
            expect(text).to include("0")
            expect(text).to include("Services")
            expect(text).to include("All work is performed in France")
            expect(text).to include("Jane Flex")
          end
        end

        context "when the user is a resident of a country without a US tax treaty" do
          let(:user_compliance_info) do
            create(:user_compliance_info, :confirmed, user:, tax_id: "123456789", citizenship_country_code: "AR",
                                                      country_code: "AR", state: "C",
                                                      city: "Palma de Mallorca", zip_code: "76415",
                                                      street_address: "Puerta 468 Parcela Jose Eduardo", business_entity:,
                                                      business_name:, business_type:, tax_classification:)
          end

          it_behaves_like "existing tax document"

          it "creates a tax document with the correct attributes" do
            expect do
              expect(generate_tax_form_service.process).to be_an_instance_of(Document)
            end.to change { user_compliance_info.documents.tax_document.count }.by(1)

            tax_document = user_compliance_info.documents.tax_document.last
            expect(tax_document.name).to eq(form_name)
            expect(tax_document.year).to eq(tax_year)
            expect(tax_document.company_id).to eq(company.id)
            expect(tax_document.live_attachment.filename).to eq("#{tax_year}-W-8BEN-E-#{company.name.parameterize}-#{user.billing_entity_name.parameterize}.pdf")

            tax_document.live_attachment.open do |file|
              pdf = HexaPDF::Document.new(io: file)
              processor = CustomPDFTextExtractor.new
              pdf.pages.each { _1.process_contents(processor) }

              text = processor.texts.join("\n")
              expect(text).to include("Flexile")
              expect(text).to include("Argentina")
              expect(text).to include("123456789") # FTIN
              expect(text).to include("Puerta 468 Parcela Jose Eduardo")
              expect(text).to include("Palma de Mallorca, C 76415")
              expect(text).to_not include("Article VII (Business Profits)")
              expect(text).to_not include("Services")
              expect(text).to_not include("All work is performed in France")
              expect(text).to include("Jane Flex")
            end
          end
        end
      end
    end

    context "when form is a W-9" do
      let(:form_name) { TaxDocument::FORM_W_9 }
      let(:user_compliance_info) do
        create(:user_compliance_info, :us_resident, :confirmed, user:, business_entity:, business_name:, business_type:, tax_classification:)
      end

      before { create(:company_worker, company:, user:) }

      context "when the user is a business entity" do
        let(:business_entity) { true }
        let(:business_name) { "Flexile" }
        let(:business_type) { "partnership" }
        let(:tax_classification) { nil }

        it_behaves_like "existing tax document"

        it "creates a tax document with the correct attributes" do
          expect do
            expect(generate_tax_form_service.process).to be_an_instance_of(Document)
          end.to change { user_compliance_info.documents.tax_document.count }.by(1)

          tax_document = user_compliance_info.documents.tax_document.last
          expect(tax_document.name).to eq(form_name)
          expect(tax_document.year).to eq(tax_year)
          expect(tax_document.company_id).to eq(company.id)
          expect(tax_document.live_attachment.filename).to eq("#{tax_year}-W-9-#{company.name.parameterize}-#{user.billing_entity_name.parameterize}.pdf")

          tax_document.live_attachment.open do |file|
            pdf = HexaPDF::Document.new(io: file)
            processor = CustomPDFTextExtractor.new
            pdf.pages.each { _1.process_contents(processor) }

            text = processor.texts.join("\n")
            expect(text).to include("Flexile")
            expect(text).to include("123 Main St")
            expect(text).to include("San Francisco, CA 94105")
          end
        end
      end

      context "when the user is an individual" do
        let(:business_entity) { false }
        let(:business_name) { nil }
        let(:business_type) { nil }
        let(:tax_classification) { nil }

        it_behaves_like "existing tax document"

        it "creates a tax document with the correct attributes" do
          expect do
            expect(generate_tax_form_service.process).to be_an_instance_of(Document)
          end.to change { user_compliance_info.documents.tax_document.count }.by(1)

          tax_document = user_compliance_info.documents.tax_document.last
          expect(tax_document.name).to eq(form_name)
          expect(tax_document.year).to eq(tax_year)
          expect(tax_document.company_id).to eq(company.id)
          expect(tax_document.live_attachment.filename).to eq("#{tax_year}-W-9-#{company.name.parameterize}-#{user.billing_entity_name.parameterize}.pdf")

          tax_document.live_attachment.open do |file|
            pdf = HexaPDF::Document.new(io: file)
            processor = CustomPDFTextExtractor.new
            pdf.pages.each { _1.process_contents(processor) }

            text = processor.texts.join("\n")
            expect(text).to include("Jane Flex")
            expect(text).to include("123 Main St")
            expect(text).to include("San Francisco, CA 94105")
          end
        end
      end
    end

    context "when form is a 1099-DIV" do
      let(:form_name) { TaxDocument::FORM_1099_DIV }
      let(:business_entity) { false }
      let(:business_name) { nil }
      let(:business_type) { nil }
      let(:tax_classification) { nil }
      let(:user_compliance_info) do
        create(:user_compliance_info, :us_resident, :confirmed, user:, tax_id: "123456789",
                                                                business_entity:, business_name:, business_type:, tax_classification:)
      end
      let!(:company_investor_1) { create(:company_investor, user:) }
      let!(:company_investor_2) { create(:company_investor, company:, user:) }

      before do
        # Assert we support multiple investor records per account + paid dividends
        create(:dividend, :paid, company_investor: company_investor_1,
                                 total_amount_in_cents: 100_03,
                                 net_amount_in_cents: 76_03,
                                 withheld_tax_cents: 24_00,
                                 withholding_percentage: 24,
                                 created_at: Date.new(tax_year - 1, 1, 1),
                                 paid_at: Date.new(tax_year - 1, 1, 1))

        create(:dividend, :retained, company_investor: company_investor_2, created_at: Date.new(tax_year - 1, 1, 1))
        create(:dividend, :pending, company_investor: company_investor_2, created_at: Date.new(tax_year - 1, 1, 1))
        create(:dividend, :paid, company_investor: company_investor_2,
                                 total_amount_in_cents: 100_03,
                                 net_amount_in_cents: 76_03,
                                 withheld_tax_cents: 24_00,
                                 withholding_percentage: 24,
                                 created_at: Date.new(tax_year - 1, 1, 1),
                                 paid_at: Date.new(tax_year - 1, 1, 1))
        create(:dividend, :retained, company_investor: company_investor_2, created_at: Date.new(tax_year, 1, 1))
        create(:dividend, :pending, company_investor: company_investor_2, created_at: Date.new(tax_year, 1, 1))
        4.times do |number|
          create(:dividend, :paid, company_investor: company_investor_2,
                                   total_amount_in_cents: 100_03,
                                   qualified_amount_cents: number.odd? ? 100_03 : 0, # mimic some dividends not being qualified
                                   net_amount_in_cents: 76_03,
                                   withheld_tax_cents: 24_00,
                                   withholding_percentage: 24,
                                   created_at: Date.new(tax_year, 1, 1),
                                   paid_at: Date.new(tax_year, 1, 1))
        end
      end

      it_behaves_like "existing tax document"

      it "creates a tax document with the correct attributes" do
        expect do
          expect(generate_tax_form_service.process).to be_an_instance_of(Document)
        end.to change { user_compliance_info.documents.tax_document.count }.by(1)

        tax_document = user_compliance_info.documents.tax_document.last
        expect(tax_document.name).to eq(form_name)
        expect(tax_document.year).to eq(tax_year)
        expect(tax_document.company_id).to eq(company.id)
        expect(tax_document.live_attachment.filename).to eq("#{tax_year}-1099-DIV-#{company.name.parameterize}-#{user.billing_entity_name.parameterize}.pdf")

        tax_document.live_attachment.open do |file|
          pdf = HexaPDF::Document.new(io: file)
          processor = CustomPDFTextExtractor.new
          pdf.pages.each { _1.process_contents(processor) }

          text = processor.texts.join("\n")
          expect(text).to include("Gumroad, 548 Market St, San")
          expect(text).to include("Francisco, CA, US")
          expect(text).to include("94105, 5551234567")
          expect(text).to include("45-3361423")
          expect(text).to include("123-45-6789")
          expect(text).to include("Jane Flex")
          expect(text).to include("123 Main St")
          expect(text).to include("San Francisco, CA, US, 94105")
          expect(text).to include("400") # total dividend amount
          expect(text).to include("200") # qualified dividend amount
          expect(text).to include("96") # tax withheld for all dividends
        end
      end
    end

    context "when form is a 1099-NEC" do
      let(:form_name) { TaxDocument::FORM_1099_NEC }
      let(:business_entity) { false }
      let(:business_name) { nil }
      let(:business_type) { nil }
      let(:tax_classification) { nil }
      let(:user_compliance_info) do
        create(:user_compliance_info, :us_resident, :confirmed, user:, tax_id: "123456789",
                                                                business_entity:, business_name:, business_type:, tax_classification:)
      end
      let!(:company_worker_1) { create(:company_worker, user:) }
      let!(:company_worker_2) { create(:company_worker, company:, user:) }

      before do
        # Assert we support multiple worker records per account + paid invoices
        create(:invoice, :paid, company_worker: company_worker_1, invoice_date: Date.new(tax_year - 1, 1, 1), paid_at: Date.new(tax_year - 1, 1, 1))
        create(:invoice, :paid, company_worker: company_worker_1, invoice_date: Date.new(tax_year, 1, 1), paid_at: Date.new(tax_year, 1, 1))
        create(:invoice, :rejected, company_worker: company_worker_1, invoice_date: Date.new(tax_year, 1, 1))

        create(:invoice, :paid, company_worker: company_worker_2, invoice_date: Date.new(tax_year - 1, 1, 1), paid_at: Date.new(tax_year - 1, 1, 1))
        create(:invoice, :paid, company_worker: company_worker_2, invoice_date: Date.new(tax_year, 1, 1), paid_at: Date.new(tax_year, 1, 1))
        create(:invoice, :rejected, company_worker: company_worker_2, invoice_date: Date.new(tax_year, 1, 1))
        invoice_with_expenses = create(:invoice, :paid, company_worker: company_worker_2,
                                                        total_amount_in_usd_cents: 1_060_00, # line item + expense amounts
                                                        invoice_date: Date.new(tax_year, 2, 1))
        create(:invoice_expense, invoice: invoice_with_expenses)
        create(:invoice, :processing, company_worker: company_worker_2, invoice_date: Date.new(tax_year, 3, 1))
        create(:invoice, :fully_approved, company_worker: company_worker_2, invoice_date: Date.new(tax_year, 4, 1))
        create(:invoice, :partially_approved, company_worker: company_worker_2, invoice_date: Date.new(tax_year, 12, 1))
      end

      it_behaves_like "existing tax document"

      it "creates a tax document with the correct attributes" do
        expect do
          expect(generate_tax_form_service.process).to be_an_instance_of(Document)
        end.to change { user_compliance_info.documents.tax_document.count }.by(1)

        tax_document = user_compliance_info.documents.tax_document.last
        expect(tax_document.name).to eq(form_name)
        expect(tax_document.year).to eq(tax_year)
        expect(tax_document.company_id).to eq(company.id)
        expect(tax_document.live_attachment.filename).to eq("#{tax_year}-1099-NEC-#{company.name.parameterize}-#{user.billing_entity_name.parameterize}.pdf")

        tax_document.live_attachment.open do |file|
          pdf = HexaPDF::Document.new(io: file)
          processor = CustomPDFTextExtractor.new
          pdf.pages.each { _1.process_contents(processor) }

          text = processor.texts.join("\n")
          expect(text).to include("Gumroad, 548 Market St, San")
          expect(text).to include("Francisco, CA, United States")
          expect(text).to include("94105, 5551234567")
          expect(text).to include("45-3361423")
          expect(text).to include("123-45-6789")
          expect(text).to include("Jane Flex")
          expect(text).to include("123 Main St")
          expect(text).to include("San Francisco, CA, US, 94105")
          expect(text).to include("1120") # total invoice amount
        end
      end
    end

    context "when form is a 1042-S" do
      let(:form_name) { TaxDocument::FORM_1042_S }
      let(:business_entity) { false }
      let(:business_name) { nil }
      let(:business_type) { nil }
      let(:tax_classification) { nil }
      let(:company) do
        create(:company, :completed_onboarding, email: "hi@gumroad.com", name: "Gumroad", tax_id: "453361423",
                                                street_address: "548 Market St", city: "San Francisco", state: "CA",
                                                zip_code: "94105", country_code: "US", phone_number: "5551234567")
      end
      let(:user_compliance_info) do
        create(:user_compliance_info, :non_us_resident, :confirmed, user:, tax_id: "123456789",
                                                                    business_entity:, business_name:, business_type:, tax_classification:)
      end
      let!(:company_investor_1) { create(:company_investor, user:) }
      let!(:company_investor_2) { create(:company_investor, company:, user:) }

      before do
        # Assert we support multiple investor records per account + paid dividends
        create(:dividend, :paid, company_investor: company_investor_1,
                                 total_amount_in_cents: 100_03,
                                 net_amount_in_cents: 85_03,
                                 withheld_tax_cents: 15_00,
                                 withholding_percentage: 15,
                                 created_at: Date.new(tax_year - 1, 1, 1),
                                 paid_at: Date.new(tax_year - 1, 1, 1))

        create(:dividend, :retained, company_investor: company_investor_2,
                                     total_amount_in_cents: 100_00, created_at: Date.new(tax_year - 1, 1, 1))
        create(:dividend, :pending, company_investor: company_investor_2,
                                    total_amount_in_cents: 100_00, created_at: Date.new(tax_year - 1, 1, 1))
        create(:dividend, :paid, company_investor: company_investor_2,
                                 total_amount_in_cents: 100_03,
                                 net_amount_in_cents: 85_03,
                                 withheld_tax_cents: 15_00,
                                 withholding_percentage: 15,
                                 created_at: Date.new(tax_year - 1, 1, 1),
                                 paid_at: Date.new(tax_year - 1, 1, 1))

        create(:dividend, :retained, company_investor: company_investor_2,
                                     total_amount_in_cents: 100_03,
                                     net_amount_in_cents: 85_03,
                                     withheld_tax_cents: 15_00,
                                     withholding_percentage: 15,
                                     created_at: Date.new(tax_year, 1, 1))
        create(:dividend, :pending, company_investor: company_investor_2,
                                    total_amount_in_cents: 100_03,
                                    net_amount_in_cents: 85_03,
                                    withheld_tax_cents: 15_00,
                                    withholding_percentage: 15,
                                    created_at: Date.new(tax_year, 1, 1))
        4.times do
          create(:dividend, :paid, company_investor: company_investor_2,
                                   total_amount_in_cents: 100_03,
                                   net_amount_in_cents: 85_03,
                                   withheld_tax_cents: 15_00,
                                   withholding_percentage: 15,
                                   created_at: Date.new(tax_year, 1, 1),
                                   paid_at: Date.new(tax_year, 1, 1))
        end
      end

      it_behaves_like "existing tax document"

      it "creates a tax document with the correct attributes" do
        expect do
          expect(generate_tax_form_service.process).to be_an_instance_of(Document)
        end.to change { user_compliance_info.documents.tax_document.count }.by(1)

        tax_document = user_compliance_info.documents.tax_document.last
        expect(tax_document.name).to eq(form_name)
        expect(tax_document.year).to eq(tax_year)
        expect(tax_document.company_id).to eq(company.id)
        expect(tax_document.live_attachment.filename).to eq("#{tax_year}-1042-S-#{company.name.parameterize}-#{user.billing_entity_name.parameterize}.pdf")

        tax_document.live_attachment.open do |file|
          pdf = HexaPDF::Document.new(io: file)
          processor = CustomPDFTextExtractor.new
          pdf.pages.each { _1.process_contents(processor) }

          text = processor.texts.join("\n")
          expect(text).to include("Gumroad")
          expect(text).to include("04") # exemption code
          expect(text).to include("15") # tax rate
          expect(text).to include("548 Market St")
          expect(text).to include("San Francisco, CA, US, 94105")
          expect(text).to include("45-3361423")
          expect(text).to include("123456789")
          expect(text).to include("Jane Flex")
          expect(text).to include("1st Street")
          expect(text).to include("Paris, 75C, FR, 75001")
          expect(text).to include("400") # total dividends amount
          expect(text).to include("340") # dividends net amount
          expect(text).to include("60") # tax amount withheld
        end
      end
    end
  end
end
