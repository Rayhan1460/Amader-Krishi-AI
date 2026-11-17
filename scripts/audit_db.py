import sqlite3
import sys
import os

db_path = sys.argv[1] if len(sys.argv) > 1 else 'backend/app/agri.db'
if not os.path.exists(db_path):
    print(f"Database not found at {db_path}")
    sys.exit(1)

con = sqlite3.connect(db_path)
cur = con.cursor()
tables = [r[0] for r in cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").fetchall()]
print(f"Database: {db_path}")
for t in sorted(tables):
    count = cur.execute(f"SELECT count(*) FROM [{t}]").fetchone()[0]
    print(f"  {t}: {count}")
con.close()

