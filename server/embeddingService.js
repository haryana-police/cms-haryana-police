import { pipeline } from '@xenova/transformers';

let embedder = null;

/**
 * Initialize the embedding pipeline
 */
export async function initEmbedder() {
  if (embedder) return embedder;
  
  console.log('Loading AI semantic model (paraphrase-multilingual-MiniLM-L12-v2)...');
  embedder = await pipeline('feature-extraction', 'Xenova/paraphrase-multilingual-MiniLM-L12-v2');
  console.log('AI Semantic model loaded.');
  return embedder;
}

/**
 * Generate a vector embedding for the given text
 */
export async function generateEmbedding(text) {
  const pipe = await initEmbedder();
  
  // Clean and normalize text
  const cleanText = text.replace(/\s+/g, ' ').trim().toLowerCase();
  
  const output = await pipe(cleanText, {
    pooling: 'mean',
    normalize: true,
  });

  return Array.from(output.data);
}

/**
 * Calculate cosine similarity between two vectors
 */
export function cosineSimilarity(vecA, vecB) {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  
  const similarity = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  return isNaN(similarity) ? 0 : similarity;
}
