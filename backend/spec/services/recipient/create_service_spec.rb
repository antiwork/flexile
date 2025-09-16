# frozen_string_literal: true

RSpec.describe Recipient::CreateService, :vcr do
  describe "#process" do
    subject(:response) do
      described_class.new(
        user:,
        params:,
      ).process
    end

    let(:company) { create(:company) }
    let(:user) { create(:user, without_bank_account: true) }
    let(:recipient) { user.bank_accounts.alive.last }

    let(:params) do
      {
        currency: "USD",
        type: "aba",
        details: {
          legalType: "PRIVATE",
          abartn: "026009593",
          accountHolderName: "Da Rod",
          accountNumber: "12345678",
          accountType: "CHECKING",
          address: {
            country: "US",
            city: "Haleiwa",
            firstLine: "59-720 Kamehameha Hwy",
            state: "HI",
            postCode: "96712",
          },
        },
      }
    end

    before { create(:wise_credential) }

    context "when valid USD data is passed for new recipient" do
      it "creates a USD wise recipient" do
        expect(response).to eq({ success: true, bank_account: recipient.edit_props })
        expect(user.bank_accounts.count).to eq 1
        expect(recipient.recipient_id).to be_present
        expect(recipient.currency).to eq "USD"
        expect(recipient.last_four_digits).to eq "5678"
        expect(recipient.account_holder_name).to eq "Da Rod"
        expect(recipient.wise_credential).to eq WiseCredential.flexile_credential
      end

      context "when saving the DB record fails" do
        it "returns recipient saving error" do
          # Simulate failure to create a record
          allow_any_instance_of(WiseRecipient).to receive(:save).and_return(false)

          expect(response).to eq({ success: false, form_errors: [], error: "error saving recipient" })
        end
      end
    end

    context "when valid AED data is passed" do
      let(:params) do
        {
          currency: "AED",
          type: "emirates",
          details: {
            legalType: "PRIVATE",
            email: "aeduser@gmail.com",
            accountHolderName: "Da Rod",
            IBAN: "AE070331234567890123456",
            address: {
              city: "Dubai",
              firstLine: "West street",
              postCode: "111111",
              country: "AE",
            },
          },
        }
      end

      it "creates a AED wise recipient" do
        expect(response).to eq({ success: true, bank_account: recipient.edit_props })
        expect(user.bank_accounts.count).to eq 1
        expect(recipient.recipient_id).to be_present
        expect(recipient.currency).to eq "AED"
        expect(recipient.last_four_digits).to eq "3456"
      end
    end

    context "when valid MXN data is passed" do
      let(:params) do
        {
          currency: "MXN",
          type: "mexican",
          details: {
            legalType: "PRIVATE",
            email: "mxnuser@example.com",
            accountHolderName: "Da Rod",
            clabe: "032180000118359719",
            address: {
              city: "San Andres",
              firstLine: "4 Oriente 820",
              postCode: "72810",
              country: "MX",
            },
          },
        }
      end

      it "creates a MXN wise recipient" do
        expect(response).to eq({ success: true, bank_account: recipient.edit_props })
        expect(user.bank_accounts.count).to eq 1
        expect(recipient.recipient_id).to be_present
        expect(recipient.currency).to eq "MXN"
        expect(recipient.last_four_digits).to eq "9719"
      end
    end

    context "when invalid data is passed" do
      let(:params) do
        {
          currency: "USD",
          type: "aba",
          details: {
            legalType: "PRIVATE",
            abartn: "026009593",
            accountHolderName: "Da R",
            accountNumber: "12345678",
            accountType: "CHECKING",
            address: {
              country: "US",
              city: "Haleiwa",
              firstLine: "59-720 Kamehameha Hwy",
              state: "HI",
              postCode: "96712",
            },
          },
        }
      end

      it "returns form errors when the response code is 422" do
        expect(response).to eq({ success: false, form_errors: [{ "arguments" => ["accountHolderName", "Da R"], "code" => "NOT_VALID", "message" => "Please enter the recipients first and last name.", "path" => "accountHolderName" }], error: nil })
      end
    end

    context "when the API response is an error but not 422" do
      it "returns a generic error" do
        WebMock
          .stub_request(:post, "#{WISE_API_URL}/v1/accounts")
          .to_return({ status: 500 })

        expect(response).to eq({ success: false, form_errors: [], error: "Wise API error" })
      end
    end

    context "when valid USD data is passed for existing recipient" do
      let!(:existing_recipient) do
        create(:wise_recipient, user:, recipient_id: "148624327", country_code: "AE", last_four_digits: "3456", currency: "AED")
      end

      let(:params) do
        {
          currency: "USD",
          type: "aba",
          details: {
            legalType: "PRIVATE",
            abartn: "026009593",
            accountHolderName: "Da Rod",
            accountNumber: "12345678",
            accountType: "CHECKING",
            address: {
              country: "US",
              city: "Haleiwa",
              firstLine: "59-720 Kamehameha Hwy",
              state: "HI",
              postCode: "96712",
            },
          },
        }
      end

      it "creates a new USD wise recipient" do
        expect_any_instance_of(Wise::PayoutApi).not_to receive(:delete_recipient_account)
        expect(response).to eq({ success: true, bank_account: recipient.edit_props })
        expect(user.bank_accounts.alive.count).to eq 2
        expect(recipient.id).not_to eq existing_recipient.id
        expect(recipient.recipient_id).to eq existing_recipient.recipient_id
        expect(recipient.currency).to eq "USD"
        expect(recipient.country_code).to eq "US"
        expect(recipient.last_four_digits).to eq "5678"
      end

      context "when replacing an existing recipient" do
        it "creates a new USD wise recipient and deletes designated recipient" do
          expect_any_instance_of(Wise::PayoutApi).to receive(:delete_recipient_account).and_call_original
          response = described_class.new(
            user:,
            params:,
            replace_recipient_id: existing_recipient.id,
          ).process

          expect(response).to eq({ success: true, bank_account: recipient.edit_props })
          expect(user.bank_accounts.alive.count).to eq 1
          expect(recipient.id).not_to eq existing_recipient.id
          expect(recipient.recipient_id).not_to eq existing_recipient.recipient_id
          expect(recipient.currency).to eq "USD"
          expect(recipient.country_code).to eq "US"
          expect(recipient.last_four_digits).to eq "5678"
        end
      end

      context "when saving the DB record fails" do
        it "returns recipient saving error" do
          # Simulate failure to create a record
          allow_any_instance_of(WiseRecipient).to receive(:save).and_return(false)

          expect(response).to eq({ success: false, form_errors: [], error: "error saving recipient" })
        end
      end
    end
  end
end
