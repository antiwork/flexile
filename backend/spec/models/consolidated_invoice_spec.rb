# frozen_string_literal: true

RSpec.describe ConsolidatedInvoice do
  describe "associations" do
    it { is_expected.to belong_to(:company) }
    it { is_expected.to have_many(:consolidated_invoices_invoices) }
    it { is_expected.to have_many(:invoices).through(:consolidated_invoices_invoices) }
    it { is_expected.to have_many(:consolidated_payments) }
  end

  describe "validations" do
    it { is_expected.to validate_presence_of(:flexile_fee_cents) }
    it { is_expected.to validate_numericality_of(:flexile_fee_cents).is_greater_than_or_equal_to(0).only_integer }
    it { is_expected.to validate_presence_of(:transfer_fee_cents) }
    it { is_expected.to validate_numericality_of(:transfer_fee_cents).is_greater_than_or_equal_to(0).only_integer }
    it { is_expected.to validate_presence_of(:invoice_amount_cents) }
    it { is_expected.to validate_numericality_of(:invoice_amount_cents).is_greater_than_or_equal_to(0).only_integer }
    it { is_expected.to validate_presence_of(:total_cents) }
    it { is_expected.to validate_numericality_of(:total_cents).is_greater_than(99).only_integer }
    it { is_expected.to validate_presence_of(:period_start_date) }
    it { is_expected.to validate_presence_of(:period_end_date) }
    it { is_expected.to validate_presence_of(:invoice_date) }
    it { is_expected.to validate_presence_of(:invoice_number) }
    it { is_expected.to validate_inclusion_of(:status).in_array(ConsolidatedInvoice::ALL_STATES) }
  end

  describe "scopes" do
    let(:admin) { create(:company_administrator) }
    let(:company) { admin.company }

    let(:contractors) { create_list(:user, 3, :contractor) }

    # 3 unique contractors
    let(:sep_invoices) do
      [
        create(:invoice, company:, user: contractors[0]),
        create(:invoice, company:, user: contractors[0]),
        create(:invoice, company:, user: contractors[1]),
        create(:invoice, company:, user: contractors[2]),
      ]
    end

    # 2 unique contractors
    let(:oct_invoices) do
      [
        create(:invoice, company:, user: contractors[0]),
        create(:invoice, company:, user: contractors[2]),
      ]
    end

    describe ".for_last_month" do
      it "returns consolidated invoices with an invoice date in the last month" do
        travel_to Date.new(2022, 12, 15)
        # before last month
        create(:consolidated_invoice, invoice_date: Date.new(2022, 10, 31))
        last_month = [
          create(:consolidated_invoice, invoice_date: Date.new(2022, 11, 1)),
          create(:consolidated_invoice, invoice_date: Date.new(2022, 11, 30)),
        ]
        # after last month
        create(:consolidated_invoice, invoice_date: Date.new(2022, 12, 1))
        create(:consolidated_invoice, invoice_date: Date.new(2023, 1, 1))

        expect(described_class.for_last_month).to match_array last_month
      end
    end

    describe ".with_total_contractors" do
      let!(:consolidated_invoice_sep) { create(:consolidated_invoice, company: admin.company, invoices: sep_invoices) }
      let!(:consolidated_invoice_oct) { create(:consolidated_invoice, company: admin.company, invoices: oct_invoices) }

      it "includes a count of unique contractors whose invoices are related" do
        records = described_class.all.with_total_contractors

        expect(records.find { |r| r.id == consolidated_invoice_sep.id }.total_contractors_from_query)
          .to eq(3)

        expect(records.find { |r| r.id == consolidated_invoice_oct.id }.total_contractors_from_query)
          .to eq(2)
      end
    end

    describe ".paid" do
      let!(:consolidated_invoice_sep) { create(:consolidated_invoice, :paid, company: admin.company, invoices: sep_invoices) }
      let!(:consolidated_invoice_oct) { create(:consolidated_invoice, company: admin.company, invoices: oct_invoices) }

      it "includes only paid invoices" do
        expect(described_class.paid).to contain_exactly(consolidated_invoice_sep)
      end
    end

    describe ".paid_or_pending_payment" do
      def create_consolidated_invoice(status:)
        create(
          :consolidated_invoice,
          status:,
          company: admin.company,
          invoices: [create(:invoice, company:, user: contractors[0])]
        )
      end

      let!(:sent_consolidated_invoice) { create_consolidated_invoice(status: ConsolidatedInvoice::SENT) }
      let!(:processing_consolidated_invoice) { create_consolidated_invoice(status: ConsolidatedInvoice::PROCESSING) }
      let!(:paid_consolidated_invoice) { create_consolidated_invoice(status: ConsolidatedInvoice::PAID) }
      let!(:refunded_consolidated_invoice) { create_consolidated_invoice(status: ConsolidatedInvoice::REFUNDED) }
      let!(:failed_consolidated_invoice) { create_consolidated_invoice(status: ConsolidatedInvoice::FAILED) }

      it "only includes sent, processing, and paid invoices" do
        expect(described_class.paid_or_pending_payment).to contain_exactly(
          sent_consolidated_invoice,
          processing_consolidated_invoice,
          paid_consolidated_invoice
        )
      end
    end
  end


  describe "#flexile_fee_usd" do
    it "returns the service fee in USD" do
      expect(build(:consolidated_invoice, flexile_fee_cents: 12345).flexile_fee_usd).to eq 123.45
    end
  end

  describe "#trigger_payments" do
    it "calls EnqueueInvoicePayment to pay eligible contractor invoices" do
      invoices = create_list(:invoice, 3)
      consolidated_invoice = create(:consolidated_invoice, invoices:)

      invoices.each do |invoice|
        expect(EnqueueInvoicePayment).to receive(:new)
          .with(invoice:).and_wrap_original do |method, **args|
            service = method.call(**args)
            expect(service).to receive(:perform)
            service
          end
      end

      consolidated_invoice.trigger_payments
    end
  end

  describe "#total_amount_in_usd" do
    subject(:consolidated_invoice) { build(:consolidated_invoice, total_cents: 12_345_678_90) }

    it "converts total amount to USD" do
      expect(consolidated_invoice.total_amount_in_usd).to eq(12_345_678.90)
    end
  end

  describe "#total_fees_in_usd" do
    subject(:consolidated_invoice) { build(:consolidated_invoice, flexile_fee_cents: 1555, transfer_fee_cents: 450) }

    it "converts total fees to USD" do
      expect(consolidated_invoice.total_fees_in_usd).to eq(20.05)
    end
  end

  describe "#total_contractors" do
    let(:admin) { create(:company_administrator) }
    let(:company) { admin.company }

    let(:contractors) { create_list(:user, 2, :contractor) }
    let(:sep_invoices) do
      [
        create(:invoice, company:, user: contractors[0]),
        create(:invoice, company:, user: contractors[1])
      ]
    end
    let!(:consolidated_invoice_sep) { create(:consolidated_invoice, company: admin.company, invoices: sep_invoices) }

    before do
      allow(consolidated_invoice).to receive(:invoices).and_call_original
    end

    context "when record is loaded using `.with_total_contractors` scope" do
      subject(:consolidated_invoice) { described_class.all.with_total_contractors.first }

      it "returns the total contractors value computed in the query (i.e. without querying via invoices)" do
        expect(consolidated_invoice.total_contractors).to eq(2)
        expect(consolidated_invoice).to_not have_received(:invoices)
      end
    end

    context "when the record is loaded without using the `.with_total_contractors` scope" do
      let(:consolidated_invoice) { consolidated_invoice_sep }

      it "still computes the total number of contractors by querying via invoices" do
        expect(consolidated_invoice.total_contractors).to eq(2)
        expect(consolidated_invoice).to have_received(:invoices)
      end
    end
  end

  describe "#receipt" do
    it "can be attached" do
      expect(create(:consolidated_invoice, :paid).receipt.attached?).to eq(true)
    end
  end


  describe "#mark_as_paid!", :freeze_time do
    let(:consolidated_invoice) { create(:consolidated_invoice) }

    it "updates the status to paid, sets the paid_at timestamp, and ignores extra args" do
      timestamp = Time.current
      consolidated_invoice.mark_as_paid!(timestamp: timestamp, random: 1, arguments: [2, 3])

      expect(consolidated_invoice.status).to eq(described_class::PAID)
      expect(consolidated_invoice.paid_at).to eq(timestamp)
    end
  end

  describe "#contractor_payments_expected_by" do
    let(:consolidated_invoice) { create(:consolidated_invoice) }

    before do
      allow_any_instance_of(Company).to receive(:contractor_payment_processing_time_in_days).and_return(7)
      travel_to(date)
    end

    context "when the expected date falls on a weekday" do
      let(:date) { Date.parse("June 10, 2024") } # a Monday

      it "returns the expected date" do
        expect(consolidated_invoice.contractor_payments_expected_by).to eq Date.parse("June 17, 2024")
      end
    end

    context "when the expected date falls on a weekend" do
      let(:date) { Date.parse("June 1, 2024") } # a Saturday

      it "returns the next weekday" do
        expect(consolidated_invoice.contractor_payments_expected_by).to eq Date.parse("June 10, 2024") # + 7 days is a Saturday; the 10th is a Monday
      end
    end
  end

  describe "#successful_payment" do
    let(:consolidated_payments) do
      [
        create(:consolidated_payment, status: Payments::Status::CANCELLED),
        create(:consolidated_payment, status: Payments::Status::SUCCEEDED, succeeded_at: Time.current),
        create(:consolidated_payment, status: Payments::Status::SUCCEEDED, succeeded_at: Time.current - 1.day)
      ]
    end
    let(:consolidated_invoice) { create(:consolidated_invoice, consolidated_payments:) }

    it "returns the latest successful payment" do
      expect(consolidated_invoice.successful_payment).to eq consolidated_payments[1]
    end
  end
end
