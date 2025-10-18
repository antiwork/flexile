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
    include PunditAuthorization

    before_action :authenticate_user
    before_action :authenticate_admin

    def authenticate_user
      unless Current.authenticated_user
        redirect_to frontend_login_path, allow_other_host: true
      end
    end

    def authenticate_admin
      unless Current.authenticated_user.team_member?
        redirect_to frontend_dashboard_path, allow_other_host: true
      end
    end

    def frontend_login_path(redirect_url = request.fullpath)
      "#{PROTOCOL}://#{DOMAIN}/login?#{URI.encode_www_form(redirect_url: redirect_url)}"
    end

    def frontend_dashboard_path
      "#{PROTOCOL}://#{DOMAIN}/dashboard"
    end

    # Override this value to specify the number of elements to display at a time
    # on index pages. Defaults to 20.
    # def records_per_page
    #   params[:per_page] || 20
    # end
  end
end
