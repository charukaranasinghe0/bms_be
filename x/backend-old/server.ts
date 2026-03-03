import { env } from "./config/env";
import app from "./app";

const PORT = env.PORT;

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Server is running on http://localhost:${PORT}`);
});
