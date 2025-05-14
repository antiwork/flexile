# frozen_string_literal: true

RSpec.describe SlackChannel do
  let(:mapping) do
    {
      flexile: "flexile",
      test: "test",
    }
  end

  it "defines a class method for each chat room" do
    mapping.each do |room_identifier, room_name|
      expect(described_class).to respond_to(room_identifier)
      expect(described_class.public_send(room_identifier)).to eq(room_name)
    end
  end
end
