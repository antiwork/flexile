# frozen_string_literal: true

class DocumentPolicy < ApplicationPolicy
  def index?
    user.administrator? || user.lawyer?
  end

  def show?
    index? || document_owner?
  end

  def create?
    index?
  end

  def sign?
    index? || document_owner?
  end

  def share?
    index? || document_owner?
  end

  def destroy?
    user.administrator?
  end

  private
    def document_owner?
      record.user_id == user.id
    end
end
