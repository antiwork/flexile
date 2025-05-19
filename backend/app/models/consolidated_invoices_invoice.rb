# frozen_string_literal: true

class ConsolidatedInvoicesInvoice < ApplicationRecord
  belongs_to :consolidated_invoice
  belongs_to :invoice
end
