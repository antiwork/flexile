# frozen_string_literal: true

class SlackChannel
  CHAT_ROOMS = {
    flexile: "flexile",
    test: "test",
  }.freeze
  private_constant :CHAT_ROOMS

  # Create class methods for each chat room. Eg: `SlackChannel.flexile()`
  CHAT_ROOMS.each do |room_identifier, room_name|
    self.class.define_method room_identifier do
      room_name
    end
  end
end
