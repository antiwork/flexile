# frozen_string_literal: true

class TaxFormPresenter
  delegate :id, :name, :created_at, :submitted_at, :status, :attachment, :user_compliance_info,
           private: true, to: :tax_form
  delegate :user, private: true, to: :user_compliance_info

  def initialize(tax_form:, is_company_administrator:)
    @tax_form = tax_form
    @is_company_administrator = is_company_administrator
  end

  def props
    result = {
      id:,
      name:,
      created_at: created_at.iso8601,
      submitted_at: submitted_at&.iso8601,
      status:,
      download_url: Rails.application.routes.url_helpers.rails_blob_path(attachment, disposition: "attachment"),
    }

    if is_company_administrator
      result[:user_name] = user.name
    end

    result
  end

  private
    attr_reader :tax_form, :is_company_administrator
end
