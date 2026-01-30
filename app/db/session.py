import os
from dotenv import load_dotenv
import psycopg2
from urllib.parse import urlparse, parse_qs, urlencode

load_dotenv()

def db_session_factory():
    database_url = os.getenv("DATABASE_URL")

    if not database_url:
        raise ValueError("DATABASE_URL environment variable is not set")

    # Parse the URL and remove channel_binding if present (not supported by all psycopg2 versions)
    parsed = urlparse(database_url)
    query_params = parse_qs(parsed.query)

    # Remove channel_binding as it's not supported by psycopg2
    if 'channel_binding' in query_params:
        del query_params['channel_binding']

    # Rebuild the URL without channel_binding
    new_query = urlencode(query_params, doseq=True)
    clean_url = f"{parsed.scheme}://{parsed.netloc}{parsed.path}"
    if new_query:
        clean_url += f"?{new_query}"

    return psycopg2.connect(clean_url)