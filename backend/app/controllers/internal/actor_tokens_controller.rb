# frozen_string_literal: true

class Internal::ActorTokensController < Internal::BaseController
  before_action :set_user!, only: [:create]

  def create
    authorize @user, policy_class: ActorTokenPolicy
    render json: { actor_token: @user.actor_token }, status: :created
  end

  private
    def set_user!
      @user = User.find_by(external_id: params[:user_id])
      head :not_found unless @user&.all_companies&.include?(Current.company)
    end
end
