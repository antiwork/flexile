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

  def custom_with_cc_and_reply_to
    AdminMailer.custom(
      to: "recipient@example.com",
      subject: "Test with CC and Reply-To",
      body: "This email has CC and Reply-To headers",
      cc: ["cc1@example.com", "cc2@example.com"],
      reply_to: "replies@example.com"
    )
  end
end
