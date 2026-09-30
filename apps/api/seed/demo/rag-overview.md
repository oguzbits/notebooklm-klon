# Retrieval-augmented generation in a nutshell

This overview is written for the demo and is intentionally short.

## What it is

Retrieval-augmented generation (RAG) combines a search step with a language model. Instead of asking the model to answer from memory, the system first searches a set of documents for the passages that are relevant to the question. These passages are handed to the model together with the question, and the model writes an answer that is based on them.

## Why it helps

A language model only knows what was in its training data, and it can state wrong facts with great confidence. With retrieval, the answer can rest on documents the user chose. New or private documents can be used without retraining the model. Because the passages are known, each statement in the answer can point to the passage that supports it, so a reader can check it.

## The usual steps

First, documents are split into chunks of a few hundred words. Each chunk is turned into an embedding, a list of numbers that captures its meaning, and stored in a vector index. At question time, the question is embedded in the same way and the closest chunks are retrieved. Many systems combine this vector search with classic keyword search, because keyword search finds exact names and numbers that embeddings can miss. The two rankings are merged, for example with reciprocal rank fusion.

## Limits

RAG does not remove errors. If the search misses the right passage, the model may answer from the wrong one or say that it does not know. A valid citation shows where a statement came from, not that the statement is correct. Good systems therefore check that every citation points to a passage that was really part of the context, and they let the user open the cited passage.
