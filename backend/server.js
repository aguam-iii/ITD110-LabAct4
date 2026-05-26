const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { connectDB } = require('./config/db');
const electricityRoutes = require('./routes/electricityRoutes');

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json({ limit: '5mb' }));

app.use('/api/electricity', electricityRoutes);

app.get('/', (req, res) => {
    res.json({ message: 'Philippine Education Completion API (Apache Cassandra)' });
});

const PORT = process.env.PORT || 3000;

const start = async () => {
    await connectDB();
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
};

start();