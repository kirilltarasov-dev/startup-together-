# Definitely Not A Ponzi Scheme — backend

Built in 5 hours at a hackathon in Budapest. It works. Mostly.

    uvicorn backend.main:app --reload
    pytest
    python benchmark/benchmark_feed.py

Endpoints: `/health`, `/feed?limit=50`, `/users/{id}`
