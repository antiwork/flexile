# frozen_string_literal: true

class Github::EventHandler
  def initialize(webhook_id, payload)
    @webhook_id = webhook_id
    @payload = payload
  end

  def process
    key = payload.key?("issue") ? "issue" : "pull_request"
    integration_records = GithubIntegrationRecord.alive.where(integration_external_id: payload.dig(key, "node_id").to_s)
    return unless integration_records.exists?

    integration_records.each do |integration_record|
      ApplicationRecord.transaction do
        case payload["action"]
        when "reopened"
          handle_reopened_event(integration_record)
        when "closed"
          if integration_record.resource_name == "pulls"
            handle_pull_request_closed_event(integration_record, key)
          else
            handle_issue_closed_event(integration_record)
          end
        when "edited"
          handle_edited_event(integration_record, key)
        end
      end
    end
  end

  private
    attr_reader :webhook_id, :payload

    def handle_reopened_event(integration_record)
      integration_record.integratable.update_as_not_completed!
      integration_record.status = "open"
      integration_record.save!
    end

    def handle_pull_request_closed_event(integration_record, key)
      if payload.dig(key, "merged")
        integration_record.integratable.update_as_completed!
        integration_record.status = "merged"
      else
        integration_record.status = "closed"
      end
      integration_record.save!
    end

    def handle_issue_closed_event(integration_record)
      integration_record.integratable.update_as_completed!
      integration_record.status = "closed"
      integration_record.save!
    end

    def handle_edited_event(integration_record, key)
      title = payload.dig(key, "title")
      if title != integration_record.description
        integration_record.description = title
        integration_record.save!
      end
    end
end
