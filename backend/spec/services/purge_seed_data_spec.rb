# frozen_string_literal: true

RSpec.describe PurgeSeedData, :skip_pdf_generation do
  it "does not raise an error" do
    # Turn off VCR and allow network requests to ensure the seed generation works
    VCR.turned_off do
      WebMock.allow_net_connect!
      SeedDataGeneratorFromTemplate.new(template: "gumroad", email: "test@flexile.example", fast_mode: true).perform!
      PurgeSeedData.new("test@flexile.example").perform!
      expect(User.count).to eq(0)
      expect(Company.count).to eq(0)
    end
  end

  it "raises an error in production" do
    allow(Rails).to receive(:env).and_return(ActiveSupport::StringInquirer.new("production"))

    expect do
      PurgeSeedData.new("test@flexile.example").perform!
    end.to raise_error("This code should never be run in production.")
  end
end
