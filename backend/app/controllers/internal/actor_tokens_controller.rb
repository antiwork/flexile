# frozen_string_literal: true

class Internal::ActorTokensController < Internal::BaseController
  def create
    user = User.find_by(id: params[:user_id])
    authorize user, policy_class: ActorTokenPolicy
    render json: { actor_token: user.actor_token }, status: :created
  end
end
