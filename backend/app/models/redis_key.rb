# frozen_string_literal: true

class RedisKey
  class << self
    def company_and_role_for_user_id(user_id) = "company_and_role_for_user_id_#{user_id}"
    def impersonated_user(admin_user_id) = "impersonated_user_by_admin_#{admin_user_id}"
  end
end
