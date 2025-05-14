# frozen_string_literal: true

RSpec.describe Quickbooks::EventHandler do
  let(:company) { create(:company) }
  let(:company_worker) { create(:company_worker, company:) }
  let(:integration) { create(:quickbooks_integration, company:) }
  let(:invoice) { create(:invoice, company:, user: company_worker.user) }
  let(:payment) { create(:payment, invoice:) }
  let(:consolidated_invoice) { create(:consolidated_invoice, company:, invoices: [invoice]) }
  let(:consolidated_payment) { create(:consolidated_payment, consolidated_invoice:) }

  describe "#process" do
    let(:event) do
      {
        "name" => entity_name,
        "id" => entity_id,
        "operation" => operation,
        "lastUpdated" => "2022-10-05T14:42:19-0700",
      }
    end
    let(:payload) do
      {
        "eventNotifications" => [
          {
            "realmId" => account_id,
            "dataChangeEvent" =>
              { "entities" => [event] },
          }
        ],
      }
    end
    subject(:process_quickbooks_event) { described_class.new(payload).process }

    context "when account ID does not correspond to an existing integration" do
      let(:account_id) { "12345" }
      let(:entity_name) { "Vendor" }
      let(:entity_id) { "85" }
      let(:operation) { "Update" }

      it "does not process the event" do
        process_quickbooks_event
      end
    end

    context "when account ID corresponds to an existing integration" do
      let(:account_id) { integration.account_id }

      context "when integration is deleted" do
        let(:integration) { create(:quickbooks_integration, :deleted, company:) }
        let(:entity_name) { "Vendor" }
        let(:entity_id) { "85" }
        let(:operation) { "Update" }

        it "does not process the event" do
          process_quickbooks_event
        end

        context "when contractor integration record exists" do
          let!(:integration_record) { create(:integration_record, integratable: company_worker, integration:, integration_external_id: entity_id) }

          it "does not change the integration record" do
            expect do
              process_quickbooks_event
            end.to_not change { integration_record.reload.deleted? }
          end
        end
      end

      context "when entity is not supported" do
        let(:entity_name) { "JournalEntry" }
        let(:entity_id) { "1" }
        let(:operation) { "Update" }

        it "does not process the event" do
          process_quickbooks_event
        end
      end

      context "when entity is a Vendor" do
        let(:entity_name) { "Vendor" }
        let(:entity_id) { "85" }

        context "when operation is Update" do
          let(:operation) { "Update" }

          it "does not process the event" do
            process_quickbooks_event
          end

          context "when contractor integration record exists", :vcr do
            let!(:integration_record) { create(:integration_record, integratable: company_worker, integration:, integration_external_id: entity_id) }

            it "does not change the integration record" do
              expect do
                process_quickbooks_event
              end.to_not change { integration_record.reload.deleted? }
            end
          end
        end

        context "when operation is Merge" do
          let(:operation) { "Merge" }
          let(:event) do
            {
              "name" => entity_name,
              "id" => "86",
              "deletedID" => entity_id,
              "operation" => operation,
              "lastUpdated" => "2022-10-05T14:42:19-0700",
            }
          end

          it "does not update the contractor's integration record does not exist" do
            expect_any_instance_of(IntegrationRecord).to_not receive(:update!)
            process_quickbooks_event
          end

          it "does not update the contractor's integration record when another contractor has the new external ID" do
            create(:integration_record, integratable: company_worker, integration:, integration_external_id: "85")
            create(:integration_record, integratable: create(:company_worker, company:), integration:, integration_external_id: "86")

            expect_any_instance_of(IntegrationRecord).to_not receive(:update!)
            process_quickbooks_event
          end

          context "when contractor integration record exists" do
            let(:integration_record) { create(:integration_record, integratable: company_worker, integration:, integration_external_id: "85") }

            it "updates the external ID to the new ID" do
              expect do
                process_quickbooks_event
              end.to change { integration_record.reload.integration_external_id }.from("85").to("86")
            end

            context "when the integration record has the old class name CompanyContractor" do
              before do
                integration_record.update!(integratable_type: "CompanyContractor")
              end

              it "updates the external ID to the new ID" do
                expect do
                  process_quickbooks_event
                end.to change { integration_record.reload.integration_external_id }.from("85").to("86")
              end
            end
          end
        end

        context "when operation is Delete" do
          let(:operation) { "Delete" }

          it "does nothing if integration record does not exist" do
            expect_any_instance_of(IntegrationRecord).to_not receive(:mark_deleted!)
            process_quickbooks_event
          end

          context "when contractor integration record exists" do
            let(:integration_record) { create(:integration_record, integratable: company_worker, integration:, integration_external_id: "85") }

            it "marks the integration record as deleted when contractor integration record exists" do
              expect do
                process_quickbooks_event
              end.to change { integration_record.reload.deleted? }.from(false).to(true)
            end

            context "when the integration record has the old class name CompanyContractor" do
              before do
                integration_record.update!(integratable_type: "CompanyContractor")
              end

              it "marks the integration record as deleted when contractor integration record exists" do
                expect do
                  process_quickbooks_event
                end.to change { integration_record.reload.deleted? }.from(false).to(true)
              end
            end
          end
        end

        context "when entity is a Bill" do
          let(:entity_name) { "Bill" }
          let(:entity_id) { "1" }

          context "when operation is Update" do
            let(:operation) { "Update" }

            it "does not process the event" do
              process_quickbooks_event
            end
          end

          context "when operation is Delete" do
            let(:operation) { "Delete" }

            context "when Bill belongs to an invoice" do
              let(:invoice_expense) { create(:invoice_expense, invoice:) }
              let!(:invoice_integration_record) { create(:integration_record, integratable: invoice, integration:, integration_external_id: "1") }
              let!(:line_item_integration_record) { create(:integration_record, integratable: invoice.invoice_line_items.first, integration:, integration_external_id: "1") }
              let!(:expense_integration_record) { create(:integration_record, integratable: invoice_expense, integration:, integration_external_id: "1") }

              it "marks the invoice's and its line items integration records as deleted" do
                expect do
                  process_quickbooks_event
                end.to change { invoice_integration_record.reload.deleted? }.from(false).to(true)
                 .and change { line_item_integration_record.reload.deleted? }.from(false).to(true)
                 .and change { expense_integration_record.reload.deleted? }.from(false).to(true)
              end
            end

            context "when Bill belongs to a consolidated invoice" do
              let!(:integration_record) { create(:integration_record, integratable: consolidated_invoice, integration:, integration_external_id: "1") }

              it "marks the integration record as deleted" do
                expect do
                  process_quickbooks_event
                end.to change { integration_record.reload.deleted? }.from(false).to(true)
              end
            end

            context "when integration record does not exist for the Bill" do
              it "does not delete any integration records" do
                expect_any_instance_of(IntegrationRecord).to_not receive(:mark_deleted!)
                process_quickbooks_event
              end
            end
          end
        end

        context "when entity is a BillPayment" do
          let(:entity_name) { "BillPayment" }
          let(:entity_id) { "1" }

          context "when operation is Update" do
            let(:operation) { "Update" }

            it "does not process the event" do
              process_quickbooks_event
            end
          end

          context "when operation is Delete" do
            let(:operation) { "Delete" }

            context "when BillPayment belongs to a payment" do
              let!(:integration_record) { create(:integration_record, integratable: payment, integration:, integration_external_id: "1") }

              it "marks the integration record as deleted" do
                expect do
                  process_quickbooks_event
                end.to change { integration_record.reload.deleted? }.from(false).to(true)
              end
            end

            context "when BillPayment belongs to a consolidated payment" do
              let!(:integration_record) { create(:integration_record, integratable: consolidated_payment, integration:, integration_external_id: "1") }

              it "marks the integration record as deleted" do
                expect do
                  process_quickbooks_event
                end.to change { integration_record.reload.deleted? }.from(false).to(true)
              end
            end

            context "when integration record does not exist for the BillPayment" do
              it "does not delete any integration records" do
                expect_any_instance_of(IntegrationRecord).to_not receive(:mark_deleted!)
                process_quickbooks_event
              end
            end
          end
        end
      end
    end
  end
end
