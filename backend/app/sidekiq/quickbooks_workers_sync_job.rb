# frozen_string_literal: true

class QuickbooksWorkersSyncJob
  include Sidekiq::Job
  sidekiq_options retry: 5

  def perform(company_id, active_worker_ids)
    company = Company.find(company_id)
    integration = company.quickbooks_integration

    return if integration.nil? || integration.status != "active"

    qbo_service = IntegrationApi::Quickbooks.new(company_id: company_id)
    all_vendors = qbo_service.send(:fetch_quickbooks_vendors)

    active_worker_ids.each do |worker_id|
      sync_worker_to_vendor(worker_id, integration, qbo_service, all_vendors)
    end

    integration.update!(last_sync_at: Time.current)
  end

  private



  def sync_worker_to_vendor(worker_id, integration, qbo_service, all_vendors)
    worker = CompanyWorker.find(worker_id)
    return unless worker

    compliance_info = worker.user.compliance_info
    display_name = if compliance_info&.business_entity?
      compliance_info.business_name
    else
      compliance_info&.legal_name || worker.user.legal_name
    end

    return if display_name.blank?

    # Check if vendor already exists
    existing_vendor = all_vendors.find do |vendor|
      vendor.dig("PrimaryEmailAddr", "Address") == worker.user.email &&
      vendor["DisplayName"] == display_name
    end

    if existing_vendor
      upsert_integration_record(
        integration: integration,
        worker: worker,
        integration_external_id: existing_vendor["Id"],
        sync_token: existing_vendor["SyncToken"]
      )
    else
      create_new_vendor(worker, integration, qbo_service, display_name)
    end
  end

  def create_new_vendor(worker, integration, qbo_service, display_name)
    billing_address = build_billing_address(worker.user)

    vendor_payload = {
      DisplayName: display_name,
      GivenName: worker.user.legal_name || "",
      PrimaryEmailAddr: {
        Address: worker.user.email
      },
      **billing_address,
      Vendor1099: false,
      Active: true
    }

    vendor_payload[:BillRate] = worker.pay_rate_in_subunits / 100.0 if worker.pay_rate_in_subunits

    response = qbo_service.make_authenticated_request do
      url = qbo_service.send(:base_api_url) + "/vendor?minorversion=75"
      qbo_service.make_api_request(
        method: "POST",
        url: url,
        body: vendor_payload.to_json,
        headers: qbo_service.send(:api_request_header)
      )
    end

    if response&.ok?
      vendor_data = response.parsed_response["Vendor"]
      upsert_integration_record(
        integration: integration,
        worker: worker,
        integration_external_id: vendor_data["Id"],
        sync_token: vendor_data["SyncToken"]
      )
    end
  end

  def build_billing_address(user)
    return {} unless user.street_address && user.city && user.state &&
                    user.zip_code && user.country_code

    {
      BillAddr: {
        Line1: user.street_address,
        City: user.city,
        CountrySubDivisionCode: user.state,
        PostalCode: user.zip_code,
        Country: user.country_code
      }
    }
  end

  def upsert_integration_record(integration:, worker:, integration_external_id:, sync_token:)
    existing_record = IntegrationRecord.where(
      integration: integration,
      integratable_type: ["CompanyWorker", "CompanyContractor"],
      integratable_id: worker.id,
      deleted_at: nil
    ).first

    if existing_record
      existing_record.update!(
        integration_external_id: integration_external_id,
        sync_token: sync_token
      )
    else
      IntegrationRecord.create!(
        integration: integration,
        integratable: worker,
        integration_external_id: integration_external_id,
        sync_token: sync_token
      )
    end
  end
end
