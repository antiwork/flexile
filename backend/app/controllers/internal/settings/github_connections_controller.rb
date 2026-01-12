# frozen_string_literal: true

module Internal
  module Settings
    class GithubConnectionsController < BaseController
      def destroy
        current_user.update!(github_username: nil, github_external_id: nil)
        head :no_content
      end
    end
  end
end
