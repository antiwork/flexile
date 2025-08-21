# frozen_string_literal: true

# All Administrate controllers inherit from this
# `Administrate::ApplicationController`, making it the ideal place to put
# authentication logic or other before_actions.
#
# If you want to add pagination or other controller-level concerns,
# you're free to overwrite the RESTful controller actions.
module Admin
  class ApplicationController < Administrate::ApplicationController
    include SetCurrent

    before_action :authenticate_user
    before_action :authenticate_admin

    def authenticate_user
      if Current.user.nil?
        if request.format.json?
          render json: { error: "Unauthorized" }, status: :unauthorized
        else
          raise ActionController::RoutingError, "Not Found"
        end
      end
    end

    def authenticate_admin
      unless Current.user.team_member?
        if request.format.json?
          render json: { error: "Unauthorized" }, status: :unauthorized
        else
          raise ActionController::RoutingError, "Not Found"
        end
      end
    end

    # Override this value to specify the number of elements to display at a time
    # on index pages. Defaults to 20.
    # def records_per_page
    #   params[:per_page] || 20
    # end
  end
end
