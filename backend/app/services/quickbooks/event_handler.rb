# frozen_string_literal: true

class Quickbooks::EventHandler
  def initialize(payload)
    @payload = payload
  end

  def process
    payload["eventNotifications"].each do |event_notification|
      events = event_notification.dig("dataChangeEvent", "entities")
      return unless events.present?

      integration = QuickbooksIntegration.alive.find_by(account_id: event_notification["realmId"])
      return unless integration.present?

      events.each do |event|
        case event["operation"]
        when "Merge"
          process_merge_event(integration:, event:)
        when "Delete"
          process_delete_event(integration:, event:)
        end
      end
    end
  end

  private
    attr_reader :payload



    def process_merge_event(integration:, event:)
      return unless event["name"] == "Vendor" # Only interested in QBO Vendor merges

      new_vendor_id = event["id"]
      old_vendor_id = event["deletedID"]
      integration_record = integration.integration_records.where(integratable_type: [CompanyWorker.name, "CompanyContractor"], integration_external_id: old_vendor_id).first

      if integration_record.present? &&
        integration.integration_records.where(integratable_type: [CompanyWorker.name, "CompanyContractor"], integration_external_id: new_vendor_id).none?
        integration_record.update!(integration_external_id: new_vendor_id)
      end
    end

    def process_delete_event(integration:, event:)
      case event["name"]
      when "Vendor"
        integration.integration_records.alive.where(integratable_type: [CompanyWorker.name, "CompanyContractor"], integration_external_id: event["id"]).each(&:mark_deleted!)
      when "Bill"
        delete_invoice_integration_records(integration:, event:)
      when "BillPayment"
        integration.integration_records.alive.where(integratable_type: [ConsolidatedPayment.name, Payment.name], integration_external_id: event["id"]).each(&:mark_deleted!)
      end
    end

    def delete_invoice_integration_records(integration:, event:)
      integration_record = integration.integration_records
                                      .alive
                                      .find_by(integratable_type: [ConsolidatedInvoice.name, Invoice.name], integration_external_id: event["id"])

      return unless integration_record.present?

      integratable = integration_record.integratable
      # Delete the invoice line items and expenses integration records
      if integratable.class.name == Invoice.name
        integration.integration_records
                   .alive
                   .where(integratable_type: "InvoiceLineItem", integratable_id: integratable.invoice_line_item_ids)
                   .each(&:mark_deleted!)
        if integratable.invoice_expenses.exists?
          integration.integration_records
                     .alive
                     .where(integratable_type: "InvoiceExpense", integratable_id: integratable.invoice_expense_ids)
                     .each(&:mark_deleted!)
        end
      end
      integration_record.mark_deleted!
    end
end
