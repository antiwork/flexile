# frozen_string_literal: true

module SetCurrent
  extend ActiveSupport::Concern

  included do
    helper_method :current_context, :current_user_access_roles_cookie_name, :selected_access_roles_by_company, :switch_role

    before_action :current_context
  end

  def current_context
    @current_context ||= set_current
  end

  def set_current
    if clerk&.user_id
      user = User.find_by(clerk_id: clerk.user_id)
      if !user && !Rails.env.test?
        email = clerk.user.email_addresses.find { |item| item.id == clerk.user.primary_email_address_id }.email_address
        user = User.find_by(email:) if Rails.env.development?
        if user
          user.update!(clerk_id: clerk.user_id)
        else
          user = User.create!(clerk_id: clerk.user_id, email:)
          user.tos_agreements.create!(ip_address: request.remote_ip)
        end
      end

      if clerk.user? && clerk.session_claims["iat"] != user.current_sign_in_at.to_i
        user.update!(current_sign_in_at: Time.zone.at(clerk.session_claims["iat"]))
      end
    end
    Current.user = user

    company = Current.user.present? ? company_from_param || company_from_user : nil
    Current.company = company
    cookies.permanent[current_user_selected_company_cookie_name] = company.external_id if company.present?

    role = \
      if Flipper.enabled?(:role_switch, Current.user) && Current.company.present?
        role_from_cookie || role_from_user_and_company
      else
        nil
      end
    Current.role = role

    context = CurrentContext.new(user: Current.user, company:, role:)
    Current.company_administrator = context.company_administrator
    Current.company_worker = context.company_worker
    Current.company_investor = context.company_investor
    Current.company_lawyer = context.company_lawyer
    context
  end

  def switch_role(access_role)
    # Manually update @selected_access_roles_by_company for the current request, as cookie is available
    # for future requests
    @selected_access_roles_by_company[Current.company.external_id] = access_role
    cookies.permanent[current_user_access_roles_cookie_name] = selected_access_roles_by_company.to_json
    reset_current
  end

  def selected_access_roles_by_company
    @selected_access_roles_by_company ||= access_roles_from_cookie.select do |company_external_id, access_role|
      # Ensure the roles are still valid
      Company::ACCESS_ROLES.key?(access_role) && Current.user.public_send(:"company_#{access_role}_for?", Company.find_by(external_id: company_external_id))
    end
  end


  private
    def company_from_param
      # TODO: Remove params[:companyId] once all URLs are updated
      company_id = params[:company_id] || params[:companyId] || cookies[current_user_selected_company_cookie_name]
      return if company_id.blank? || company_id == Company::PLACEHOLDER_COMPANY_ID

      company = Current.user.all_companies.find { _1.external_id == company_id }
      # Ensures the URL contains a valid company ID that the user can access
      return e404 if company.blank?

      company
    end

    def company_from_user
      Company::ACCESS_ROLES.each do |access_role, model_class|
        next unless Current.user.public_send(:"#{access_role}?") && special_conditions_for_role?(access_role)

        return model_class.where(user_id: Current.user.id).first!.company
      end

      nil
    end

    def role_from_cookie
      selected_access_roles_by_company[Current.company.external_id]
    end

    def role_from_user_and_company
      Company::ACCESS_ROLES.keys.detect do |access_role|
        Current.user.public_send(:"company_#{access_role}_for?", Current.company) && special_conditions_for_role_and_company?(access_role, Current.company)
      end
    end

    def special_conditions_for_role?(access_role)
      # Legacy rules to prioritize users with stand-alone roles over those that may be administrators or lawyers for
      # other companies.
      if access_role.in? [Company::ACCESS_ROLE_ADMINISTRATOR, Company::ACCESS_ROLE_LAWYER]
        !Current.user.worker? && !Current.user.investor?
      else
        true
      end
    end

    def special_conditions_for_role_and_company?(access_role, company)
      # Legacy rules to prioritize users with stand-alone roles over those that may be administrators or lawyers for
      # other companies.
      if access_role.in? [Company::ACCESS_ROLE_ADMINISTRATOR, Company::ACCESS_ROLE_LAWYER]
        !Current.user.company_worker_for?(company) && !Current.user.company_investor_for?(company)
      else
        true
      end
    end

    def reset_current
      @current_context = nil
      current_context
    end

    def access_roles_from_cookie
      return {} if Current.user.blank?

      JSON.parse(cookies[current_user_access_roles_cookie_name].to_s).transform_values(&:to_sym)
    rescue JSON::ParserError
      {}
    end

    def current_user_access_roles_cookie_name
      [Current.user.external_id, "access_roles"].join("_")
    end

    def current_user_selected_company_cookie_name
      [Current.user.external_id, "selected_company"].join("_")
    end
end
