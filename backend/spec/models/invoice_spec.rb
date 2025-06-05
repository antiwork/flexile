# frozen_string_literal: true

RSpec.describe Invoice do
  describe "associations" do
    it { is_expected.to belong_to(:company) }
    it { is_expected.to belong_to(:company_worker) }
    it { is_expected.to belong_to(:user) }
    it { is_expected.to belong_to(:created_by).class_name("User") }
    it { is_expected.to belong_to(:equity_grant).optional(true) }

    it { is_expected.to have_many(:invoice_line_items) }
    it { is_expected.to have_many(:invoice_expenses) }
    it { is_expected.to have_many(:invoice_approvals) }
    it { is_expected.to have_many(:payments) }
    it { is_expected.to have_many_attached(:attachments) }
    it { is_expected.to have_many(:consolidated_invoices_invoices) }
    it { is_expected.to have_many(:consolidated_invoices) }
    it { is_expected.to have_many(:integration_records) }
    it { is_expected.to have_one(:quickbooks_journal_entry) }
  end

  describe "delegations" do
    it { is_expected.to delegate_method(:hourly?).to(:company_worker).allow_nil }
  end

  describe "validations" do
    it { is_expected.to define_enum_for(:invoice_type).with_values(services: "services", other: "other").backed_by_column_of_type(:enum).with_prefix(:invoice_type) }
    it { is_expected.to validate_presence_of(:status) }
    it { is_expected.to validate_inclusion_of(:status).in_array(Invoice::ALL_STATES) }
    it { is_expected.to validate_presence_of(:total_amount_in_usd_cents) }
    it { is_expected.to validate_numericality_of(:total_amount_in_usd_cents).is_greater_than(99).only_integer }
    it { is_expected.to validate_presence_of(:invoice_number) }
    it { is_expected.to validate_presence_of(:equity_percentage) }
    it do
      is_expected.to(validate_numericality_of(:equity_percentage)
                       .only_integer
                       .is_greater_than_or_equal_to(0)
                       .is_less_than_or_equal_to(100))
    end
    it { is_expected.to validate_presence_of(:equity_amount_in_cents) }
    it { is_expected.to validate_numericality_of(:equity_amount_in_cents).only_integer.is_greater_than_or_equal_to(0) }
    it { is_expected.to validate_presence_of(:equity_amount_in_options) }
    it { is_expected.to validate_numericality_of(:equity_amount_in_options).only_integer.is_greater_than_or_equal_to(0) }
    it { is_expected.to validate_presence_of(:cash_amount_in_cents) }
    it { is_expected.to validate_numericality_of(:cash_amount_in_cents).only_integer.is_greater_than_or_equal_to(0) }
    it { is_expected.to validate_presence_of(:flexile_fee_cents) }
    it { is_expected.to validate_numericality_of(:flexile_fee_cents).only_integer.is_greater_than_or_equal_to(50).on(:create) }
    it do
      is_expected.to validate_numericality_of(:min_allowed_equity_percentage)
        .only_integer
        .is_greater_than_or_equal_to(0)
        .is_less_than_or_equal_to(100)
        .allow_nil
    end
    it do
      is_expected.to validate_numericality_of(:max_allowed_equity_percentage)
        .only_integer
        .is_greater_than_or_equal_to(0)
        .is_less_than_or_equal_to(100)
        .allow_nil
    end

    describe "fields that we auto-populate on create" do
      subject { create(:invoice) }

      it { is_expected.to validate_presence_of(:bill_from) }
      it { is_expected.to validate_presence_of(:bill_to) }
      it { is_expected.to validate_presence_of(:due_on) }
    end

    it "allows an invoice to be created without line items" do
      invoice = build(:invoice, user: create(:user, :contractor))
      expect(invoice).to be_valid

      invoice.invoice_line_items = []
      expect(invoice).to be_valid

      invoice.invoice_line_items.build(
        {
          description: "Doing",
          minutes: 60,
          pay_rate_in_subunits: 50_00,
          total_amount_cents: 50_00,
        }
      )
      expect(invoice).to be_valid
    end

    it "ensures that the total amount is a sum of cash and equity amounts" do
      invoice = create(:invoice, total_amount_in_usd_cents: 200_00, cash_amount_in_cents: 100_00, equity_amount_in_cents: 100_00)
      expect(invoice).to be_valid

      invoice.cash_amount_in_cents = 99_99
      expect(invoice).to be_invalid
      expect(invoice.errors.full_messages).to eq(["Total amount in USD cents must equal the sum of cash and equity amounts"])

      invoice.cash_amount_in_cents = 100_00
      invoice.equity_amount_in_cents = 99_99
      expect(invoice).to be_invalid
      expect(invoice.errors.full_messages).to eq(["Total amount in USD cents must equal the sum of cash and equity amounts"])
    end

    describe "total_minutes" do
      context "for hourly contractor invoices" do
        it "ensures that total minutes is present for a services invoice type" do
          invoice = build(:invoice, user: create(:user, :contractor), total_minutes: nil)
          expect(invoice).to be_invalid
          expect(invoice.errors.full_messages).to eq(["Invoice line items minutes can't be blank", "Invoice line items minutes is not a number", "Total minutes can't be blank", "Total minutes is not a number"])

          invoice.total_minutes = 0
          invoice.invoice_line_items.first.minutes = 0
          expect(invoice).to be_invalid
          expect(invoice.errors.full_messages).to eq(["Invoice line items minutes must be greater than 0"])

          invoice.total_minutes = Invoice::MAX_MINUTES + 1
          invoice.invoice_line_items.first.minutes = Invoice::MAX_MINUTES + 1
          expect(invoice).to be_invalid
          expect(invoice.errors.full_messages).to eq(["Total minutes must be less than or equal to 9600"])

          invoice.total_minutes = 60
          expect(invoice).to be_valid
        end

        it "does not validate total minutes for a non-services invoice type" do
          invoice = build(:invoice, user: create(:user, :contractor), total_minutes: nil, invoice_type: "other")
          expect(invoice).to be_valid
        end
      end

      it "does not validate total minutes for project-based contractor invoices" do
        invoice = build(:invoice, company_worker: create(:company_worker, :project_based), total_minutes: nil)
        expect(invoice).to be_valid

        invoice.total_minutes = 0
        expect(invoice).to be_valid
      end
    end

    describe "allowed equity percentage range" do
      it "ensures that min allowed equity percentage is less than or equal to max allowed equity percentage" do
        invoice = build(:invoice, min_allowed_equity_percentage: 81, max_allowed_equity_percentage: 80)
        expect(invoice).to be_invalid
        expect(invoice.errors.full_messages).to eq(["Min allowed equity percentage must be less than or equal to maximum allowed equity percentage"])

        invoice.min_allowed_equity_percentage = 80
        expect(invoice).to be_valid

        invoice.min_allowed_equity_percentage = 0
        expect(invoice).to be_valid
      end
    end
  end

  describe "scopes" do
    describe ".approved" do
      it "returns approved invoices that have the required number of approvals" do
        company = create(:company)
        create(:invoice, status: Invoice::RECEIVED)
        create(:invoice, :partially_approved, company:)

        expected = []
        expected << create(:invoice, :fully_approved, company:)
        expected << create(:invoice, :approved, company:, approvals: company.required_invoice_approval_count + 1)

        expect(described_class.approved).to match_array expected
      end
    end

    describe ".partially_approved" do
      it "returns approved invoices that do not have the required number of approvals" do
        company = create(:company)
        create(:invoice, status: Invoice::RECEIVED)
        create(:invoice, :fully_approved, company:)
        create(:invoice, :approved, company:, approvals: company.required_invoice_approval_count + 1)

        invoice = create(:invoice, :partially_approved, company:)

        expect(described_class.partially_approved).to match_array invoice
      end
    end

    describe ".received" do
      it "returns received invoices" do
        received = create(:invoice, status: Invoice::RECEIVED)
        create(:invoice, status: Invoice::FAILED)

        expect(described_class.received).to match_array [received]
      end
    end

    describe ".pending" do
      it "returns pending (non-rejected or paid) invoices" do
        pending = [Invoice::RECEIVED, Invoice::APPROVED, Invoice::PROCESSING, Invoice::FAILED].map do |status|
          create(:invoice, status:)
        end
        create(:invoice, status: Invoice::PAID)
        create(:invoice, status: Invoice::REJECTED)

        expect(described_class.pending).to match_array pending
      end
    end

    describe ".processing" do
      let(:invoice) { create(:invoice, status: Invoice::PROCESSING) }

      it "returns processing invoices" do
        expect(described_class.processing).to match_array([invoice])
      end
    end

    describe ".mid_payment" do
      let(:invoice) { create(:invoice, status: Invoice::PROCESSING) }

      it "returns invoices whose payment is in progress" do
        invoices = [Invoice::PROCESSING, Invoice::PAYMENT_PENDING].map do |status|
          create(:invoice, status:)
        end
        [Invoice::RECEIVED, Invoice::APPROVED, Invoice::FAILED, Invoice::PAID, Invoice::REJECTED].each do |status|
          create(:invoice, status:)
        end

        expect(described_class.mid_payment).to match_array invoices
      end
    end

    describe ".paid" do
      it "returns paid invoices" do
        paid = create(:invoice, :paid)
        create(:invoice, :processing)
        create(:invoice, :failed)
        create(:invoice, :approved)
        create(:invoice, :rejected)

        expect(described_class.paid).to match_array [paid]
      end
    end

    describe ".for_next_consolidated_invoice" do
      it "returns invoices that are paid, mid-payment, or fully approved but not assigned to a consolidated invoice" do
        failed_after_approval = create(:invoice, :fully_approved)
        failed_after_approval.update!(status: Invoice::FAILED)

        # invoices created by someone other than the user
        admin = create(:user)
        create(:invoice, :fully_approved, created_by: admin)
        accepted = create(:invoice, :fully_approved, created_by: admin, accepted_at: Time.current)

        for_next_consolidated_invoice = [
          create(:invoice, :fully_approved),
          create(:invoice, :paid),
          create(:invoice, status: Invoice::PROCESSING),
          create(:invoice, status: Invoice::PAYMENT_PENDING),
          failed_after_approval,
          accepted,
        ]
        create(:invoice, :partially_approved)
        create(:invoice, status: Invoice::FAILED)
        create(:invoice, status: Invoice::REJECTED)

        paid_and_charged = create(:invoice, :paid)
        approved_and_charged = create(:invoice, :approved)
        create(:consolidated_invoice, invoices: [paid_and_charged, approved_and_charged])

        expect(described_class.for_next_consolidated_invoice).to match_array for_next_consolidated_invoice
      end
    end

    describe ".for_tax_year" do
      it "returns invoices that are paid for the given tax year" do
        tax_year = 2020
        paid_invoices = [
          create(:invoice, :paid, invoice_date: Date.new(tax_year, 1, 1), paid_at: Date.new(tax_year, 1, 7)),
          create(:invoice, :paid, invoice_date: Date.new(tax_year, 2, 1), paid_at: Date.new(tax_year, 2, 7)),
        ]
        create(:invoice, :failed, approvals: 2, invoice_date: Date.new(tax_year, 2, 1))
        create(:invoice, :processing, invoice_date: Date.new(tax_year, 3, 1))
        create(:invoice, :fully_approved, invoice_date: Date.new(tax_year, 4, 1))
        create(:invoice, :partially_approved, invoice_date: Date.new(tax_year, 5, 1))
        create(:invoice, invoice_date: Date.new(tax_year, 6, 1))
        create(:invoice, :rejected, invoice_date: Date.new(tax_year, 7, 1))

        # Invoice paid in the next tax year
        create(:invoice, :paid, invoice_date: Date.new(tax_year, 12, 31), paid_at: Date.new(tax_year + 1, 1, 7))

        expect(described_class.for_tax_year(tax_year)).to match_array paid_invoices
      end
    end

    describe ".paid_or_mid_payment" do
      it "returns paid and mid-payment invoices" do
        create_list(:invoice, 2, :fully_approved)
        paid_and_mid_payment = Invoice::PAID_OR_PAYING_STATES.map { create(:invoice, status: _1) }

        [Invoice::RECEIVED, Invoice::APPROVED, Invoice::FAILED, Invoice::REJECTED].each do |status|
          create(:invoice, status:)
        end
        create(:invoice, :partially_approved)

        expect(described_class.paid_or_mid_payment).to match_array(paid_and_mid_payment)
      end
    end

    describe ".not_pending_acceptance" do
      it "returns invoices that are not pending acceptance" do
        user = create(:user)
        admin = create(:user)

        expected = [
          create(:invoice, user:, created_by: user), # Created by the user themselves
          create(:invoice, user:, created_by: admin, accepted_at: Time.current), # Created by admin but accepted
          create(:invoice, user:, created_by: user, accepted_at: Time.current), # Both conditions true
        ]

        create(:invoice, user:, created_by: admin) # Created by admin and not accepted

        expect(described_class.not_pending_acceptance).to match_array(expected)
      end
    end
  end

  describe "callbacks" do
    describe "#destroy_approvals" do
      let(:invoice) { create(:invoice) }

      before do
        create_list(:invoice_approval, 2, invoice:)
      end

      [Invoice::RECEIVED, Invoice::APPROVED, Invoice::PROCESSING, Invoice::PAID].each do |status|
        context "when an invoice is being marked as #{status}" do
          let(:status) { status }

          it "does not destroy existing approvals" do
            expect do
              invoice.update!(status:)
            end.to_not change { invoice.reload.invoice_approvals.count }
          end
        end
      end

      context "when an invoice is being marked as rejected" do
        it "destroys any existing approvals" do
          expect do
            invoice.update!(status: Invoice::REJECTED)
          end.to change { invoice.reload.invoice_approvals.count }.by(-2)
        end
      end
    end

    describe "#sync_with_quickbooks" do
      let(:invoice) { create(:invoice) }

      [Invoice::RECEIVED, Invoice::PROCESSING, Invoice::REJECTED, Invoice::PAID].each do |status|
        context "when an invoice is being marked as #{status}" do
          let(:status) { status }

          it "does not schedule a Quickbooks data sync job" do
            expect do
              invoice.update!(status:)
            end.to_not change { QuickbooksDataSyncJob.jobs.size }
          end
        end
      end

      context "when an invoice is partially approved" do
        before { create(:invoice_approval, invoice:) }

        it "does not schedule a Quickbooks data sync job" do
          expect do
            invoice.update!(status: Invoice::APPROVED)
          end.to_not change { QuickbooksDataSyncJob.jobs.size }
        end
      end

      context "when an invoice is fully approved" do
        before do
          create(:invoice_approval, invoice:)
          invoice.update!(status: Invoice::APPROVED)
        end

        it "schedules a QuickBooks data sync job" do
          expect do
            create(:invoice_approval, invoice:)
            invoice.update!(status: Invoice::APPROVED)
          end.to change { QuickbooksDataSyncJob.jobs.size }.by(1)

          expect(QuickbooksDataSyncJob).to have_enqueued_sidekiq_job(invoice.company_id, "Invoice", invoice.id)
        end
      end
    end
  end

  describe "delegations" do
    it { is_expected.to delegate_method(:integration_external_id).to(:quickbooks_integration_record) }
    it { is_expected.to delegate_method(:sync_token).to(:quickbooks_integration_record) }
  end

  describe "#attachment" do
    it "returns the last attachment" do
      invoice = create(:invoice)
      invoice.attachments.attach(io: File.open(Rails.root.join("public/robots.txt")), filename: "robots.txt", content_type: "text/plain")

      expect(invoice.attachments.size).to eq(2)
      expect(invoice.attachment).to eq(invoice.attachments.last)
    end
  end

  describe "#total_amount_in_usd" do
    let(:invoice) { build(:invoice, total_amount_in_usd_cents: 1234_56) }

    it "converts total amount to USD" do
      expect(invoice.total_amount_in_usd).to eq(1234.56)
    end
  end

  describe "#cash_amount_in_usd" do
    let(:invoice) { build(:invoice, cash_amount_in_cents: 1234_56) }

    it "converts cash amount to USD" do
      expect(invoice.cash_amount_in_usd).to eq(1234.56)
    end
  end

  describe "#equity_amount_in_usd" do
    let(:invoice) { build(:invoice, equity_amount_in_cents: 1234_56) }

    it "converts equity amount to USD" do
      expect(invoice.equity_amount_in_usd).to eq(1234.56)
    end
  end

  describe "#equity_vested?" do
    context "when invoice equity grant is missing" do
      it "returns false" do
        invoice = build(:invoice, equity_grant_id: nil)
        expect(invoice.equity_vested?).to eq(false)
      end
    end

    context "when invoice equity grant is present" do
      it "returns true" do
        invoice = build(:invoice, equity_grant: create(:equity_grant))
        expect(invoice.equity_vested?).to eq(true)
      end
    end
  end

  describe "#rejected?" do
    it "returns true if the invoice's status is 'rejected', false otherwise" do
      expect(build(:invoice, status: Invoice::REJECTED).rejected?).to eq true

      Invoice::ALL_STATES.excluding(Invoice::REJECTED).each do |status|
        expect(build(:invoice, status:).rejected?).to eq false
      end
    end
  end

  describe "#payable?" do
    let(:invoice) { create(:invoice, status:) }

    [Invoice::RECEIVED, Invoice::REJECTED, Invoice::PROCESSING, Invoice::PAID].each do |status|
      context "when invoice status is #{status}" do
        let(:status) { status }

        it "returns false" do
          expect(invoice.payable?).to eq(false)
        end
      end
    end

    context "when invoice status is APPROVED" do
      let(:status) { Invoice::APPROVED }

      context "when approvals are missing" do
        it "returns false" do
          expect(invoice.payable?).to eq(false)
        end
      end

      context "when it has one approval" do
        before do
          create(:invoice_approval, invoice:)
        end

        it "returns false" do
          expect(invoice.payable?).to eq(false)
        end
      end

      context "when it has multiple approvals" do
        before do
          create_list(:invoice_approval, 2, invoice:)
        end

        it "returns true" do
          expect(invoice.payable?).to eq(true)
        end
      end
    end

    context "when invoice status is FAILED" do
      let(:status) { Invoice::FAILED }

      context "when approvals are missing" do
        it "returns false" do
          expect(invoice.payable?).to eq(false)
        end
      end

      context "when it has one approval" do
        before do
          create(:invoice_approval, invoice:)
        end

        it "returns false" do
          expect(invoice.payable?).to eq(false)
        end
      end

      context "when it has multiple approvals" do
        before do
          create_list(:invoice_approval, 2, invoice:)
        end

        it "returns true" do
          expect(invoice.payable?).to eq(true)
        end
      end
    end

    context "when invoice status is PAYMENT_PENDING" do
      let(:status) { Invoice::PAYMENT_PENDING }

      context "when it has sufficient approvals" do
        before { create_list(:invoice_approval, 2, invoice:) }

        it "returns true" do
          expect(invoice.payable?).to eq(true)
        end
      end

      context "when it has lacks sufficient approvals" do
        it "returns false" do
          expect(invoice.payable?).to eq(false)
        end
      end
    end

    context "when invoice was not created by the user" do
      let(:status) { Invoice::APPROVED }
      before { create_list(:invoice_approval, 2, invoice:) }

      it "returns false unless the user has accepted it" do
        invoice.update!(created_by_id: create(:user).id)
        expect(invoice.payable?).to eq(false)

        invoice.update!(accepted_at: Time.current)
        expect(invoice.payable?).to eq(true)
      end
    end

    context "when company is inactive" do
      let(:status) { Invoice::APPROVED }

      it "returns false" do
        allow_any_instance_of(Company).to receive(:active?).and_return(false)
        expect(invoice.payable?).to eq(false)
      end
    end

    context "when tax requirements are met" do
      let(:status) { Invoice::APPROVED }

      context "when it has sufficient approvals" do
        before { create_list(:invoice_approval, 2, invoice:) }

        it "returns true" do
          allow_any_instance_of(Invoice).to receive(:tax_requirements_met?).and_return(true)
          expect(invoice.payable?).to eq(true)
        end
      end
    end

    context "when tax requirements are not met" do
      let(:status) { Invoice::APPROVED }

      context "when it has sufficient approvals" do
        before { create_list(:invoice_approval, 2, invoice:) }

        it "returns false" do
          allow_any_instance_of(Invoice).to receive(:tax_requirements_met?).and_return(false)
          expect(invoice.payable?).to eq(false)
        end
      end
    end
  end

  describe "#immediately_payable?" do
    context "when company is trusted" do
      let(:invoice) { create(:invoice, company: create(:company, is_trusted: true)) }

      it "returns false if the invoice is not payable" do
        create(:consolidated_invoice, invoices: [invoice], status: Invoice::PAID)

        allow(invoice).to receive(:payable?).and_return(false)
        expect(invoice.immediately_payable?).to eq(false)

        allow(invoice).to receive(:payable?).and_return(true)
        expect(invoice.immediately_payable?).to eq(true)
      end

      it "returns false if the invoice has not been charged" do
        allow(invoice).to receive(:payable?).and_return(true)

        # No consolidated invoices thus not yet charged.
        invoice.consolidated_invoices_invoices.destroy_all
        expect(invoice.immediately_payable?).to eq(false)

        # We do not wait for trusted companies' consolidated invoices to be
        # paid to consider them charged and immediately payable.
        consolidated_invoice = create(
          :consolidated_invoice,
          status: ConsolidatedInvoice::SENT,
          invoices: [invoice]
        )
        expect(invoice.immediately_payable?).to eq(true)

        # However, invoices for refunded consolidated invoices are not payable.
        consolidated_invoice.update!(status: ConsolidatedInvoice::REFUNDED)
        expect(invoice.immediately_payable?).to eq(false)

        # Unless there is another paid consolidated invoice.
        create(:consolidated_invoice, :paid, invoices: [invoice])
        expect(invoice.immediately_payable?).to eq(true)
      end
    end

    context "when company is not trusted" do
      let(:invoice) { create(:invoice) }

      it "returns true if the invoice is payable and the invoice has already been charged successfully" do
        allow(invoice).to receive(:payable?).and_return(true)
        consolidated_invoice = create(:consolidated_invoice, invoices: [invoice])
        expect(invoice.immediately_payable?).to eq(false)

        consolidated_invoice.update!(status: Invoice::PAID)
        expect(invoice.immediately_payable?).to eq(true)
      end

      it "returns false if the invoice is not payable" do
        allow(invoice).to receive(:payable?).and_return(false)
        create(:consolidated_invoice, invoices: [invoice], status: Invoice::PAID)

        expect(invoice.immediately_payable?).to eq(false)
      end

      it "returns false if the invoice has not already been charged" do
        allow(invoice).to receive(:payable?).and_return(true)

        expect(invoice.immediately_payable?).to eq(false)

        create(:consolidated_invoice, invoices: [invoice])
        expect(invoice.immediately_payable?).to eq(false)

        invoice.company.update!(is_trusted: true)
        expect(invoice.immediately_payable?).to eq(true)
      end
    end
  end

  describe "#tax_requirements_met?" do
    let(:company) { create(:company) }
    let(:user) { create(:user) }
    let(:invoice) { create(:invoice, company:, user:) }

    context "when company has no IRS tax forms requirement" do
      it "returns true" do
        expect(invoice.tax_requirements_met?).to be true
      end

      context "when user has not confirmed tax information" do
        it "returns true" do
          allow(user).to receive(:tax_information_confirmed_at).and_return(nil)
          expect(invoice.tax_requirements_met?).to be true
        end
      end
    end

    context "when company requires IRS tax forms" do

      context "when user has confirmed tax information" do
        it "returns true" do
          allow(user).to receive(:tax_information_confirmed_at).and_return(Time.current)
          expect(invoice.tax_requirements_met?).to be true
        end
      end

      context "when user has not confirmed tax information" do
        it "returns false" do
          allow(user).to receive(:tax_information_confirmed_at).and_return(nil)
          expect(invoice.tax_requirements_met?).to be false
        end
      end
    end
  end

  describe "#company_charged?" do
    let(:invoice) { create(:invoice) }

    it "returns true if the invoice has been assigned to a paid consolidated invoice" do
      create(:consolidated_invoice, invoices: [invoice], status: ConsolidatedInvoice::PAID)
      expect(invoice.company_charged?).to be true
    end

    it "returns true if the invoice has been assigned to a sent consolidated invoice" do
      create(:consolidated_invoice, invoices: [invoice], status: ConsolidatedInvoice::SENT)
      expect(invoice.company_charged?).to be true
    end

    it "returns false if the invoice has been assigned to a failed consolidated invoice" do
      create(:consolidated_invoice, invoices: [invoice], status: ConsolidatedInvoice::FAILED)
      expect(invoice.company_charged?).to be false
    end

    it "returns false if the invoice has been assigned to a refunded consolidated invoice" do
      create(:consolidated_invoice, invoices: [invoice], status: ConsolidatedInvoice::REFUNDED)
      expect(invoice.company_charged?).to be false
    end

    it "returns false if the invoice has not been assigned to any consolidated invoice" do
      expect(invoice.company_charged?).to be false
    end
  end

  describe "#company_paid?" do
    let(:invoice) { create(:invoice) }

    it "returns true if the invoice has been assigned to a paid consolidated invoice" do
      create(:consolidated_invoice, invoices: [invoice], status: Invoice::PAID)
      expect(invoice.company_paid?).to be true
    end

    it "returns false if the invoice has been assigned to a sent consolidated invoice" do
      create(:consolidated_invoice, invoices: [invoice], status: ConsolidatedInvoice::SENT)
      expect(invoice.company_paid?).to be false
    end

    it "returns false if the invoice has been assigned to a failed consolidated invoice" do
      create(:consolidated_invoice, invoices: [invoice], status: ConsolidatedInvoice::FAILED)
      expect(invoice.company_paid?).to be false
    end

    it "returns false if the invoice has been assigned to a refunded consolidated invoice" do
      create(:consolidated_invoice, invoices: [invoice], status: ConsolidatedInvoice::REFUNDED)
      expect(invoice.company_paid?).to be false
    end

    it "returns false if the invoice has not been assigned to any consolidated invoice" do
      expect(invoice.company_paid?).to be false
    end
  end

  describe "#payment_expected_by" do
    let(:invoice) { create(:invoice, status:) }
    before { allow_any_instance_of(Company).to receive(:contractor_payment_processing_time_in_days).and_return(7) }

    context "when invoice is pending payment or processing" do
      let(:status) { [Invoice::PROCESSING, Invoice::PAYMENT_PENDING].sample }

      context "and a consolidated invoice has been created" do
        before do
          travel_to(date)
          create(:consolidated_invoice, invoices: [invoice])
        end

        context "when the expected date falls on a weekday" do
          let(:date) { Date.parse("June 10, 2024") } # a Monday

          it "returns the expected date" do
            expect(invoice.payment_expected_by).to eq Date.parse("June 17, 2024")
          end
        end

        context "when the expected date falls on a weekend" do
          let(:date) { Date.parse("June 1, 2024") } # a Saturday

          it "returns the next weekday" do
            expect(invoice.payment_expected_by).to eq Date.parse("June 10, 2024") # + 7 days is a Saturday; the 10th is a Monday
          end
        end
      end

      context "and a consolidated invoice has not been created" do # shouldn't happen
        it "returns nil" do
          expect(invoice.payment_expected_by).to eq nil
        end
      end
    end

    context "when invoice is not pending payment or processing" do
      let(:status) { (Invoice::ALL_STATES - [Invoice::PROCESSING, Invoice::PAYMENT_PENDING]).sample }
      before { create(:consolidated_invoice, invoices: [invoice]) } # shouldn't happen, except for "paid" status

      it "returns nil" do
        expect(invoice.payment_expected_by).to eq nil
      end
    end
  end

  describe "#populate_bill_data" do
    it "auto-populates bill data" do
      invoice = create(:invoice)

      expect(invoice.bill_from).to be_present
      expect(invoice.bill_to).to be_present
      expect(invoice.due_on).to be_present

      expect(invoice.bill_from).to eq(invoice.user.legal_name)
      expect(invoice.bill_to).to eq(invoice.company.name)
      expect(invoice.due_on).to eq(invoice.invoice_date)
    end

    it "auto-populates bill_from for a user billing as a business" do
      user = create(:user, :contractor, :without_compliance_info).tap do
        create(:user_compliance_info, user: _1, business_entity: true, business_name: "ABC Company")
      end.reload
      invoice = create(:invoice, user:)

      expect(invoice.bill_from).to eq("ABC Company")
    end
  end

  describe "#recommended_invoice_number" do
    context "when there is no preceding invoice" do
      it "returns 1" do
        invoice = create(:invoice)
        expect(invoice.recommended_invoice_number).to eq("1")
      end
    end

    context "when there is a preceding invoice" do
      tests = [
        # [ input, expected ]
        ["FOO", "1"],
        ["1", "2"],
        ["9", "10"],
        ["SD-GUM-44", "SD-GUM-45"],
        ["SD-GUM-99", "SD-GUM-100"],
        ["INV-0221", "INV-0222"],
        ["INV-0999", "INV-1000"],
        ["00011", "00012"],
        ["00009", "00010"],
        ["2022-10", "2022-11"],
        ["2022-99", "2022-100"],
        ["96563/0013", "96563/0014"],
        ["SM-GUM-24", "SM-GUM-25"],
        ["SH028", "SH029"],
        ["SH099", "SH100"],
        ["SH999", "SH1000"],
        ["CYPNINT22-5", "CYPNINT22-6"],
        ["CYPNINT22-9", "CYPNINT22-10"],
        ["INV-001-001", "INV-001-002"],
      ]

      tests.each do |t|
        input, expected = t
        context "when preceding invoice number is #{input}" do
          let(:company) { create(:company) }
          let(:user) { create(:user, :contractor) }
          let!(:preceding_invoice) { create(:invoice, company:, user:, invoice_number: input) }
          let!(:invoice) { create(:invoice, company:, user:) }

          it "returns #{expected}" do
            expect(invoice.recommended_invoice_number).to eq(expected)
          end
        end
      end
    end

    context "when there are multiple preceding invoices" do
      let(:company) { create(:company) }
      let(:user) { create(:user, :contractor) }
      let!(:invoice) { create(:invoice, company:, user:) }
      let!(:older_invoice) { create(:invoice, company:, user:, invoice_number: "INV-102", invoice_date: (invoice.invoice_date - 7.days)) }
      let!(:oldest_invoice) { create(:invoice, company:, user:, invoice_number: "INV-01", invoice_date: (invoice.invoice_date - 14.days)) }

      let!(:unrelated_invoice_1) { create(:invoice, invoice_date: (invoice.invoice_date - 2.days)) } # unrelated company and user
      let!(:unrelated_invoice_2) { create(:invoice, user:,  invoice_date: (invoice.invoice_date - 3.days)) } # share user, not company
      let!(:unrelated_invoice_3) { create(:invoice, company:, invoice_date: (invoice.invoice_date - 4.days)) } # share company, not user

      it "reccomends based on the preceding invoice with the same company and user" do
        expect(oldest_invoice.recommended_invoice_number).to eq("1")
        expect(older_invoice.recommended_invoice_number).to eq("INV-02")
        expect(invoice.recommended_invoice_number).to eq("INV-103")

        expect(unrelated_invoice_1.recommended_invoice_number).to eq("1")
        expect(unrelated_invoice_2.recommended_invoice_number).to eq("1")
        expect(unrelated_invoice_3.recommended_invoice_number).to eq("1")
      end
    end

    context "when the preceding invoice was rejected" do
      let(:company) { create(:company) }
      let(:user) { create(:user, :contractor) }

      let!(:invoice) { create(:invoice, company:, user:) }
      let!(:older_rejected_invoice) { create(:invoice, company:, user:, invoice_number: "INV-002", invoice_date: (invoice.invoice_date - 7.days), status: Invoice::REJECTED) }
      let!(:oldest_invoice) { create(:invoice, company:, user:, invoice_number: "1", invoice_date: (invoice.invoice_date - 14.days)) }

      it "recommends based on the first preceding non-rejected invoice" do
        expect(invoice.recommended_invoice_number).to eq("2")
      end
    end

    context "when two invoices have the same invoice_date" do
      let(:company) { create(:company) }
      let(:user) { create(:user, :contractor) }

      let!(:first_invoice) { create(:invoice, company:, invoice_number: "1", user:,) }
      let!(:second_invoice) { create(:invoice, company:, user:) }

      it "recommends based on the most recently-created invoice with the same invoice_date" do
        expect(second_invoice.recommended_invoice_number).to eq("2")
      end
    end
  end

  describe "#quickbooks_entity" do
    it "returns the QuickBooks entity name" do
      expect(build(:invoice).quickbooks_entity).to eq("Bill")
    end
  end

  describe "#create_or_update_integration_record!", :freeze_time do
    let(:company) { create(:company) }
    let!(:integration) { create(:quickbooks_integration, company:) }
    let(:contractor) { create(:company_worker, company:) }
    let!(:contractor_integration_record) { create(:integration_record, integration:, integratable: contractor) }
    let(:invoice) { create(:invoice, company:, user: contractor.user, total_amount_in_usd_cents: 1_060_00) }
    let(:invoice_line_item) { invoice.invoice_line_items.first }
    let!(:invoice_expense) { create(:invoice_expense, invoice:) }
    let(:parsed_body) do
      {
        "SyncToken" => "0",
        "domain" => "QBO",
        "VendorRef" => {
          "name" => "Bob's Burger Joint",
          "value" => contractor_integration_record.integration_external_id,
        },
        "TxnDate" => "2023-06-01",
        "TotalAmt" => 60.0,
        "APAccountRef" => {
          "name" => "Accounts Payable (A/P)",
          "value" => "33",
        },
        "Id" => "151",
        "sparse" => false,
        "Line" => [
          {
            "DetailType" => "AccountBasedExpenseLineDetail",
            "Amount" => 60.0,
            "Id" => "1",
            "AccountBasedExpenseLineDetail" => {
              "AccountRef" => {
                "value" => "7",
              },
            },
            "LineNum" => 1,
          },
          {
            "DetailType" => "AccountBasedExpenseLineDetail",
            "Amount" => 1_000.0,
            "Id" => "3",
            "AccountBasedExpenseLineDetail" => {
              "AccountRef" => {
                "value" => "22",
              },
            },
            "LineNum" => 2,
          }
        ],
        "Balance" => 1_060.0,
        "DueDate" => "2023-06-30",
      }
    end

    context "when no integration record exists for the invoice" do
      it "creates a new integration record for the invoice and associated line items" do
        expect do
          invoice.create_or_update_quickbooks_integration_record!(integration:, parsed_body:)
        end.to change { IntegrationRecord.count }.by(3)
        .and change { integration.reload.last_sync_at }.from(nil).to(Time.current)

        invoice_integration_record = invoice.reload.quickbooks_integration_record
        expect(invoice_integration_record.integration_external_id).to eq("151")
        expect(invoice_integration_record.sync_token).to eq("0")
        line_item_integration_record = invoice_line_item.reload.quickbooks_integration_record
        expect(line_item_integration_record.integration_external_id).to eq("1")
        expect(line_item_integration_record.sync_token).to be_nil # we don't get sync tokens for line items
        expense_integration_record = invoice_expense.reload.quickbooks_integration_record
        expect(expense_integration_record.integration_external_id).to eq("3")
        expect(expense_integration_record.sync_token).to be_nil # we don't get sync tokens for line items
      end
    end

    context "when an integration record exists for the invoice" do
      let!(:invoice_integration_record) { create(:integration_record, integratable: invoice, integration:, integration_external_id: "151") }
      let!(:line_item_integration_record) { create(:integration_record, integratable: invoice_line_item, integration:, integration_external_id: "1") }
      let!(:expense_integration_record) { create(:integration_record, integratable: invoice_expense, integration:, integration_external_id: "3") }

      it "updates the integration record with the new sync_token" do
        # Update the sync token
        parsed_body["SyncToken"] = "1"

        expect do
          invoice.create_or_update_quickbooks_integration_record!(integration:, parsed_body:)
        end.to change { IntegrationRecord.count }.by(0)
        .and change { integration.reload.last_sync_at }.from(nil).to(Time.current)

        expect(invoice_integration_record.reload.integration_external_id).to eq("151")
        expect(invoice_integration_record.sync_token).to eq("1")
        expect(line_item_integration_record.reload.integration_external_id).to eq("1")
        expect(line_item_integration_record.sync_token).to be_nil # we don't get sync tokens for line items
        expect(expense_integration_record.reload.integration_external_id).to eq("3")
        expect(expense_integration_record.sync_token).to be_nil # we don't get sync tokens for line items
      end

      context "when a new invoice line item is added" do
        let!(:new_invoice_line_item) { create(:invoice_line_item, invoice:, description: "Programming", minutes: 120) }
        let(:parsed_body) do
          {
            "SyncToken" => "2",
            "domain" => "QBO",
            "VendorRef" => {
              "name" => "Bob's Burger Joint",
              "value" => contractor_integration_record.integration_external_id,
            },
            "TxnDate" => "2023-06-01",
            "TotalAmt" => 180.0,
            "APAccountRef" => {
              "name" => "Accounts Payable (A/P)",
              "value" => "33",
            },
            "Id" => "151",
            "sparse" => false,
            "Line" => [
              {
                "DetailType" => "AccountBasedExpenseLineDetail",
                "Amount" => 60.0,
                "Id" => "1",
                "AccountBasedExpenseLineDetail" => {
                  "AccountRef" => {
                    "name" => "Cost of Labor",
                    "value" => "7",
                  },
                },
                "LineNum" => 1,
              },
              {
                "DetailType" => "AccountBasedExpenseLineDetail",
                "Amount" => 100.0,
                "Id" => "2",
                "AccountBasedExpenseLineDetail" => {
                  "AccountRef" => {
                    "name" => "Cost of Labor",
                    "value" => "7",
                  },
                },
                "LineNum" => 2,
              },
              {
                "DetailType" => "AccountBasedExpenseLineDetail",
                "Amount" => 1_000.0,
                "Id" => "3",
                "AccountBasedExpenseLineDetail" => {
                  "AccountRef" => {
                    "value" => "22",
                  },
                },
                "LineNum" => 3,
              }
            ],
            "Balance" => 1_180.0,
            "DueDate" => "2023-06-30",
          }
        end

        before do
          invoice.update!(total_amount_in_usd_cents: 1_180_00, cash_amount_in_cents: 1_180_00, total_minutes: 180)
          invoice.reload
        end

        it "creates a new integration record for the invoice line item" do
          expect do
            invoice.create_or_update_quickbooks_integration_record!(integration:, parsed_body:)
          end.to change { IntegrationRecord.count }.by(1)
          .and change { integration.reload.last_sync_at }.from(nil).to(Time.current)

          expect(invoice_integration_record.reload.integration_external_id).to eq("151")
          expect(invoice_integration_record.sync_token).to eq("2")
          expect(line_item_integration_record.reload.integration_external_id).to eq("1")
          expect(line_item_integration_record.sync_token).to be_nil # we don't get sync tokens for line items
          expect(new_invoice_line_item.reload.quickbooks_integration_record.integration_external_id).to eq("2")
          expect(new_invoice_line_item.reload.quickbooks_integration_record.sync_token).to be_nil # we don't get sync tokens for line items
          expect(expense_integration_record.reload.integration_external_id).to eq("3")
          expect(expense_integration_record.sync_token).to be_nil # we don't get sync tokens for line items
        end
      end
    end
  end

  describe "#serialize" do
    let(:company) { create(:company) }
    let!(:integration) { create(:quickbooks_integration, company:) }
    let(:contractor) { create(:company_worker, company:) }
    let(:quickbooks_vendor) { create(:integration_record, integratable: contractor, integration:) }
    let(:invoice) { create(:invoice, company:, user: contractor.user, total_amount_in_usd_cents: 106000) }
    let(:invoice_line_item) { invoice.invoice_line_items.first }

    it "returns the serialized object" do
      expense = create(:invoice_expense, invoice:)
      expense.expense_category.update!(expense_account_id: 5)
      expect(JSON.parse(invoice.serialize(namespace: "Quickbooks")).deep_symbolize_keys).to eq(
        {
          DocNumber: invoice.invoice_number,
          TxnDate: invoice.invoice_date.iso8601,
          VendorRef: {
            value: contractor.integration_external_id,
          },
          Line: [
            {
              Description: "Inv ##{invoice.invoice_number} - #{invoice_line_item.description}",
              DetailType: "AccountBasedExpenseLineDetail",
              Amount: 60.0,
              AccountBasedExpenseLineDetail: {
                AccountRef: {
                  value: integration.consulting_services_expense_account_id,
                },
              },
              LineNum: 1,
            },
            {
              Description: "Inv ##{invoice.invoice_number} - #{expense.description}",
              DetailType: "AccountBasedExpenseLineDetail",
              Amount: 1000.0,
              AccountBasedExpenseLineDetail: {
                AccountRef: {
                  value: "5",
                },
              },
              LineNum: 2,
            }
          ],
        }
      )
    end
  end

  describe "#mark_as_paid!", :freeze_time do
    let(:invoice) { create(:invoice) }
    let(:company) { invoice.company }
    let(:timestamp) { Time.current }
    let(:payment) { create(:payment, invoice:) }

    context "when the invoice has an equity component" do
      before do
        company.update!(equity_compensation_enabled: true)
        invoice.update!(equity_amount_in_options: 123)
      end

      it "updates the status to paid and performs the appropriate processes" do
        # Assert this so we know that the method's effects apply. The method itself is tested in company_worker_spec.rb
        expect_any_instance_of(CompanyWorker).to receive(:send_equity_percent_selection_email).and_call_original

        expect do
          invoice.mark_as_paid!(timestamp: timestamp, payment_id: payment.id)
        end.to have_enqueued_mail(CompanyWorkerMailer, :payment_sent).with(payment.id)
        invoice.reload
        expect(invoice.status).to eq(described_class::PAID)
        expect(invoice.paid_at).to eq(timestamp)
        expect(VestStockOptionsJob).to have_enqueued_sidekiq_job(invoice.id)
      end
    end

    context "when the invoice does not have an equity component" do
      it "updates the status to paid and performs the appropriate processes" do
        expect_any_instance_of(CompanyWorker).not_to receive(:send_equity_percent_selection_email)

        expect do
          invoice.mark_as_paid!(timestamp: timestamp, payment_id: payment.id)
        end.to have_enqueued_mail(CompanyWorkerMailer, :payment_sent).with(payment.id)
        invoice.reload
        expect(invoice.status).to eq(described_class::PAID)
        expect(invoice.paid_at).to eq(timestamp)
        expect(VestStockOptionsJob.jobs.size).to eq(0)
      end
    end

    context "when the company worker is an alumni" do
      before do
        company.update!(equity_compensation_enabled: true)
        invoice.company_worker.update!(ended_at: Time.current)
      end

      it "does not send the equity percent selection email" do
        expect_any_instance_of(CompanyWorker).not_to receive(:send_equity_percent_selection_email)

        expect do
          invoice.mark_as_paid!(timestamp: timestamp, payment_id: payment.id)
        end.to have_enqueued_mail(CompanyWorkerMailer, :payment_sent).with(payment.id)

        invoice.reload
        expect(invoice.status).to eq(described_class::PAID)
        expect(invoice.paid_at).to eq(timestamp)
      end
    end

    context "when no payment_id is provided" do
      before do
        company.update!(equity_compensation_enabled: true)
        invoice.update!(equity_amount_in_options: 123)
      end

      it "does not enqueue the payment_sent email" do
        # Assert this so we know that the method's effects apply. The method itself is tested in company_worker_spec.rb
        expect_any_instance_of(CompanyWorker).to receive(:send_equity_percent_selection_email).and_call_original

        expect do
          invoice.mark_as_paid!(timestamp: timestamp)
        end.not_to have_enqueued_mail(CompanyWorkerMailer, :payment_sent)
        invoice.reload
        expect(invoice.status).to eq(described_class::PAID)
        expect(invoice.paid_at).to eq(timestamp)
        expect(VestStockOptionsJob).to have_enqueued_sidekiq_job(invoice.id)
      end
    end
  end

  describe "#calculate_flexile_fee_cents" do
    it "returns $0.50 + 1.5% of the amount invoiced, capped at $15" do
      expect(build(:invoice, total_amount_in_usd_cents: 0).calculate_flexile_fee_cents).to eq 50
      expect(build(:invoice, total_amount_in_usd_cents: 100_00).calculate_flexile_fee_cents).to eq 50 + 0.015 * 100_00
      expect(build(:invoice, total_amount_in_usd_cents: 10_000_00).calculate_flexile_fee_cents).to eq 15_00
    end
  end
end
