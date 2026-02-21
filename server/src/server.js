import "dotenv/config";
import { createApp } from "./app/app.js";

const app = await createApp();
const port = app.locals.config.PORT;

app.listen(port, () => {
  console.log(`✅ Server running on http://127.0.0.1:${port}`);
});
