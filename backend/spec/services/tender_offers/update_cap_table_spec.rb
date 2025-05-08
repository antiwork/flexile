# frozen_string_literal: true

RSpec.describe TenderOffers::UpdateCapTable do
  let(:company) { create(:company, fully_diluted_shares: 13_000) }
  let!(:option_pool) { create(:option_pool, company:, authorized_shares: 10_000, issued_shares: 1_000) }
  let(:equity_buyback_round) { create(:equity_buyback_round, company:) }
  let(:company_investor_1) { create(:company_investor, company:) }
  let(:company_investor_2) { create(:company_investor, company:) }
  let(:share_class_a) { create(:share_class, company:, name: "Class A") }
  let(:share_class_b) { create(:share_class, company:, name: "Class B") }
  let!(:share_holding_1) do
    share_holding = create(
      :share_holding,
      company_investor: company_investor_1,
      share_class: share_class_a,
      number_of_shares: 1_000
    )
    create(:share_certificate_doc, company:, signatories: [company_investor_1.user])
    share_holding
  end
  let!(:share_holding_2) do
    share_holding = create(
      :share_holding,
      company_investor: company_investor_2,
      share_class: share_class_b,
      number_of_shares: 1_000
    )
    create(:share_certificate_doc, company:, signatories: [company_investor_2.user])
    share_holding
  end
  let!(:equity_grant) do
    create(
      :equity_grant,
      option_pool:,
      company_investor: company_investor_1,
      number_of_shares: 1000,
      vested_shares: 400,
      unvested_shares: 600,
      exercised_shares: 0,
      forfeited_shares: 0
    )
  end

  describe "#perform" do
    subject(:perform) { described_class.new(equity_buyback_round:).perform }

    before do
      Flipper.enable(:share_certificates, company)

      company_investor_1.update!(total_options: 1000)

      create(
        :equity_buyback,
        equity_buyback_round:,
        company_investor: company_investor_1,
        number_of_shares: 500,
        share_class: share_class_a,
        security: share_holding_1
      )
      create(
        :equity_buyback,
        equity_buyback_round:,
        company_investor: company_investor_2,
        number_of_shares: 301,
        share_class: share_class_b,
        security: share_holding_2
      )
      create(
        :equity_buyback,
        equity_buyback_round:,
        company_investor: company_investor_1,
        number_of_shares: 300,
        share_class: TenderOffer::VESTED_SHARES_CLASS,
        security: equity_grant
      )
    end

    context "when there are no errors during processing" do
      it "updates securities, aggregate counts, and share certificates" do
        expect { perform }.to change { company_investor_1.reload.total_shares }.by(-500)
                          .and change { company_investor_2.reload.total_shares }.by(-301)
                          .and change { company_investor_1.reload.total_options }.by(-300)
                          .and change { company.reload.fully_diluted_shares }.by(-801)
                          .and change { option_pool.reload.issued_shares }.by(-300)
                          .and change { company_investor_1.user.documents.share_certificate.count }.by(-1)
                          .and change { company_investor_2.user.documents.share_certificate.count }.by(-1)

        [share_holding_1, share_holding_2, equity_grant].each(&:reload)

        expect(share_holding_1.number_of_shares).to eq(500) # 1k - 500

        expect(share_holding_2.number_of_shares).to eq(699) # 1k - 301

        expect(equity_grant.vested_shares).to eq(100) # 400 - 300
        expect(equity_grant.forfeited_shares).to eq(300) # 0 + 300

        # Old documents are deleted (see change assertion above) and new document generation is queued
        expect(CreateShareCertificatePdfJob).to have_enqueued_sidekiq_job(share_holding_1.id)
        expect(CreateShareCertificatePdfJob).to have_enqueued_sidekiq_job(share_holding_2.id)
      end
    end

    context "when there is an error during processing" do
      before do
        allow_any_instance_of(OptionPool).to receive(:update!).and_raise(ActiveRecord::RecordInvalid)
      end

      it "rolls back changes" do
        expect { perform }.to raise_error(ActiveRecord::RecordInvalid)
                          .and not_change { equity_grant.reload.attributes }
                          .and not_change { share_holding_1.reload.number_of_shares }
                          .and not_change { share_holding_2.reload.number_of_shares }
                          .and not_change { company_investor_1.reload.total_options }
                          .and not_change { company_investor_1.reload.total_shares }
                          .and not_change { company_investor_2.reload.total_shares }
                          .and not_change { company.reload.fully_diluted_shares }
                          .and not_change { option_pool.reload.issued_shares }
                          .and not_change { company_investor_1.user.documents.share_certificate.count }
                          .and not_change { company_investor_2.user.documents.share_certificate.count }
      end
    end

    context "when there is an equity buyback with an unhandled security type" do
      before do
        create(
          :equity_buyback,
          equity_buyback_round:,
          company_investor: company_investor_1,
          number_of_shares: 100,
          share_class: share_class_a,
          security: create(:user) # Unsupported security type
        )
      end

      it "raises an error and rolls back changes" do
        expect { perform }.to raise_error(RuntimeError, "Unsupported security type: User")
                          .and not_change { equity_grant.reload.attributes }
                          .and not_change { share_holding_1.reload.number_of_shares }
                          .and not_change { share_holding_2.reload.number_of_shares }
                          .and not_change { company_investor_1.reload.total_options }
                          .and not_change { company_investor_1.reload.total_shares }
                          .and not_change { company_investor_2.reload.total_shares }
                          .and not_change { company.reload.fully_diluted_shares }
                          .and not_change { option_pool.reload.issued_shares }
                          .and not_change { company_investor_1.user.documents.share_certificate.count }
                          .and not_change { company_investor_2.user.documents.share_certificate.count }
      end
    end
  end
end
