# frozen_string_literal: true

class AdminMailerPreview < ActionMailer::Preview
  def custom
    AdminMailer.custom(to: "sharang@example.com", subject: "Test custom", body: "This is a test")
  end

  def custom_with_attachments
    attached = {
      "file1.txt" => "File 1 Content",
      "file2.txt" => "File 2 Content",
      "file3.csv" => { mime_type: "text/csv", content: "one,two,three\n1,2,3" },
    }
    AdminMailer.custom(to: "sharang@example.com", subject: "Test custom", body: "This is a test",
                       attached:)
  end
end
