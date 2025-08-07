# frozen_string_literal: true

class Internal::BaseController < ApplicationController
  protect_from_forgery with: :null_session
end
