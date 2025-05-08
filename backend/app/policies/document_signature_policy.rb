# frozen_string_literal: true

# TODO (techdebt): remove as no longer used
class DocumentSignaturePolicy < ApplicationPolicy
  def show?
    record.signable.user == user && record.signed_at.blank?
  end

  def update?
    show?
  end
end
