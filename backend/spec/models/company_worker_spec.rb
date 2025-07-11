# frozen_string_literal: true

RSpec.describe CompanyWorker do
  describe "associations" do
    it { is_expected.to belong_to(:company) }
    it { is_expected.to belong_to(:user) }
    it { is_expected.to have_many(:contracts) }
    it { is_expected.to have_many(:integration_records) }
    it { is_expected.to have_many(:invoices) }
    it { is_expected.to have_one(:quickbooks_integration_record) }
  end

  describe "validations" do
    before { create(:company_worker) }

    it { is_expected.to validate_uniqueness_of(:user_id).scoped_to(:company_id) }
    it { is_expected.to validate_presence_of(:started_at) }
    it do
      is_expected.to(validate_numericality_of(:pay_rate_in_subunits)
                       .is_greater_than(0)
                       .only_integer
                       .allow_nil)
    end
    it { is_expected.to validate_inclusion_of(:pay_rate_type).in_array(described_class.pay_rate_types.values) }
    it do
      is_expected.to(validate_numericality_of(:equity_percentage)
                       .is_greater_than_or_equal_to(0)
                       .is_less_than_or_equal_to(CompanyWorker::MAX_EQUITY_PERCENTAGE)
                       .only_integer
                       .allow_nil)
    end
  end

  describe "scopes" do
    describe ".active" do
      it "returns only active workers" do
        active_worker = create(:company_worker)
        inactive_worker = create(:company_worker, :inactive)

        expect(described_class.active).to include(active_worker)
        expect(described_class.active).not_to include(inactive_worker)
      end
    end

    describe ".active_as_of" do
      it "returns workers active at the given date" do
        date = Date.current
        worker_started_before = create(:company_worker, started_at: date - 1.day)
        worker_started_after = create(:company_worker, started_at: date + 1.day)
        worker_ended_before = create(:company_worker, ended_at: date - 1.day)
        worker_ended_after = create(:company_worker, ended_at: date + 1.day)

        result = described_class.active_as_of(date)

        expect(result).to include(worker_started_before)
        expect(result).to include(worker_ended_after)
        expect(result).not_to include(worker_started_after)
        expect(result).not_to include(worker_ended_before)
      end
    end

    describe ".inactive" do
      it "returns only inactive workers" do
        active_worker = create(:company_worker)
        inactive_worker = create(:company_worker, :inactive)

        expect(described_class.inactive).to include(inactive_worker)
        expect(described_class.inactive).not_to include(active_worker)
      end
    end

    describe ".started_on_or_before" do
      it "returns workers started on or before the given date" do
        date = Date.current
        worker_started_before = create(:company_worker, started_at: date - 1.day)
        worker_started_on = create(:company_worker, started_at: date)
        worker_started_after = create(:company_worker, started_at: date + 1.day)

        result = described_class.started_on_or_before(date)

        expect(result).to include(worker_started_before)
        expect(result).to include(worker_started_on)
        expect(result).not_to include(worker_started_after)
      end
    end

    describe ".starting_after" do
      it "returns workers starting after the given date" do
        date = Date.current
        worker_started_before = create(:company_worker, started_at: date - 1.day)
        worker_started_on = create(:company_worker, started_at: date)
        worker_started_after = create(:company_worker, started_at: date + 1.day)

        result = described_class.starting_after(date)

        expect(result).to include(worker_started_after)
        expect(result).not_to include(worker_started_before)
        expect(result).not_to include(worker_started_on)
      end
    end

    describe ".not_submitted_invoices" do
      let(:company) { create(:company) }
      let(:worker) { create(:company_worker, company: company) }
      let(:billing_period) { Date.current.last_month.beginning_of_month..Date.current }

      context "when worker has no invoices in billing period" do
        it "includes the worker" do
          result = described_class.not_submitted_invoices(billing_period: billing_period)

          expect(result).to include(worker)
        end
      end

      context "when worker has invoices in billing period" do
        before do
          create(:invoice, company_worker: worker, invoice_date: Date.current)
        end

        it "excludes the worker" do
          result = described_class.not_submitted_invoices(billing_period: billing_period)

          expect(result).not_to include(worker)
        end
      end
    end

    describe ".with_signed_contract" do
      let(:company) { create(:company) }
      let(:worker) { create(:company_worker, company: company) }

      context "when worker has signed contract" do
        before do
          create(:document, company: company, signed: true, signatories: [worker.user])
        end

        it "includes the worker" do
          result = described_class.with_signed_contract

          expect(result).to include(worker)
        end
      end

      context "when worker has unsigned contract" do
        before do
          create(:document, company: company, signed: false, signatories: [worker.user])
        end

        it "excludes the worker" do
          result = described_class.with_signed_contract

          expect(result).not_to include(worker)
        end
      end
    end

    describe ".with_required_tax_info_for" do
      let(:company) { create(:company) }
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
      let(:company_worker_8) do
        user = create(:user, :without_compliance_info, country_code: "US")
        create(:user_compliance_info, :confirmed, user:)
        create(:company_worker, :project_based, company:, user:)
      end

      before do
        create(:invoice, company_worker: company_worker_1, total_amount_in_usd_cents: 700_00, cash_amount_in_cents: 700_00, equity_amount_in_cents: 0)
        create(:invoice, company_worker: company_worker_2, total_amount_in_usd_cents: 700_00, cash_amount_in_cents: 700_00, equity_amount_in_cents: 0)
        create(:invoice, company_worker: company_worker_8, total_amount_in_usd_cents: 700_00, cash_amount_in_cents: 700_00, equity_amount_in_cents: 0)
      end

      it "returns workers with required tax info" do
        result = described_class.with_required_tax_info_for(tax_year:)

        expect(result).to include(company_worker_1)
        expect(result).to include(company_worker_8)
        expect(result).not_to include(company_worker_2)
      end
    end
  end

  describe "instance methods" do
    describe "#active?" do
      it "returns true for active workers" do
        worker = create(:company_worker)

        expect(worker.active?).to be true
      end

      it "returns false for inactive workers" do
        worker = create(:company_worker, :inactive)

        expect(worker.active?).to be false
      end
    end

    describe "#alumni?" do
      it "returns true for alumni workers" do
        worker = create(:company_worker, :inactive)

        expect(worker.alumni?).to be true
      end

      it "returns false for active workers" do
        worker = create(:company_worker)

        expect(worker.alumni?).to be false
      end
    end

    describe "#end_contract!" do
      it "sets ended_at to current time" do
        worker = create(:company_worker)

        worker.end_contract!

        expect(worker.ended_at).to be_present
      end

      it "does nothing if already ended" do
        worker = create(:company_worker, :inactive)
        original_ended_at = worker.ended_at

        worker.end_contract!

        expect(worker.ended_at).to eq(original_ended_at)
      end
    end

    describe "#contract_signed?" do
      let(:company) { create(:company) }
      let(:worker) { create(:company_worker, company: company) }

      context "when contract_signed_elsewhere is true" do
        before { worker.update!(contract_signed_elsewhere: true) }

        it "returns true" do
          expect(worker.contract_signed?).to be true
        end
      end

      context "when contract_signed_elsewhere is false" do
        before { worker.update!(contract_signed_elsewhere: false) }

        context "when user has signed contract" do
          before do
            create(:document, company: company, signed: true, signatories: [worker.user])
          end

          it "returns true" do
            expect(worker.contract_signed?).to be true
          end
        end

        context "when user has unsigned contract" do
          before do
            create(:document, company: company, signed: false, signatories: [worker.user])
          end

          it "returns false" do
            expect(worker.contract_signed?).to be false
          end
        end

        context "when user has no contract" do
          it "returns false" do
            expect(worker.contract_signed?).to be false
          end
        end
      end
    end

    describe "#quickbooks_entity" do
      it "returns 'Vendor'" do
        worker = create(:company_worker)

        expect(worker.quickbooks_entity).to eq("Vendor")
      end
    end

    describe "#unique_unvested_equity_grant_for_year" do
      let(:company) { create(:company) }
      let(:worker) { create(:company_worker, company: company) }
      let(:year) { Date.current.year }

      context "when user has no company investors" do
        it "returns nil" do
          expect(worker.unique_unvested_equity_grant_for_year(year)).to be_nil
        end
      end

      context "when user has multiple company investors" do
        before do
          create(:company_investor, user: worker.user, company: company)
          create(:company_investor, user: worker.user, company: create(:company))
        end

        it "returns nil" do
          expect(worker.unique_unvested_equity_grant_for_year(year)).to be_nil
        end
      end

      context "when user has one company investor with no grants" do
        before do
          create(:company_investor, user: worker.user, company: company)
        end

        it "returns nil" do
          expect(worker.unique_unvested_equity_grant_for_year(year)).to be_nil
        end
      end

      context "when user has one company investor with multiple grants" do
        let(:company_investor) { create(:company_investor, user: worker.user, company: company) }

        before do
          create(:equity_grant, company_investor: company_investor, vesting_trigger: "invoice_paid")
          create(:equity_grant, company_investor: company_investor, vesting_trigger: "invoice_paid")
        end

        it "returns nil" do
          expect(worker.unique_unvested_equity_grant_for_year(year)).to be_nil
        end
      end

      context "when user has one company investor with one grant" do
        let(:company_investor) { create(:company_investor, user: worker.user, company: company) }
        let!(:grant) do
          create(:equity_grant, company_investor: company_investor, vesting_trigger: "invoice_paid", unvested_shares: 100)
        end

        it "returns the grant" do
          expect(worker.unique_unvested_equity_grant_for_year(year)).to eq(grant)
        end
      end
    end
  end
end
