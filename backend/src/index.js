const express = require('express');
const app = express();

const port = 8080;

// run server application on port 8080 of the current host
app.listen(port, () => console.log('Server is running on port 8080'));
