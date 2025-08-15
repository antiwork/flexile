# frozen_string_literal: true

class CompanyUpdateMailer < ApplicationMailer
  helper :application

  def update_published(company_update_id:, user_id:)
    user = User.find(user_id)
    update = CompanyUpdate.find(company_update_id)
    @company = update.company
    @props = CompanyUpdatePresenter.new(update).props
    @video_thumbnail_url = @props[:youtube_video_id] ? "https://img.youtube.com/vi/#{@props[:youtube_video_id]}/hqdefault.jpg" : nil
    mail(
      from: email_address_with_name(NOREPLY_EMAIL, "#{update.company.display_name} via Flexile"),
      to: user.email,
      reply_to: update.company.email,
      subject: "#{update.company.name}: #{update.title} investor update",
    )
  end
end
