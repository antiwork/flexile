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

  context "#details", :vcr do
    it "returns details of Wise API recipient" do
      recipient = create(:wise_recipient)

      expect(recipient.details).to eq({
        "BIC" => nil,
        "IBAN" => nil,
        "abartn" => "026009593",
        "accountHolderName" => "John Banker",
        "accountNumber" => "87654321",
        "accountType" => "SAVINGS",
        :"address.city" => "Tallahassee",
        :"address.country" => "US",
        :"address.countryCode" => "US",
        :"address.firstLine" => "1234 Orange Street",
        :"address.postCode" => "32308",
        :"address.state" => "HI",
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
        "routingNumber" => nil,
        "russiaRegion" => nil,
        "rut" => nil,
        "sortCode" => nil,
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
