const express = require('express');
const app = express();
import stt from "./routes/stt";

app.use("/api", sttRoutes);


const port = 8080;

// run server application on port 8080 of the current host
app.listen(port, () => console.log(`listening at http://localhost:${port}`));
