# frozen_string_literal: true

RSpec.describe CompanyWorkerReminderEmailService do
  describe "#confirm_tax_info_reminder" do
    let(:company) { create(:company, irs_tax_forms:) }
    let(:tax_year) { Date.current.year }
    let(:company_worker_1) do
      user = create(:user, :without_compliance_info, country_code: "US", citizenship_country_code: "IN")
      create(:user_compliance_info, :confirmed, user:)
      create(:company_worker, company:, user:)
    end
    let(:company_worker_2) do
      user = create(:user, :without_compliance_info, email: "unconfirmed@example.com", country_code: "US")
      create(:user_compliance_info, user:, tax_information_confirmed_at: nil)
      create(:company_worker, company:, user:)
    end

    before do
      create(:invoice, :paid, company_worker: company_worker_1, company:, total_amount_in_usd_cents: 1000_00)
      create(:invoice, :paid, company_worker: company_worker_2, company:, total_amount_in_usd_cents: 300_00)
      create(:invoice, :paid, company_worker: company_worker_2, company:, total_amount_in_usd_cents: 300_00)

      # Contractor who is a US citizen, but not a resident
      user = create(:user, :without_compliance_info, country_code: "AE", citizenship_country_code: "US")
      create(:user_compliance_info, :confirmed, user:)
      company_worker_3 = create(:company_worker, company:, user:)
      create(:invoice, :paid, company_worker: company_worker_3, company:, total_amount_in_usd_cents: 1000_00)

      # Contractor without a paid invoice
      company_worker_4 = create(:company_worker, company:, user: create(:user))
      create(:invoice, company_worker: company_worker_4, company:, total_amount_in_usd_cents: 1000_00)

      # Contractor with a paid invoice but not above threshold
      company_worker_5 = create(:company_worker, company:, user: create(:user))
      create(:invoice, :paid, company_worker: company_worker_5, company:, total_amount_in_usd_cents: 599_99)

      # Contractor with a paid invoice above threshold but not in the given tax year
      company_worker_6 = create(:company_worker, company:, user: create(:user))
      create(:invoice, :paid, company_worker: company_worker_6, company:,
                              total_amount_in_usd_cents: 1000_00,
                              invoice_date: Date.current.prev_year,
                              paid_at: Date.current.prev_year)

      # Contractor with a paid invoice above threshold but not a US citizen or resident
      user = create(:user, country_code: "AR", citizenship_country_code: "AR")
      company_worker_7 = create(:company_worker, company:, user:)
      create(:invoice, :paid, company_worker: company_worker_7, company:, total_amount_in_usd_cents: 1000_00)
    end

    context "when 'irs_tax_forms' bit flag is set for the company" do
      let(:irs_tax_forms) { true }

      it "sends reminder email to contractors who are eligible for 1099-NEC" do
        eligible_contractor_ids = [company_worker_1.id, company_worker_2.id]
        expect do
          described_class.new.confirm_tax_info_reminder(tax_year:)
        end.to have_enqueued_mail(CompanyWorkerMailer, :confirm_tax_info_reminder).twice.with do |args|
          expect(args[:tax_year]).to eq tax_year
          expect(eligible_contractor_ids.delete(args[:company_worker_id])).to be_present
        end
      end

      context "when company is inactive" do
        it "doesn't send reminder emails to contractors" do
          company.deactivate!
          expect do
            described_class.new.confirm_tax_info_reminder(tax_year:)
          end.not_to have_enqueued_mail(CompanyWorkerMailer, :confirm_tax_info_reminder)
        end
      end
    end

    context "when 'irs_tax_forms' bit flag is not set for the company" do
      let(:irs_tax_forms) { false }

      it "doesn't send reminder emails to contractors" do
        expect do
          described_class.new.confirm_tax_info_reminder(tax_year:)
        end.not_to have_enqueued_mail(CompanyWorkerMailer, :confirm_tax_info_reminder)
      end
    end
  end
end
