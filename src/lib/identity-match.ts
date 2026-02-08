/**
 * Cosine similarity between two embedding vectors.
 * Used to compare a captured face against the anchor embedding from KYC.
 * Note: Actual face embeddings require InsightFace or similar ML model,
 * which will be handled server-side in a future microservice.
 * This client-side check provides a basic placeholder.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;

  return dotProduct / denominator;
}

/**
 * Check if a face embedding matches the anchor (reference) embedding.
 * Returns a score between 0 and 1, where > 0.6 is typically a match.
 */
export function isIdentityMatch(
  capturedEmbedding: number[],
  anchorEmbedding: number[],
  threshold = 0.6
): { match: boolean; score: number } {
  const score = cosineSimilarity(capturedEmbedding, anchorEmbedding);
  return { match: score >= threshold, score };
}
