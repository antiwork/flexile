# frozen_string_literal: true

RSpec.describe CompanyAdministratorTaxFormReviewEmailService do
  let(:company) { create(:company) }
  let!(:company_administrator) { create(:company_administrator, company:) }

  describe "#process" do
    context "when the company is not active" do
      before { company.update!(deactivated_at: 1.day.ago) }

      it "does not send an email" do
        expect do
          described_class.new(company.id, 2023).process
        end.not_to have_enqueued_mail(CompanyMailer, :tax_form_review_reminder)
      end
    end

    context "when the company is active" do
      context "when tax year is passed as param" do
        it "sends an email for the corresponding year" do
          expect do
            described_class.new(company.id, 2023).process
          end.to have_enqueued_mail(CompanyMailer, :tax_form_review_reminder)
                   .with(company_administrator_id: company_administrator.id, tax_year: 2023)
        end
      end

      context "when tax year is not passed as param" do
        it "sends an email for the previous year" do
          expect do
            described_class.new(company.id).process
          end.to have_enqueued_mail(CompanyMailer, :tax_form_review_reminder)
                   .with(company_administrator_id: company_administrator.id, tax_year: Date.current.year - 1)
        end
      end
    end
  end
end
