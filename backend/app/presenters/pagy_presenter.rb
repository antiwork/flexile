# frozen_string_literal: true

class PagyPresenter
  delegate :last, :from, :to, :count, :prev, :next, :page, :series, to: :@pagy, allow_nil: true

  def initialize(pagy)
    @pagy = pagy
  end

  def props
    {
      last:,
      from:,
      to:,
      count:,
      prev:,
      next:,
      page:,
      series: series(size: [1, 2, 2, 1]),
    }
  end
end
