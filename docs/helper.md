## Helper widget

To run the [Helper](https://github.com/antiwork/helper) widget locally, you'll also need to run the Helper app locally.

By default, the development environment expects the Helper Next.js server to run on `localhost:3010`. Currently, the Helper host is set to port 3000. You can update the port by modifying `bin/dev` and `packages/sdk/webpack.sdk.cjs` inside the Helper project to use a different port, such as 3010.

You can update the `HELPER_WIDGET_HOST` in your `.env` file to point to a different host if needed.

The widget performs HMAC validation on the email to confirm it's coming from Gumroad. Update the `helper_widget_secret` in the credentials to match the one used by Helper.
