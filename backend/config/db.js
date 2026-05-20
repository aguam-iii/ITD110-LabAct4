const cassandra = require('cassandra-driver');

const contactPoints = (process.env.CASSANDRA_CONTACT_POINTS || '127.0.0.1').split(',');
const localDataCenter = process.env.CASSANDRA_DATACENTER || 'datacenter1';
const keyspace = process.env.CASSANDRA_KEYSPACE || 'electricity';

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

        // Time-series table: one partition per region, rows ordered by year descending.
        await client.execute(`
            CREATE TABLE IF NOT EXISTS electricity_by_region (
                region text,
                year int,
                percentage double,
                PRIMARY KEY ((region), year)
            ) WITH CLUSTERING ORDER BY (year DESC)
        `);

        console.log(`Cassandra Connected (keyspace: ${keyspace})`);
    } catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
};

module.exports = { connectDB, client };