# frozen_string_literal: true

RSpec.describe Wise::HandleDividendPayoutFailure, type: :service do
  describe '.call' do
    subject(:call_service) { described_class.call(dividend_payment, {}) }

    let(:user) { create(:user) }
    let(:company_investor) { create(:company_investor, user: user) }
    let(:dividend) { create(:dividend, company_investor: company_investor, status: 'Paid', paid_at: Time.current) }
    let(:dividend_payment) { create(:dividend_payment, dividends: [dividend]) }

    let!(:bank_account) { user.bank_account_for_dividends }

    it 'marks the user\'s bank account for dividends as deleted' do
      expect { call_service }.to change { bank_account.reload.deleted_at }.from(nil)
    end

    it 'updates the dividend status back to "Issued"' do
      expect { call_service }.to change { dividend.reload.status }.from('Paid').to('Issued')
    end

    it 'clears the paid_at timestamp on the dividend' do
      expect { call_service }.to change { dividend.reload.paid_at }.to(nil)
    end

    it 'enqueues a failure notification email to the user' do
      expect do
        call_service
      end.to have_enqueued_mail(CompanyInvestorMailer, :dividend_payment_failed).with(user, dividend_payment)
    end

    context 'when the user has no associated dividend bank account' do
      let(:user) { create(:user, without_bank_account: true) }

      it 'does not raise an error' do
        expect { call_service }.not_to raise_error
      end
    end
  end
end