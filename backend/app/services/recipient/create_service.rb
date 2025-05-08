# frozen_string_literal: true

class Recipient::CreateService
  attr_reader :user, :params, :replace_recipient_id

  def initialize(user:, params:, replace_recipient_id: nil)
    @user = user
    @params = params
    @replace_recipient_id = replace_recipient_id
  end

  def process
    recipient_response = payout_service.create_recipient_account(params)
    if recipient_response.ok?
      recipient_attributes = parse_recipient_from_response(recipient_response).merge(wise_credential: WiseCredential.flexile_credential)
      recipient_record = user.bank_accounts.build(recipient_attributes)

      if recipient_record.save
        if replace_recipient_id
          replaced_recipient = user.bank_accounts.alive.find_by(id: replace_recipient_id)
          if replaced_recipient
            payout_service.delete_recipient_account(recipient_id: replaced_recipient.recipient_id)
            replaced_recipient.mark_deleted!
          end
        end
        recipient_record.reload
        { success: true, bank_account: recipient_record.edit_props }
      else
        { success: false, form_errors: [], error: "error saving recipient" }
      end
    elsif recipient_response.code == 422
      { success: false, form_errors: recipient_response["errors"], error: nil }
    else
      { success: false, form_errors: [], error: "Wise API error" }
    end
  end

  private
    def parse_recipient_from_response(response)
      account_details = response["details"]
      account_number = account_details["accountNumber"] || account_details["iban"] || account_details["clabe"]

      {
        bank_name: account_details["bankName"],
        country_code: response["country"],
        currency: response["currency"],
        last_four_digits: account_number.last(4),
        recipient_id: response["id"],
        account_holder_name: response["accountHolderName"],
      }
    end

    def payout_service
      @_payout_service ||= Wise::PayoutApi.new
    end
end
