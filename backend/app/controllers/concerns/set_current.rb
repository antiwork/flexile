# frozen_string_literal: true

module SetCurrent
  extend ActiveSupport::Concern

  included do
    helper_method :current_context

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

    company = Current.user.present? ? company_from_param || company_from_contractor_invite || company_from_user : nil
    Current.company = company
    cookies.permanent[current_user_selected_company_cookie_name] = company.external_id if company.present?

    context = CurrentContext.new(user: Current.user, company:)
    Current.company_administrator = context.company_administrator
    Current.company_worker = context.company_worker
    Current.company_investor = context.company_investor
    Current.company_lawyer = context.company_lawyer
    context
  end


  private
    def company_from_param
      # TODO: Remove params[:companyId] once all URLs are updated
      company_id = params[:company_id] || params[:companyId] || cookies[current_user_selected_company_cookie_name]
      return if company_id.blank? || company_id == Company::PLACEHOLDER_COMPANY_ID

      company = Current.user.all_companies.find { _1.external_id == company_id }

      # Don't throw 404 if company not found - let contractor invite logic try first
      # Only enforce access control if company_id came from URL params (not cookies)
      if company.blank? && (params[:company_id] || params[:companyId])
        return e404
      end

      company
    end

    def company_from_contractor_invite
      return unless Current.user.clerk_id.present?

      begin
        clerk_client = Clerk::SDK.new
        clerk_user = clerk_client.users.get_user(Current.user.clerk_id)
        contractor_invite_uuid = clerk_user.unsafe_metadata&.dig("contractorInviteUuid")

        if contractor_invite_uuid.present?
          contractor_invite_link = ContractorInviteLink.find_by(uuid: contractor_invite_uuid)

          if contractor_invite_link&.company
            company = contractor_invite_link.company

            # Create draft CompanyWorker if it doesn't exist
            existing_worker = company.company_workers.find_by(user: Current.user)
            unless existing_worker
              company.company_workers.create!(
                user: Current.user,
                role: "Contractor",
                started_at: Date.current,
                pay_rate_type: :hourly,
                pay_rate_in_subunits: 1, # Placeholder - will be updated during onboarding
                hours_per_week: CompanyWorker::DEFAULT_HOURS_PER_WEEK
              )
            end

            return company
          end
        end
      rescue => e
        Rails.logger.error "Failed to fetch contractor invite company from Clerk: #{e.message}"
      end

      nil
    end

    def company_from_user
      Company::ACCESS_ROLES.each do |access_role, model_class|
        next unless Current.user.public_send(:"#{access_role}?")

        return model_class.where(user_id: Current.user.id).first!.company
      end

      nil
    end

    def reset_current
      @current_context = nil
      current_context
    end

    def current_user_selected_company_cookie_name
      [Current.user.external_id, "selected_company"].join("_")
    end
end
