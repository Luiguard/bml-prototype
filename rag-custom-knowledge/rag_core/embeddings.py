"""Embedding-Erzeugung: Mobile-NPU mit lokalem Fallback."""
from __future__ import annotations

import gc
import os
import requests
from langchain_huggingface import HuggingFaceEmbeddings

from .config import EMBEDDING_MODEL, MOBILE_EMBED_TIMEOUT, MOBILE_NODE_URL
from .quality import enhance_query
from .gui_resources import wait_for_ram, dynamic_batch_size

_local: HuggingFaceEmbeddings | None = None
_mobile_failed = False


def _local_model() -> HuggingFaceEmbeddings:
    global _local
    if _local is None:
        wait_for_ram(floor_mb=800)
        _local = HuggingFaceEmbeddings(model_name=EMBEDDING_MODEL)
    return _local


def embed_documents(texts: list[str], *, force: bool = False) -> list[list[float]] | None:
    global _mobile_failed
    if not texts:
        return []

    from .config import RAG_LAZY_EMBEDDING, VECTOR_DIM
    if RAG_LAZY_EMBEDDING and not force:
        return [[0.0] * VECTOR_DIM for _ in texts]

    prefer_local = os.environ.get("RAG_PREFER_LOCAL", "0") == "1"

    if not _mobile_failed and not prefer_local and MOBILE_NODE_URL:
        try:
            sub_batch_size = 32
            all_vectors = []
            for i in range(0, len(texts), sub_batch_size):
                sub_texts = texts[i:i + sub_batch_size]
                resp = requests.post(
                    MOBILE_NODE_URL,
                    json={"input": sub_texts},
                    timeout=MOBILE_EMBED_TIMEOUT,
                )
                if resp.status_code == 200:
                    data = resp.json().get("data", [])
                    vectors = [d["embedding"] for d in data]
                    if len(vectors) == len(sub_texts):
                        all_vectors.extend(vectors)
                    else:
                        raise ValueError("Mismatch in returned embedding count")
                else:
                    raise RuntimeError(f"Server returned status {resp.status_code}")
            
            if len(all_vectors) == len(texts):
                return all_vectors
        except Exception:
            _mobile_failed = True

    batch_sz = dynamic_batch_size(len(texts))
    if len(texts) <= batch_sz:
        wait_for_ram(floor_mb=600)
        result = _local_model().embed_documents(texts)
        gc.collect()
        return result

    all_vecs = []
    for i in range(0, len(texts), batch_sz):
        wait_for_ram(floor_mb=600)
        chunk = texts[i:i + batch_sz]
        vecs = _local_model().embed_documents(chunk)
        all_vecs.extend(vecs)
        gc.collect()
    return all_vecs


def embed_query(query: str, *, enhance: bool = True) -> tuple[list[float], bool]:
    """Returns (vector, used_mobile)."""
    global _mobile_failed
    q = enhance_query(query) if enhance else query
    prefer_local = os.environ.get("RAG_PREFER_LOCAL", "0") == "1"

    if not _mobile_failed and not prefer_local and MOBILE_NODE_URL:
        try:
            resp = requests.post(
                MOBILE_NODE_URL,
                json={"input": [q]},
                timeout=min(MOBILE_EMBED_TIMEOUT, 8),
            )
            if resp.status_code == 200:
                data = resp.json().get("data", [])
                if data:
                    return data[0]["embedding"], True
        except Exception:
            _mobile_failed = True

    return _local_model().embed_query(q), False
