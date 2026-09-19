"""Benchmark the feed. Prints a single JSON line: {"p50": .., "p95": .., "mean": .., "n": ..}"""
import json
import os
import statistics
import sys
import tempfile
import time

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
os.environ["STARTUP_DB"] = os.path.join(tempfile.gettempdir(), "runway_bench.db")

from backend import database  # noqa: E402
from backend.feed import get_feed  # noqa: E402

N = int(os.environ.get("BENCH_N", "12"))

database.DB_PATH = os.environ["STARTUP_DB"]
database.init_db()
get_feed(50)  # warm up

samples = []
for _ in range(N):
    t = time.perf_counter()
    get_feed(50)
    samples.append(time.perf_counter() - t)

samples.sort()
print(
    json.dumps(
        {
            "p50": round(statistics.median(samples), 4),
            "p95": round(samples[min(len(samples) - 1, int(len(samples) * 0.95))], 4),
            "mean": round(statistics.mean(samples), 4),
            "n": N,
        }
    )
)
