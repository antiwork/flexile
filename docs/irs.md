# North star: IRS Tax Filing Dashboard

The planned improvements include:

1. **Automated Processing**:
   - Scheduled Sidekiq jobs to run before IRS deadlines:
     - `Irs::Form1099divDataGenerator`
     - `Irs::Form1099necDataGenerator`
     - `Irs::Form1042sDataGenerator`
2. **Reporting and Monitoring**:
   - Metabase reports for filing 1042 annual tax reports:
     - Dividends paid to foreign investors by month
     - Dividends paid to foreign investors (totals)
3. **Form Template Management**:
   - Regular updates to IRS template PDFs from official sources:
     - https://www.irs.gov/pub/irs-pdf/f1099nec.pdf
     - https://www.irs.gov/pub/irs-pdf/f1099div.pdf
     - https://www.irs.gov/pub/irs-pdf/f1042s.pdf
4. **API Integration**:
   - Automated filing using the IRS API (documented in the Notion page)
   - Support for filing corrections through Flexile
5. **Compliance Dashboard**:
   - Company-specific view of tax form filing status
   - Download options for required tax reports

This dashboard will streamline the entire tax form filing process, reducing manual effort and ensuring timely compliance with IRS requirements.

# IRS FIRE filing process

- [FIRE test website](https://fire.test.irs.gov/logon.aspx?ReturnUrl=%2fSecure%2fMainMenu.aspx)
- [FIRE production website](https://fire.irs.gov/)
- [1p credentials](https://start.1password.com/open/i?a=NUJJBOAHSVDM7GOR67A2TLD6DY&v=nudvwugtuutbfbfuxnkf7osguy&i=cwfrdokqtrldc6yzjvx5pv2k2a&h=antiwork.1password.com)
- [IRS FIRE private note](https://start.1password.com/open/i?a=NUJJBOAHSVDM7GOR67A2TLD6DY&v=nudvwugtuutbfbfuxnkf7osguy&i=hnsdkyrskrowdx4r4zd7nlcjpe&h=antiwork.1password.com)
- Details about IRS FIRE reports and their formats:
  - https://www.irs.gov/pub/irs-pdf/p1220.pdf (for 1099-DIV and 1099-NEC)
  - https://www.irs.gov/pub/irs-pdf/p1187.pdf (for 1042-S)

## Deadlines

- 1099-NEC: **Jan 31** (or the next business day)
- 1042-S: **Mar 15** (or the next business day)
- 1042: **Mar 15** (or the next business day)
- 1099-DIV: **Mar 31** (or the next business day)

## Filing 1099s

<aside>
⚠️

Need to use the **1099 TCC** to file via FIRE

</aside>

- Upload generated text file from https://github.com/antiwork/flexile/blob/main/apps/rails/app/services/irs/form_1099nec_data_generator.rb or https://github.com/antiwork/flexile/blob/main/apps/rails/app/services/irs/form_1099div_data_generator.rb

```ruby
company = Company.find(company_id)
tax_year = 2025
is_test = false
attached = { "IRS-1099-NEC-#{tax_year}.txt" => Irs::Form1099necDataGenerator.new(company:, tax_year:, is_test:).process }
AdminMailer.custom(to: ["your-email@example.com"], subject: "[Flexile] #{company.name} 1099-NEC #{tax_year} IRS FIRE tax report #{is_test ? "test " : ""}file", body: "Attached", attached:).deliver_now
```

## Filing 1042-S

<aside>
⚠️

Need to use the **1042 TCC** to file via FIRE.

</aside>

- Upload generated text file from https://github.com/antiwork/flexile/blob/main/apps/rails/app/services/irs/form_1042s_data_generator.rb

```ruby
company = Company.find(company_id)
tax_year = 2025
is_test = false
attached = { "IRS-1042-S-#{tax_year}.txt" => Irs::Form1042sDataGenerator.new(company:, tax_year:, is_test:).process }
AdminMailer.custom(to: ["your-email@example.com"], subject: "[Flexile] #{company.name} 1042-S #{tax_year} IRS FIRE tax report #{is_test ? "test " : ""}file", body: "Attached", attached:).deliver_now
```

# IRS Tax Form Processing in Flexile

## Overview

Flexile automatically generates and prefills IRS tax forms for contractors and investors. These forms are generated based on user compliance information, payment history, and company relationships. Forms are generated as PDFs and made available for download in the Documents section.

## Tax Form Generation Timeline

- **January 5th**: Email reminders sent to company administrators to update missing tax details (`CompanyAdministratorTaxDetailsReminderJob`)
- **January 10th**: Email reminders sent to company workers to add/update their tax information (`CompanyWorkerTaxInfoReminderEmailJob`)
- **January 31st**: Tax form review job runs (`TaxFormReviewJob`) which:
  - Generates all IRS tax forms for eligible users
  - Sends review reminder emails to company administrators and users

## Document Lifecycle

1. **Generation**: Forms are created when users confirm tax information or during scheduled batch processing
2. **Review**: Users and administrators review forms for accuracy
3. **Filing**: Company administrators file forms with the IRS (currently manual process)
4. **Completion**: Forms should be marked as "filed" once submitted to the IRS
5. **Preservation**: Filed forms must be preserved even if user tax information changes

## How Forms are Generated

1. `TaxFormReviewJob` collects compliance information for company workers and investors
2. This job triggers `GenerateIrsTaxFormsJob` for each user compliance record
3. `GenerateIrsTaxFormsJob` creates appropriate tax documents based on:
   - User's tax residency status (US vs non-US)
   - Type of payments received (contractor payments vs dividends)
4. Form data is populated using form-specific data generators:
   - `Irs::Form1099necDataGenerator`
   - `Irs::Form1099divDataGenerator`
   - `Irs::Form1042sDataGenerator`
5. PDFs are prefilled and stored as document attachments using [`hexapdf` gem.](https://hexapdf.gettalong.org/)

## Step-by-Step Processes

### 1. Tax Form Generation Process

1. **Check User Eligibility**:
   - Verify user has completed tax information
   - Check if user has payments/dividends in the tax year
   - Determine appropriate form type (1099-NEC, 1099-DIV, or 1042-S)
2. **Form Data Generation**:

   ```ruby
   # Example for 1099-NEC
   user_compliance_info = UserComplianceInfo.find(user_compliance_info_id)
   company = company_id ? Company.find(company_id) : user_compliance_info.user.company_workers.first.company

   # Generate form data
   generator = Irs::Form1099necDataGenerator.new(user_compliance_info:, company:, tax_year:)
   form_data = generator.generate

   ```

3. **PDF Creation**:

   ```ruby
   # Create document record
   document = Document.create!(
     name: Document::FORM_1099_NEC,
     document_type: :tax_document,
     year: tax_year,
     company: company,
     user_compliance_info: user_compliance_info
   )

   # Serialize data for PDF prefilling
   serializer = document.fetch_serializer
   serialized_data = serializer.serialized_attributes

   # Generate prefilled PDF
   pdf_service = PrefilledPdfService.new(
     template_path: "config/data/tax_forms/1099-NEC.pdf",
     form_data: serialized_data
   )
   pdf_content = pdf_service.generate

   # Attach to document
   document.attachments.attach(
     io: StringIO.new(pdf_content),
     filename: "#{document.name}_#{tax_year}_#{company.name}.pdf",
     content_type: "application/pdf"
   )

   ```

### 2. Filing Process (Current Manual)

1. **Generate IRS File**:

   ```ruby
   # Run generator for appropriate form
   generator = Irs::Form1099necDataGenerator.new(company: company, tax_year: tax_year)
   output_file = generator.generate_combined_irs_file

   # Download file
   File.open(output_file, "r") do |file|
     send_data file.read,
               filename: "1099NEC_#{company.name}_#{tax_year}.txt",
               type: "text/plain"
   end

   ```

2. **Upload to IRS FIRE System**:
   - Login to FIRE system
   - Upload the generated file
   - Verify acceptance and copy details to be able to check after a couple of days if the report was processed successfully
3. **Mark Forms as Filed**:

   ```ruby
   # Mark all relevant documents as filed
   Document.where(
     company:,
     tax_year:,
     name: Document::FORM_1099_NEC,
   ).includes(user_compliance_info: :user).find_each do |document|
     document.signatures.create!(title: "Signer", user: document.user_compliance_info.user, signed_at: Time.current)
   end

   ```

## Form Types and Specificities

### 1099-NEC (Non-employee Compensation)

- **Purpose**: Reports payments made to US contractors
- **Eligibility**: US contractors who receive services payments cumulating $600 or more during a fiscal year
- **Data Source**: Paid invoices for the tax year (`Invoice.for_tax_year`)
- **Requirements**: Contractor must have confirmed tax information with valid Tax ID
- **Generation Process**:
  - Created for each US contractor with paid invoices
  - Populated with payment totals from all paid invoices in the tax year

### 1099-DIV (Dividends and Distributions)

- **Purpose**: Reports dividend payments made to US investors
- **Eligibility**: US investors who receive dividend payments cumulating $10 or more during a fiscal year
- **Data Source**: Paid dividends for the tax year (`Dividend.for_tax_year`)
- **Requirements**: Investor must have confirmed tax information with valid Tax ID
- **Generation Process**:
  - Created for each US investor with paid dividends
  - Includes total dividend amounts and qualified dividend portions

### 1042-S (Foreign Person's US Source Income)

- **Purpose**: Reports US-source income paid to non-US persons
- **Eligibility**: Non-US investors who receive dividend payments cumulating $10 or more during a fiscal year
- **Data Source**: Paid dividends with tax withholding for the tax year
- **Requirements**: Foreign investor must have confirmed tax information with valid Tax ID
- **Generation Process**:
  - Created for each non-US investor with paid dividends
  - Includes gross income, tax withholding amounts, and withholding rates
  - Handles special cases for different tax treaties and exemption codes

## North Star: IRS Tax Filing Dashboard

The planned improvements include:

1. **Automated Processing**:
   - Scheduled Sidekiq jobs to run before IRS deadlines:
     - `Irs::Form1099divDataGenerator`
     - `Irs::Form1099necDataGenerator`
     - `Irs::Form1042sDataGenerator`
2. **Document Status Management**:
   - UI for marking forms as filed with IRS
   - Protection of filed documents from accidental deletion
   - Tracking and displaying filing status
3. **Reporting and Monitoring**:
   - Metabase reports for filing 1042 annual tax reports:
     - Dividends paid to foreign investors by month
     - Dividends paid to foreign investors (totals)
4. **Form Template Management**:
   - Regular updates to IRS template PDFs from official sources:
     - https://www.irs.gov/pub/irs-pdf/f1099nec.pdf
     - https://www.irs.gov/pub/irs-pdf/f1099div.pdf
     - https://www.irs.gov/pub/irs-pdf/f1042s.pdf
5. **API Integration**:
   - Automated filing using the IRS API (documented in the Notion page)
   - Support for filing corrections through Flexile
6. **Compliance Dashboard**:
   - Company-specific view of tax form filing status
   - Download options for required tax reports

This dashboard will streamline the entire tax form filing process, reducing manual effort and ensuring timely compliance with IRS requirements.

## Troubleshooting

- Whenever a contractor/investor needs their tax form adjusted or regenerated, it's best to just mark the old document as deleted via `document.mark_deleted!` and regenerate a new one using the https://github.com/antiwork/flexile/blob/main/apps/rails/app/services/generate_tax_form_service.rb.
