# frozen_string_literal: true

# Allows a team member to temporarily log in as another user
class ImpersonationService
  def initialize(authenticated_user)
    @authenticated_user = authenticated_user
  end

  def impersonate(user)
    reset_impersonation
    $redis.set(RedisKey.impersonated_user(authenticated_user.id), user.id, ex: 7.days.to_i)
  end

  def unimpersonate
    reset_impersonation
  end

  def impersonated_user
    # Short-circuit to avoid a Redis query for non-team members
    # Note that if a team member becomes a non-team member while impersonating,
    # the Redis key will persist until expiration.
    return unless authenticated_user.team_member?

    user = User.find($redis.get(RedisKey.impersonated_user(authenticated_user.id)))

    # Stop impersonation if the impersonated user becomes a team member during impersonation
    user unless user.team_member?
  rescue ActiveRecord::RecordNotFound
    nil
  end

  private
    attr_reader :authenticated_user

    def reset_impersonation
      $redis.del(RedisKey.impersonated_user(authenticated_user.id))
    end
end
