# frozen_string_literal: true

# Example controller demonstrating JWT authentication usage
class Api::V1::ExampleController < Api::BaseController
  def protected_action
    render json: {
      message: "This is a protected endpoint",
      user: {
        id: Current.user.id,
        email: Current.user.email,
        name: Current.user.name,
      },
    }
  end
end
