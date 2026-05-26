const cassandra = require('cassandra-driver');

const contactPoints = (process.env.CASSANDRA_CONTACT_POINTS || '127.0.0.1').split(',');
const localDataCenter = process.env.CASSANDRA_DATACENTER || 'datacenter1';
const keyspace = process.env.CASSANDRA_KEYSPACE || 'education';

const bootstrapClient = new cassandra.Client({
    contactPoints,
    localDataCenter,
});

const client = new cassandra.Client({
    contactPoints,
    localDataCenter,
    keyspace,
});

const connectDB = async () => {
    try {
        await bootstrapClient.connect();
        await bootstrapClient.execute(
            `CREATE KEYSPACE IF NOT EXISTS ${keyspace}
             WITH replication = { 'class': 'SimpleStrategy', 'replication_factor': 1 }`
        );
        await bootstrapClient.shutdown();

        await client.connect();

        // Completion-rate table: one partition per region, rows ordered by gender, education level, and year.
        await client.execute(`
            CREATE TABLE IF NOT EXISTS completion_by_region (
                region text,
                gender text,
                education_level text,
                year int,
                percentage double,
                PRIMARY KEY ((region), gender, education_level, year)
            ) WITH CLUSTERING ORDER BY (gender ASC, education_level ASC, year DESC)
        `);

        console.log(`Cassandra Connected (keyspace: ${keyspace})`);
    } catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
};

module.exports = { connectDB, client };