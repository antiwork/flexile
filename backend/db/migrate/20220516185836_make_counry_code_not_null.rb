class MakeCounryCodeNotNull < ActiveRecord::Migration[7.0]
  def up
    if Rails.env.development?
      WiseRecipient.all.each { |wr| wr.destroy! unless wr.valid? }
    end
    change_column_null :wise_recipients, :country_code, false
  end

  def down
    change_column_null :wise_recipients, :country_code, true
  end
end
