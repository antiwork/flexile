# frozen_string_literal: true

module ClerkHelpers
  def clerk_sign_in(context)
    context.user.update!(clerk_id: "clerk_#{context.user.id}") if context.user.clerk_id.blank?

    @clerk_mock = double("clerk")
    allow(@clerk_mock).to receive(:user?).and_return(true)
    allow(@clerk_mock).to receive(:user_id).and_return(context.user.clerk_id)
    allow(@clerk_mock).to receive(:session_claims).and_return({ "iat" => Time.current.to_i })
    allow(controller).to receive(:clerk).and_return(@clerk_mock)

    allow(controller).to receive(:authenticate_user_json!)
    allow(controller).to receive(:set_paper_trail_whodunnit)
    allow(controller).to receive(:verify_authorized)

    allow(Current).to receive(:user).and_return(context.user)
    allow(Current).to receive(:company).and_return(context.company)
    allow(Current).to receive(:company_administrator).and_return(context.company_administrator)
    allow(Current).to receive(:company_worker).and_return(context.company_worker)
    allow(Current).to receive(:company_investor).and_return(context.company_investor)
    allow(Current).to receive(:company_lawyer).and_return(context.company_lawyer)

    allow(controller).to receive(:current_context).and_return(context)

    @current_context = context
  end
end

RSpec.configure do |config|
  config.include ClerkHelpers, type: :controller
end
