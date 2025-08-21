import { companiesFactory } from "@test/factories/companies";
import { login } from "@test/helpers/auth";
import { expect, test, withinModal } from "@test/index";

test.describe.only("Support Portal Page", () => {
  test("should show the support portal", async ({ page }) => {
    const { adminUser } = await companiesFactory.createCompletedOnboarding();
    await login(page, adminUser, "/support");

    await expect(page.getByRole("heading", { name: "Support center" })).toBeVisible();

    await expect(page.getByRole("button", { name: "Contact support" })).toBeVisible();

    await expect(page.getByText("No support tickets found. Create your first ticket to get started.")).toBeVisible();
  });

  test("should attach files using paperclip button", async ({ page, next }) => {
    // Mock Helper AI API responses
    next.onFetch((request) => {
      if (request.url.includes("help.flexile.com")) {
        if (request.url.includes("/conversations")) {
          return Response.json({ conversations: [] });
        }
        if (request.url.includes("/session")) {
          return Response.json({ sessionId: "mock-session-123" });
        }
      }
    });

    const { adminUser } = await companiesFactory.createCompletedOnboarding();
    await login(page, adminUser, "/support");

    await page.getByRole("button", { name: "Contact support" }).click();

    await withinModal(
      async (modal) => {
        // Click the paperclip button to trigger file selection
        await modal.getByRole("button", { name: "Attach files" }).click();

        // Select files using the file input
        const fileInput = modal.locator('input[type="file"]').first();
        await fileInput.setInputFiles([
          {
            name: "test-document.pdf",
            mimeType: "application/pdf",
            buffer: Buffer.from("test content"),
          },
        ]);

        // Verify file appears in attachment list
        await expect(modal.getByText("test-document.pdf")).toBeVisible();

        // Verify remove button is present
        await expect(modal.getByRole("button", { name: "Remove file" })).toBeVisible();
      },
      { page, title: "How can we help you today?" },
    );
  });

  test("should remove attached files", async ({ page, next }) => {
    // Mock Helper AI API responses
    next.onFetch((request) => {
      if (request.url.includes("help.flexile.com")) {
        if (request.url.includes("/conversations")) {
          return Response.json({ conversations: [] });
        }
        if (request.url.includes("/session")) {
          return Response.json({ sessionId: "mock-session-123" });
        }
      }
    });

    const { adminUser } = await companiesFactory.createCompletedOnboarding();
    await login(page, adminUser, "/support");

    await page.getByRole("button", { name: "Contact support" }).click();

    await withinModal(
      async (modal) => {
        // Add a file first
        const fileInput = modal.locator('input[type="file"]').first();
        await fileInput.setInputFiles([
          {
            name: "removable-file.pdf",
            mimeType: "application/pdf",
            buffer: Buffer.from("test content"),
          },
        ]);

        // Verify file is attached
        await expect(modal.getByText("removable-file.pdf")).toBeVisible();

        // Click the remove button
        await modal.getByRole("button", { name: "Remove file" }).click();

        // Verify file is removed
        await expect(modal.getByText("removable-file.pdf")).not.toBeVisible();
        await expect(modal.getByRole("button", { name: "Remove file" })).not.toBeVisible();
      },
      { page, title: "How can we help you today?" },
    );
  });

  test("should show drag overlay when files are dragged over", async ({ page, next }) => {
    // Mock Helper AI API responses
    next.onFetch((request) => {
      if (request.url.includes("help.flexile.com")) {
        if (request.url.includes("/conversations")) {
          return Response.json({ conversations: [] });
        }
        if (request.url.includes("/session")) {
          return Response.json({ sessionId: "mock-session-123" });
        }
      }
    });

    const { adminUser } = await companiesFactory.createCompletedOnboarding();
    await login(page, adminUser, "/support");

    await page.getByRole("button", { name: "Contact support" }).click();

    await withinModal(
      async (modal) => {
        // Verify drag overlay is not initially visible
        await expect(modal.getByText("Drop files here to attach")).not.toBeVisible();

        // Verify dropzone area exists
        const dropzoneArea = modal.getByTestId("support-file-dropzone");
        await expect(dropzoneArea).toBeVisible();

        // Verify file input has correct accept attributes
        const fileInput = modal.getByTestId("support-file-dropzone-input");
        await expect(fileInput).toHaveAttribute(
          "accept",
          "image/*,application/pdf,.pdf,application/msword,.doc,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx,text/plain,.txt",
        );

        // Simulate drag enter event to show overlay
        await dropzoneArea.evaluate((element) => {
          const dragEnterEvent = new DragEvent("dragenter", {
            bubbles: true,
            cancelable: true,
            dataTransfer: new DataTransfer(),
          });
          // Add file type to dataTransfer
          dragEnterEvent.dataTransfer?.items.add(new File([""], "test.pdf", { type: "application/pdf" }));
          element.dispatchEvent(dragEnterEvent);
        });

        // Verify drag overlay becomes visible
        await expect(modal.getByText("Drop files here to attach")).toBeVisible();

        // Simulate drag over event
        await dropzoneArea.evaluate((element) => {
          const dragOverEvent = new DragEvent("dragover", {
            bubbles: true,
            cancelable: true,
            dataTransfer: new DataTransfer(),
          });
          dragOverEvent.dataTransfer?.items.add(new File([""], "test.pdf", { type: "application/pdf" }));
          element.dispatchEvent(dragOverEvent);
        });

        // Verify overlay is still visible during drag over
        await expect(modal.getByText("Drop files here to attach")).toBeVisible();

        // Simulate drag leave event to hide overlay
        await dropzoneArea.evaluate((element) => {
          const dragLeaveEvent = new DragEvent("dragleave", {
            bubbles: true,
            cancelable: true,
            dataTransfer: new DataTransfer(),
          });
          element.dispatchEvent(dragLeaveEvent);
        });

        // Verify drag overlay is hidden after drag leave
        await expect(modal.getByText("Drop files here to attach")).not.toBeVisible();
      },
      { page, title: "How can we help you today?" },
    );
  });

  test("should handle file drop and attach files", async ({ page, next }) => {
    // Mock Helper AI API responses
    next.onFetch((request) => {
      if (request.url.includes("help.flexile.com")) {
        if (request.url.includes("/conversations")) {
          return Response.json({ conversations: [] });
        }
        if (request.url.includes("/session")) {
          return Response.json({ sessionId: "mock-session-123" });
        }
      }
    });

    const { adminUser } = await companiesFactory.createCompletedOnboarding();
    await login(page, adminUser, "/support");

    await page.getByRole("button", { name: "Contact support" }).click();

    await withinModal(
      async (modal) => {
        const dropzoneArea = modal.getByTestId("support-file-dropzone");

        // Simulate drag enter to show overlay
        await dropzoneArea.evaluate((element) => {
          const dragEnterEvent = new DragEvent("dragenter", {
            bubbles: true,
            cancelable: true,
            dataTransfer: new DataTransfer(),
          });
          dragEnterEvent.dataTransfer?.items.add(
            new File(["content"], "dropped-document.pdf", { type: "application/pdf" }),
          );
          element.dispatchEvent(dragEnterEvent);
        });

        // Verify overlay is shown
        await expect(modal.getByText("Drop files here to attach")).toBeVisible();

        // Simulate the actual drop event
        await dropzoneArea.evaluate((element) => {
          const dropEvent = new DragEvent("drop", {
            bubbles: true,
            cancelable: true,
            dataTransfer: new DataTransfer(),
          });
          dropEvent.dataTransfer?.items.add(new File(["content"], "dropped-document.pdf", { type: "application/pdf" }));
          element.dispatchEvent(dropEvent);
        });

        // Verify the file appears in the attachment list
        await expect(modal.getByText("dropped-document.pdf")).toBeVisible();

        // Verify drag overlay is hidden after drop
        await expect(modal.getByText("Drop files here to attach")).not.toBeVisible();
      },
      { page, title: "How can we help you today?" },
    );
  });

  test("should support multiple file attachments", async ({ page, next }) => {
    // Mock Helper AI API responses
    next.onFetch((request) => {
      if (request.url.includes("help.flexile.com")) {
        if (request.url.includes("/conversations")) {
          return Response.json({ conversations: [] });
        }
        if (request.url.includes("/session")) {
          return Response.json({ sessionId: "mock-session-123" });
        }
      }
    });

    const { adminUser } = await companiesFactory.createCompletedOnboarding();
    await login(page, adminUser, "/support");

    await page.getByRole("button", { name: "Contact support" }).click();

    await withinModal(
      async (modal) => {
        // Add multiple files
        const fileInput = modal.locator('input[type="file"]').first();
        await fileInput.setInputFiles([
          {
            name: "document1.pdf",
            mimeType: "application/pdf",
            buffer: Buffer.from("content1"),
          },
          {
            name: "image1.jpg",
            mimeType: "image/jpeg",
            buffer: Buffer.from("content2"),
          },
          {
            name: "text1.txt",
            mimeType: "text/plain",
            buffer: Buffer.from("content3"),
          },
        ]);

        // Verify all files are shown
        await expect(modal.getByText("document1.pdf")).toBeVisible();
        await expect(modal.getByText("image1.jpg")).toBeVisible();
        await expect(modal.getByText("text1.txt")).toBeVisible();

        // Verify multiple remove buttons are present
        await expect(modal.getByRole("button", { name: "Remove file" })).toHaveCount(3);
      },
      { page, title: "How can we help you today?" },
    );
  });
});
