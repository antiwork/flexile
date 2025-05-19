# frozen_string_literal: true

class OauthRedirectsController < ApplicationController
  def show
    render inline: "", layout: "application", status: params.key?(:code) ? :ok : :bad_request
  end
end
