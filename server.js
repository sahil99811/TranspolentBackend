const express = require('express');
const cors = require('cors');
const dotenv=require('dotenv');
dotenv.config();
const scrapeRoutes=require('./routes/Scrape');
const app = express();
const PORT = 5000;
app.use(express.json())
app.use(scrapeRoutes);
app.use(cors({
  origin: "*"
}));


app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
