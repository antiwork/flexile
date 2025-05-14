# frozen_string_literal: true

class InviteInvestor
  def initialize(current_user:, company:, investor_params:, user_params:, dividend_date:)
    @current_user = current_user
    @company = company
    @dividend_date = dividend_date
    @investor_params = investor_params.dup
    @user_params = user_params.dup
    @email = @user_params.delete(:email)
    @compliance_params = @user_params.extract!(*User::USER_PROVIDED_TAX_ATTRIBUTES)
  end

  def perform
    return { success: false, error_message: "Please specify the email" } if email.blank?
    return { success: false, error_message: "Email has already been taken" } if User.where(email:).exists?

    all_values_present = investor_params.to_h.values.all?(&:present?)
    return { success: false, error_message: "Please input all values" } unless all_values_present

    user = User.new(email:, **user_params)
    user.build_compliance_info(compliance_params)
    investor = user.company_investors.build(company:, **investor_params)
    user.invite!(current_user,
                 subject: "Action required: start earning distributions on your investment in #{company.name}",
                 reply_to: current_user.email,
                 template_name: "investor_invitation_instructions",
                 dividend_date:)

    if user.errors.blank?
      { success: true }
    else
      error_object = investor.errors.any? ? investor : user
      { success: false, error_message: error_object.errors.full_messages.to_sentence }
    end
  end

  private
    attr_reader :current_user, :company, :email, :investor_params, :user_params, :compliance_params, :dividend_date
end

=begin
company = Company.second
service = InviteInvestor.new(current_user: company.primary_admin.user,
                             company:,
                             dividend_date: Date.parse("August 12, 2024"),
                             investor_params: { investment_amount_in_cents: 123_45 },
                             user_params: { email: "sharang.d+investor3@gmail.com", country_code: "IN" })
service.perform
=end
