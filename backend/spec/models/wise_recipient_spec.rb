# frozen_string_literal: true

RSpec.describe WiseRecipient do
  describe "associations" do
    it { is_expected.to belong_to(:user) }
    it { is_expected.to belong_to(:wise_credential) }
  end

  describe "validations" do
    it { is_expected.to validate_presence_of(:user_id) }
    it { is_expected.to validate_presence_of(:country_code) }
    it { is_expected.to validate_presence_of(:currency) }
    it { is_expected.to validate_presence_of(:recipient_id) }
    it { is_expected.to validate_presence_of(:wise_credential) }

    shared_examples_for "uniqueness of used_for_*" do |used_for|
      describe "uniqueness of #{used_for}" do
        let(:user) { create(:user, without_bank_account: true) }

        it "is enforced for the same user" do
          # Two separate users, no errors are raised
          create(:wise_recipient, user:, used_for => true)
          create(:wise_recipient, user: create(:user, without_bank_account: true), used_for => true)

          record = build(:wise_recipient, user:, used_for => true)
          expect(record).not_to be_valid
          expect(record.errors[used_for]).to include("has already been taken")
        end

        it "allows multiple records for the same user with used_for false" do
          create(:wise_recipient, user:, used_for => false)

          record = build(:wise_recipient, user:, used_for => false)
          expect(record).to be_valid
        end

        it "is ignored when a record is deleted" do
          create(:wise_recipient, user:, used_for => true, deleted_at: Time.current)
          record = build(:wise_recipient, user:, used_for => true)
          expect(record).to be_valid
        end
      end
    end

    include_examples "uniqueness of used_for_*", :used_for_invoices
    include_examples "uniqueness of used_for_*", :used_for_dividends
  end

  # Updated to use Wise API mocks instead of VCR cassettes. The :wise_mock
  # tag activates the WiseMocks helpers defined in spec/support/wise_mocks.rb,
  # stubbing all external HTTP calls to the Wise sandbox. This makes the test
  # run faster and removes the need for real API credentials or prerecorded
  # responses.
  context "#details", :wise_mock do
    it "returns details of Wise API recipient using mocked Wise API" do
      recipient = create(:wise_recipient)

      expect(recipient.details).to eq({
        "BIC" => nil,
        "IBAN" => nil,
        "abartn" => nil,
        "accountHolderName" => "Test Recipient",
        "accountNumber" => "1234567890",
        "accountType" => "CHECKING",
        :"address.city" => "New York",
        :"address.country" => "US",
        :"address.countryCode" => "US",
        :"address.firstLine" => "456 Test Ave",
        :"address.postCode" => "54321",
        :"address.state" => "NY",
        "bankCode" => nil,
        "bankName" => nil,
        "bankgiroNumber" => nil,
        "bban" => nil,
        "bic" => nil,
        "billerCode" => nil,
        "branchCode" => nil,
        "branchName" => nil,
        "bsbCode" => nil,
        "businessNumber" => nil,
        "cardToken" => nil,
        "city" => nil,
        "clabe" => nil,
        "clearingNumber" => nil,
        "cnpj" => nil,
        "cpf" => nil,
        "customerReferenceNumber" => nil,
        "dateOfBirth" => nil,
        "email" => "sharang@example.com",
        "iban" => nil,
        "idCountryIso3" => nil,
        "idDocumentNumber" => nil,
        "idDocumentType" => nil,
        "idNumber" => nil,
        "idType" => nil,
        "idValidFrom" => nil,
        "idValidTo" => nil,
        "ifscCode" => nil,
        "institutionNumber" => nil,
        "interacAccount" => nil,
        "job" => nil,
        "language" => nil,
        "legalType" => "PRIVATE",
        "nationality" => nil,
        "orderId" => nil,
        "payinReference" => nil,
        "phoneNumber" => nil,
        "postCode" => nil,
        "prefix" => nil,
        "province" => nil,
        "pspReference" => nil,
        "routingNumber" => "021000021",
        "russiaRegion" => nil,
        "rut" => nil,
        "sortCode" => "111222",
        "swiftCode" => nil,
        "targetProfile" => nil,
        "targetUserId" => nil,
        "taxId" => nil,
        "token" => nil,
        "town" => nil,
        "transitNumber" => nil,
      })
    end
  end

  describe "#assign_default_used_for_invoices_and_dividends" do
    let(:user) { create(:user, without_bank_account: true) }

    it "sets used_for_invoices and used_for_dividends to true if the user has no other live bank_accounts" do
      recipient = create(:wise_recipient, user:)
      expect(recipient.used_for_invoices).to eq(true)
      expect(recipient.used_for_dividends).to eq(true)

      recipient_2 = create(:wise_recipient, user:)
      expect(recipient_2.used_for_invoices).to eq(false)
      expect(recipient_2.used_for_dividends).to eq(false)
    end

    it "does not set used_for_invoices and used_for_dividends to true if the user has other live bank_accounts" do
      recipient = create(:wise_recipient, user:)
      recipient.mark_deleted!

      recipient_2 = create(:wise_recipient, user:)
      expect(recipient_2.used_for_invoices).to eq(true)
      expect(recipient_2.used_for_dividends).to eq(true)
    end
  end
end
