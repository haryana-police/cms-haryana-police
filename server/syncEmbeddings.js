import db from './db.js';
import { generateEmbedding } from './embeddingService.js';

/**
 * Iterates through all cases and generates embeddings for any missing ones.
 * This is the core 'learning' / indexing system.
 */
export async function syncEmbeddings() {
  console.log('Starting Case Embedding Sync...');
  
  const cases = db.prepare('SELECT * FROM cases').all();
  const existingEmbeddings = db.prepare('SELECT case_id FROM case_embeddings').all().map(r => r.case_id);
  const missingCases = cases.filter(c => !existingEmbeddings.includes(c.id));

  if (missingCases.length === 0) {
    console.log('All cases are already indexed semantically.');
    return;
  }

  console.log(`Found ${missingCases.length} cases to index. This might take a few minutes for large datasets...`);

  let count = 0;
  for (const c of missingCases) {
    // Combine fields to create a rich semantic string
    const searchString = [
      c.incident_type,
      c.description,
      c.location,
      c.district,
      c.complainant_name,
      c.accused_name
    ].filter(Boolean).join(' ');

    try {
      count++;
      if (count % 100 === 0 || count === 1 || count === missingCases.length) {
         console.log(`Indexing progress: [${count}/${missingCases.length}] - Current Case: ${c.fir_number}`);
      }
      const vector = await generateEmbedding(searchString);
      
      // Store vector as JSON for simple compatibility with better-sqlite3 or Blob
      db.prepare('INSERT INTO case_embeddings (case_id, vector, metadata) VALUES (?, ?, ?)')
        .run(c.id, JSON.stringify(vector), searchString);
        
    } catch (err) {
      console.error(`Failed to index case ${c.id}:`, err);
    }
  }

  console.log('Semantic Indexing Complete.');
}
