# frozen_string_literal: true

RSpec.shared_examples_for "timestamp state field" do
  describe "class methods" do
    it "it filter records" do
      fields.each do |field|
        other_fields = fields.reject { |f| f == field }
        other_records = other_fields.map { |f| f[:records] }.flatten

        expect(described_class.send(field[:name])).to match_array(field[:records])
        expect(described_class.send(:"not_#{field[:name]}")).to match_array(other_records)
      end
    end
  end

  describe "instance methods" do
    it "returns boolean value when using predicate methods" do
      fields.each do |field|
        field[:records].each do |record|
          expect(record.send(:"#{field[:name]}?")).to eq true
          expect(record.send(:"not_#{field[:name]}?")).to eq false
        end
      end
    end

    it "updates record via update methods" do
      fields.each do |field|
        field[:records].each do |record|
          expect(record.send(:"#{field[:name]}?")).to eq true
          record.send(:"update_as_not_#{field[:name]}!")
          expect(record.send(:"#{field[:name]}?")).to eq false

          record.send(:"update_as_#{field[:name]}!")
          expect(record.send(:"#{field[:name]}?")).to eq true
        end
      end
    end

    it "reponds to state methods" do
      fields.each do |field|
        field[:records].each do |record|
          expect(record.send(:"#{field[:name]}?")).to eq true
          expect(record.send(:"state_#{field[:name]}?")).to be(true)
          expect(record.state).to eq(field[:name])

          record.send(:"update_as_not_#{field[:name]}!")
          expect(record.send(:"state_#{field[:name]}?")).to be(false)
          expect(record.state).to eq(default_state || :"not_#{field[:name]}")
        end
      end
    end
  end
end
