"""Stage-level test fixtures for the scanner pipeline.

Provides dump/load functions for intermediate pipeline data at stage boundaries,
enabling individual stages to be run in isolation.

Stage boundaries:
  fetch  -> DiscoveryResult (image URLs, cursors)
  detect -> [{source_url, has_face, face_count, faces: [{index, embedding_b64, score}]}]
  match  -> [{image_id, contributor_id, similarity, tier}]
"""
