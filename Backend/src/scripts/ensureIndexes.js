import dotenv from 'dotenv';
import { connectMongoDB, disconnectMongoDB } from '../config/mongodb.js';
import { appModels } from '../models/index.js';

dotenv.config();

async function main() {
    await connectMongoDB();

    for (const model of appModels) {
        await model.createIndexes();
        console.log(`Indexes ensured: ${model.modelName}`);
    }

    await disconnectMongoDB();
}

main().catch(async (error) => {
    console.error('Failed to ensure MongoDB indexes:', error);
    await disconnectMongoDB();
    process.exit(1);
});
