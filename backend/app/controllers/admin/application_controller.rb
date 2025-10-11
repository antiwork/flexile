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

    private
      def authenticate_user
        redirect_to_login if Current.user.nil?
      end

      def authenticate_admin
        redirect_to_dashboard unless Current.user.team_member?
      end

      def redirect_to_dashboard
        redirect_to "#{PROTOCOL}://#{DOMAIN}/dashboard", allow_other_host: true
      end

      def redirect_to_login
        redirect_to "#{PROTOCOL}://#{DOMAIN}/login?#{URI.encode_www_form(redirect_url: request.fullpath)}", allow_other_host: true
      end

    # Override this value to specify the number of elements to display at a time
    # on index pages. Defaults to 20.
    # def records_per_page
    #   params[:per_page] || 20
    # end
  end
end
