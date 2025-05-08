
# frozen_string_literal: true

class CompanyUpdatesPresenter
  include Pagy::Backend, ActionView::Helpers::SanitizeHelper, ActionView::Helpers::TextHelper

  attr_reader :company, :params

  RECORDS_PER_PAGE = 10
  private_constant :RECORDS_PER_PAGE

  def initialize(company:, params:)
    @company = company
    @params = params
  end

  def admin_props
    pagy, company_updates = pagy(company.company_updates.order(created_at: :desc), limit: RECORDS_PER_PAGE)
    company_updates_props = company_updates.map do |update|
      {
        id: update.external_id,
        title: update.title,
        sent_at: update.sent_at,
        status: update.status,
      }
    end

    {
      updates: company_updates_props,
      pagy: PagyPresenter.new(pagy).props,
    }
  end

  def props
    pagy, company_updates = pagy(company.company_updates.sent.order(created_at: :desc), limit: RECORDS_PER_PAGE)
    company_updates_props = company_updates.map do |update|
      plaintext_body = Nokogiri::HTML(update.body).css("p").map(&:text).join(" ")
      {
        id: update.external_id,
        title: update.title,
        summary: truncate(plaintext_body, length: 300),
      }
    end

    {
      updates: company_updates_props,
      pagy: PagyPresenter.new(pagy).props,
    }
  end
end
