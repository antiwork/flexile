# frozen_string_literal: true

module Admin
  class UsersController < Admin::ApplicationController
    after_action :reset_current, only: [:impersonate, :unimpersonate]

    def impersonate
      user = User.alive.find_by!(external_id: params[:id])
      authorize user

      ImpersonationService.new(Current.authenticated_user).impersonate(user)

      redirect_to "#{PROTOCOL}://#{DOMAIN}/dashboard", allow_other_host: true
    rescue ActiveRecord::RecordNotFound, Pundit::NotAuthorizedError
      redirect_to admin_users_path, alert: "The requested resource could not be accessed."
    end

    def unimpersonate
      ImpersonationService.new(Current.authenticated_user).unimpersonate

      render json: { success: true }
    end

    def destroy
      user = requested_resource
      authorize user

      user.mark_deleted!
      redirect_to admin_users_path, notice: "User account has been deactivated."
    rescue Pundit::NotAuthorizedError
      redirect_to admin_users_path, alert: "You are not authorized to delete this user."
    end

    # Overwrite any of the RESTful controller actions to implement custom behavior
    # For example, you may want to send an email after a foo is updated.
    #
    # def update
    #   super
    #   send_foo_updated_email(requested_resource)
    # end

    # Override this method to specify custom lookup behavior.
    # This will be used to set the resource for the `show`, `edit`, and `update`
    # actions.
    #
    # def find_resource(param)
    #   Foo.find_by!(slug: param)
    # end

    # The result of this lookup will be available as `requested_resource`

    # Override this if you have certain roles that require a subset
    # this will be used to set the records shown on the `index` action.
    #
    # def scoped_resource
    #   if Current.user.super_admin?
    #     resource_class
    #   else
    #     resource_class.with_less_stuff
    #   end
    # end

    # Override `resource_params` if you want to transform the submitted
    # data before it's persisted. For example, the following would turn all
    # empty values into nil values. It uses other APIs such as `resource_class`
    # and `dashboard`:
    #
    # def resource_params
    #   params.require(resource_class.model_name.param_key).
    #     permit(dashboard.permitted_attributes).
    #     transform_values { |value| value == "" ? nil : value }
    # end

    # See https://administrate-prototype.herokuapp.com/customizing_controller_actions
    # for more information
  end
end
