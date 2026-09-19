"""Feed service. Returns the latest posts with author info and like counts."""
from .database import get_conn


def get_feed(limit: int = 50) -> list[dict]:
    conn = get_conn()
    cur = conn.cursor()
    posts = cur.execute("SELECT * FROM posts").fetchall()
    # sort newest first
    posts = sorted(posts, key=lambda p: p["created_at"], reverse=True)

    feed = []
    for post in posts[:limit]:
        author = cur.execute("SELECT * FROM users WHERE id = ?", (post["user_id"],)).fetchone()
        likes = cur.execute("SELECT * FROM likes WHERE post_id = ?", (post["id"],)).fetchall()
        # trending score: how many *pro* users liked this post
        pro_likes = 0
        for like in likes:
            liker = cur.execute("SELECT plan FROM users WHERE id = ?", (like["user_id"],)).fetchone()
            if liker and liker["plan"] == "pro":
                pro_likes += 1
        feed.append(
            {
                "id": post["id"],
                "body": post["body"],
                "created_at": post["created_at"],
                "author": {"id": author["id"], "handle": author["handle"], "plan": author["plan"]},
                "likes": len(likes),
                "pro_likes": pro_likes,
            }
        )
    conn.close()
    return feed
