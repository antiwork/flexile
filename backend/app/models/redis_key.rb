# frozen_string_literal: true

class RedisKey
  class << self
    def company_and_role_for_user_id(user_id) = "company_and_role_for_user_id_#{user_id}"
  end
end
