from sqlalchemy import create_engine, text
from sqlalchemy.engine.url import make_url
from .database import Base, engine, SQLALCHEMY_DATABASE_URL


def ensure_db_exists():
    print("Checking database existence...")

    url = make_url(SQLALCHEMY_DATABASE_URL)

    # 1. SQLite Handling - Nothing to do for creation (handled by create_all)
    if url.drivername.startswith("sqlite"):
        return

    # 2. MySQL / PostgreSQL Handling
    db_name = url.database

    # Construct a URL to connect to the server root (without specific DB)
    if url.drivername.startswith("postgresql"):
        server_url = url.set(database="postgres")
    elif url.drivername.startswith("mysql"):
        server_url = url.set(database="")
    else:
        return

    if db_name:
        try:
            tmp_engine = create_engine(server_url)
            with tmp_engine.connect() as conn:
                conn = conn.execution_options(isolation_level="AUTOCOMMIT")

                if url.drivername.startswith("mysql"):
                    conn.execute(
                        text(
                            f"CREATE DATABASE IF NOT EXISTS `{db_name}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
                        )
                    )

                elif url.drivername.startswith("postgresql"):
                    check_query = text(
                        f"SELECT 1 FROM pg_database WHERE datname = '{db_name}'"
                    )
                    exists = conn.execute(check_query).scalar()

                    if not exists:
                        conn.execute(text(f'CREATE DATABASE "{db_name}"'))

        except Exception as e:
            print(f"Warning: Automatic database creation failed: {e}")


def init_db():
    # 1. Ensure DB exists (for MySQL/PG)
    ensure_db_exists()

    # 2. Create Tables
    # This is safe to call multiple times (checkfirst=True by default)
    Base.metadata.create_all(bind=engine)
    print("Database initialized.")

    # 3. Simple Migration for linked_family_id
    try:
        with engine.connect() as conn:
            conn = conn.execution_options(isolation_level="AUTOCOMMIT")
            try:
                conn.execute(text("SELECT linked_family_id FROM regions LIMIT 1"))
            except Exception:
                print("Migrating: Adding linked_family_id to regions table...")
                # SQLite and Postgres support ADD COLUMN
                # Note: MySQL might require type length, using TEXT to be safe or VARCHAR(255)
                # But here we use String equivalent.
                conn.execute(text("ALTER TABLE regions ADD COLUMN linked_family_id VARCHAR(255)"))
                print("Migration successful.")
    except Exception as e:
        print(f"Migration check failed (ignorable if fresh db): {e}")
