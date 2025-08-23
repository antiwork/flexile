# frozen_string_literal: true

require "active_storage/service/disk_service"

class ActiveStorage::Service::DiskWithHostService < ActiveStorage::Service::DiskService
  # Required to make `ActiveStorage::Blob#url` work in the test environment
  # See discussion @ https://github.com/rails/rails/issues/40855 for details
  def url_options
    # Use the API domain so generated ActiveStorage URLs point to Rails server in dev
    { protocol: PROTOCOL, host: API_DOMAIN }
  end
end
