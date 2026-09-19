"""Verifier-owned benchmark (recalibrated copy of startup-repo/benchmark/benchmark_feed.py).

Seeds a large database so the baseline is visibly slow, then times get_feed(50).
Prints one JSON line: {"p50", "p95", "mean", "n", "posts"}. Configuration comes from the runner's env:
STARTUP_DB, BENCH_USERS, BENCH_POSTS_PER_USER, BENCH_N.
"""
import json
import os
import statistics
import time

from backend import database
from backend.feed import get_feed

n_users = int(os.environ["BENCH_USERS"])
posts_per_user = int(os.environ["BENCH_POSTS_PER_USER"])
n = int(os.environ["BENCH_N"])

database.DB_PATH = os.environ["STARTUP_DB"]
database.init_db(n_users=n_users, posts_per_user=posts_per_user)
get_feed(50)  # warm up

samples = []
for _ in range(n):
    t = time.perf_counter()
    get_feed(50)
    samples.append(time.perf_counter() - t)

samples.sort()
print(json.dumps({
    "p50": round(statistics.median(samples), 4),
    "p95": round(samples[min(len(samples) - 1, int(len(samples) * 0.95))], 4),
    "mean": round(statistics.mean(samples), 4),
    "n": n,
    "posts": n_users * posts_per_user,
}))
