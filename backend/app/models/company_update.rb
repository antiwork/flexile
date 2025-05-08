# frozen_string_literal: true

class CompanyUpdate < ApplicationRecord
  has_paper_trail

  include ExternalId

  DRAFT = "Draft"
  SENT = "Sent"

  belongs_to :company
  has_many :company_updates_financial_reports, dependent: :destroy
  has_and_belongs_to_many :company_monthly_financial_reports, join_table: :company_updates_financial_reports

  validates :title, presence: true
  validates :body, presence: true
  validates :period_started_on, presence: true, if: :period
  validates :period_started_on, absence: true, unless: :period
  validate :period_started_on_must_be_the_first_day_of_the_period

  enum :period, { month: "month", quarter: "quarter", year: "year" }

  scope :sent, -> { where.not(sent_at: nil) }

  class << self
    def months_for_period(period)
      case period.to_s
      when CompanyUpdate.periods["month"] then 1
      when CompanyUpdate.periods["quarter"] then 3
      when CompanyUpdate.periods["year"] then 12
      end
    end
  end

  def status
    sent_at.present? ? SENT : DRAFT
  end

  def youtube_video_id
    return unless video_url&.match?(/youtube\.com|youtu\.be/)

    video_url[/(?:youtube\.com.*[?&]v=|youtu\.be\/)([\w-]+)/, 1]
  end

  private
    def period_started_on_must_be_the_first_day_of_the_period
      return if period.blank? || period_started_on.blank?
      return if period_started_on.public_send("beginning_of_#{period}") == period_started_on

      errors.add(:period_started_on, "must be the start of the #{period}")
    end
end
