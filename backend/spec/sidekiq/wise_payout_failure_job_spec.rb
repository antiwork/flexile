# frozen_string_literal: true

RSpec.describe WisePayoutFailureJob, type: :job do
  describe '#perform' do
    subject(:perform_job) { described_class.new.perform(webhook_params) }

    let!(:dividend_payment) { create(:dividend_payment, transfer_id: '12345') }
    let(:webhook_params) do
      {
        "data" => {
          "resource" => { "id" => dividend_payment.transfer_id },
          "transfer_id" => dividend_payment.transfer_id,
          "type" => "payout-failure",
          "profile_id" => "9876"
        }
      }.with_indifferent_access
    end

    it 'calls the HandleDividendPayoutFailure service with the correct dividend payment' do
      expect(Wise::HandleDividendPayoutFailure).to receive(:call).with(dividend_payment, webhook_params)
      perform_job
    end

    context 'when transfer_id is not present' do
      let(:webhook_params) { { 'data' => {} }.with_indifferent_access }

      it 'does not call the service' do
        expect(Wise::HandleDividendPayoutFailure).not_to receive(:call)
        perform_job
      end
    end

    context 'when no dividend payment matches the transfer_id' do
      let(:webhook_params) do
        {
          'data' => { 'transfer_id' => 'id-that-does-not-exist' }
        }.with_indifferent_access
      end

      it 'does not call the service' do
        expect(Wise::HandleDividendPayoutFailure).not_to receive(:call)
        perform_job
      end
    end
  end
end