# frozen_string_literal: true

class DemoCompanyPresenter
  def initialize(company)
    @company = company
    @primary_email = company.primary_admin.user.email
  end

  def props
    {
      name: company.display_name,
      users: build_users_props,
    }
  end

  private
    attr_reader :company, :primary_email

    def build_users_props
      users_props = {}
      ordered_access_roles = [:administrator, :contractor, :investor, :lawyer]
      Company::ACCESS_ROLES.sort_by { |access_role, _| ordered_access_roles.index(access_role) || Float::INFINITY }.each do |access_role, model_klass|
        build_users_props_for(users_props, access_role, model_klass)
      end.flatten
      users_props.values
    end

    def build_users_props_for(users_props, access_role, model_klass)
      model_klass.where(company:).includes(:user)
        .reject { |company_user| company_user.user.email.end_with?("@#{SeedDataGeneratorFromTemplate::EMAIL_DOMAIN_FOR_RANDOM_USER}") }
        .filter_map do |company_user|
        user = company_user.user
        next unless seed_data_user?(user)

        if users_props[user.external_id].nil?
          users_props[user.external_id] = {
            id: user.external_id,
            name: user.display_name,
            email: user.email,
            password: SeedDataGeneratorFromTemplate::DEFAULT_PASSWORD,
            roles: [access_role.to_s.capitalize],
          }
        else
          users_props[user.external_id][:roles] << access_role.to_s.capitalize
        end
      end
    end

    def seed_data_user?(user)
      # Mimics the logic from SeedDataGeneratorFromTemplate#generate_email
      local_part, domain = primary_email.split("@")
      user.email.start_with?(local_part) && user.email.end_with?(domain)
    end
end
