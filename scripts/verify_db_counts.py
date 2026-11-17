import sqlite3

conn = sqlite3.connect('backend/app/agri.db')
cur = conn.cursor()
tables = [r[0] for r in cur.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()]
counts = {}
for t in sorted(tables):
    if not t.startswith('sqlite_'):
        counts[t] = cur.execute(f"SELECT count(*) FROM {t}").fetchone()[0]

print("Database counts for backend/app/agri.db:")
for k, v in counts.items():
    print(f"  {k}: {v}")

