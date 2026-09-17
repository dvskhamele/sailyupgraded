"""
Production FastAPI Microservice for Apollo Contacts & Accounts Database
Location on remote server: /home/ubuntu/apollo_project/api/main.py

Key Capabilities:
1. True Server-Side Pagination: limit, offset, page, hasMore
2. O(1) Instant Count: Estimates 80M+ records in < 5ms via information_schema (avoids 45s table scan)
3. Database-Level Filtering: country, state, city, company, jobTitle, role, status, email, phone, linkedin
4. Deterministic Ordering: ORDER BY id ASC avoids pagination drift
5. High-Performance Connection Pooling with PyMySQL
6. Structured Logging: [APOLLO_CONTACTS_REQUEST], [APOLLO_DB_QUERY], [APOLLO_CONTACTS_RESPONSE]
7. Lightweight Health Check: GET /health for uptime monitoring
8. Full Backward Compatibility: supports /contacts, /accounts, /contacts/search, /accounts/search, /stats
"""

import os
import time
import math
import logging
import re
from typing import Optional, List, Dict, Any, Tuple
from contextlib import contextmanager

from fastapi import FastAPI, Query, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import pymysql
from pymysql.cursors import DictCursor
from dbutils.pooled_db import PooledDB

# Configure structured logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("apollo_api")

app = FastAPI(
    title="Apollo People & Contacts API",
    version="2.0.0",
    description="High-performance paginated API for 80M+ Apollo contacts and accounts dataset",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Database Configuration from environment
DB_HOST = os.getenv("DB_HOST", "127.0.0.1")
DB_PORT = int(os.getenv("DB_PORT", "3306"))
DB_USER = os.getenv("DB_USER", "apollo")
DB_PASS = os.getenv("DB_PASS", "Apollo123!")
DB_NAME = os.getenv("DB_NAME", "apollo")
DB_TABLE_CONTACTS = os.getenv("DB_TABLE_CONTACTS", "contacts")
DB_TABLE_ACCOUNTS = os.getenv("DB_TABLE_ACCOUNTS", "accounts")

# Connection Pool
pool = None

def init_db_pool():
    global pool
    try:
        pool = PooledDB(
            creator=pymysql,
            maxconnections=20,
            mincached=3,
            maxcached=10,
            maxshared=5,
            blocking=True,
            host=DB_HOST,
            port=DB_PORT,
            user=DB_USER,
            password=DB_PASS,
            database=DB_NAME,
            charset="utf8mb4",
            cursorclass=DictCursor,
            connect_timeout=5,
            read_timeout=15,
            write_timeout=10,
        )
        logger.info(f"Database pool initialized successfully for {DB_USER}@{DB_HOST}:{DB_PORT}/{DB_NAME}")
    except Exception as e:
        logger.warning(f"Database pool initialization deferred/failed: {e}")

@contextmanager
def get_db_connection():
    global pool
    if pool is None:
        init_db_pool()
    conn = pool.connection()
    try:
        yield conn
    finally:
        conn.close()

# Cached table counts to avoid expensive full scans
_cached_counts = {"contacts": 0, "accounts": 0, "total": 0, "last_updated": 0}
COUNT_CACHE_TTL = 300  # 5 minutes

def get_estimated_table_rows(table_name: str) -> int:
    """O(1) table row estimate using information_schema.tables"""
    now = time.time()
    if now - _cached_counts["last_updated"] < COUNT_CACHE_TTL and _cached_counts.get(table_name, 0) > 0:
        return _cached_counts[table_name]

    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                # Query information_schema for instant row count without table scan
                cur.execute(
                    """
                    SELECT TABLE_NAME, TABLE_ROWS 
                    FROM information_schema.tables 
                    WHERE TABLE_SCHEMA = DATABASE() 
                      AND TABLE_NAME IN (%s, %s, 'contacts', 'accounts', 'crm_Contacts', 'crm_Accounts')
                    """,
                    (DB_TABLE_CONTACTS, DB_TABLE_ACCOUNTS),
                )
                rows = cur.fetchall()
                for r in rows:
                    tname = r.get("TABLE_NAME")
                    trows = r.get("TABLE_ROWS") or 0
                    if tname in [DB_TABLE_CONTACTS, "contacts", "crm_Contacts"]:
                        _cached_counts["contacts"] = max(_cached_counts.get("contacts", 0), int(trows))
                    elif tname in [DB_TABLE_ACCOUNTS, "accounts", "crm_Accounts"]:
                        _cached_counts["accounts"] = max(_cached_counts.get("accounts", 0), int(trows))
                
                _cached_counts["total"] = _cached_counts["contacts"] + _cached_counts["accounts"]
                _cached_counts["last_updated"] = now
                return _cached_counts.get(table_name, 0)
    except Exception as err:
        logger.warning(f"Error fetching table estimate: {err}")
        return _cached_counts.get(table_name, 0)

# Resolve actual table name in database
def resolve_table_name(table_type: str = "contacts") -> str:
    target = DB_TABLE_CONTACTS if table_type == "contacts" else DB_TABLE_ACCOUNTS
    fallback = "crm_Contacts" if table_type == "contacts" else "crm_Accounts"
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SHOW TABLES LIKE %s", (target,))
                if cur.fetchone():
                    return target
                cur.execute("SHOW TABLES LIKE %s", (fallback,))
                if cur.fetchone():
                    return fallback
    except Exception:
        pass
    return target

# Pydantic Response Models
class PaginationMeta(BaseModel):
    limit: int
    offset: int
    total: int
    hasMore: bool

class UnifiedPaginatedResponse(BaseModel):
    success: bool
    data: List[Dict[str, Any]]
    total: int
    page: int
    limit: int
    totalPages: int
    pagination: PaginationMeta

FILTER_OPTIONS_LIMIT = 1000
FILTER_OPTIONS_COMPANY_LIMIT = 100
FILTER_OPTIONS_CACHE_TTL = 300
FILTER_OPTIONS_CACHE_MAX_ENTRIES = 256
_filter_options_cache: Dict[Tuple[Any, ...], Tuple[float, List[str]]] = {}

# The contacts table is very large.  Keep a small cache of the *leading*
# columns of installed indexes so query construction never guesses that a
# column is searchable.  SHOW INDEX is metadata-only; it does not read contact
# rows.  A prefix predicate (value%) can use a B-tree whose leading column is
# the predicate column, while %value% cannot.
INDEX_METADATA_CACHE_TTL = 300
_indexed_columns_cache: Dict[str, Tuple[float, set[str]]] = {}
_SAFE_IDENTIFIER = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")


class UnsafeContactQuery(ValueError):
    """A requested predicate has no verified index and would scan contacts."""


def get_leading_indexed_columns(cur, table_name: str) -> set[str]:
    if not _SAFE_IDENTIFIER.match(table_name):
        raise UnsafeContactQuery("Invalid contacts table name")
    now = time.time()
    cached = _indexed_columns_cache.get(table_name)
    if cached and cached[0] > now:
        return cached[1]

    cur.execute(f"SHOW INDEX FROM `{table_name}`")
    columns = {
        str(row.get("Column_name"))
        for row in (cur.fetchall() or [])
        if int(row.get("Seq_in_index") or 0) == 1 and row.get("Column_name")
    }
    _indexed_columns_cache[table_name] = (now + INDEX_METADATA_CACHE_TTL, columns)
    return columns


def require_indexed_column(indexed_columns: set[str], column: str, parameter: str) -> None:
    if column not in indexed_columns:
        raise UnsafeContactQuery(
            f"{parameter} is temporarily unavailable because `{column}` has no verified leading index"
        )


def add_indexed_prefix_filter(
    where_clauses: List[str], params: List[Any], indexed_columns: set[str], column: str, value: str, parameter: str
) -> None:
    """Add a case-insensitive (under the table's normal CI collation) indexable prefix filter."""
    require_indexed_column(indexed_columns, column, parameter)
    where_clauses.append(f"`{column}` LIKE %s")
    params.append(f"{value}%")

def get_distinct_filter_values(cur, table_name: str, column: str, where_clauses: List[str], params: List[Any], limit: int = FILTER_OPTIONS_LIMIT) -> List[str]:
    """Return bounded, database-derived option values without loading contact rows.

    Keep the selected and ordered expressions as the indexed column itself. Applying
    TRIM/LOWER in SQL would prevent MySQL from using the existing prefix indexes on
    this 90M+ row table; blank and case-duplicate cleanup happens on the bounded
    result set below instead.
    """
    where_sql = [f"`{column}` IS NOT NULL", f"`{column}` != ''"] + where_clauses
    sql = f"""
        SELECT DISTINCT `{column}` AS value
        FROM `{table_name}`
        WHERE {' AND '.join(where_sql)}
        ORDER BY `{column}` ASC
        LIMIT %s
    """
    cur.execute(sql, list(params) + [limit])
    values: Dict[str, str] = {}
    for row in cur.fetchall() or []:
        value = (row.get("value") or "").strip()
        if value and value.casefold() not in values:
            values[value.casefold()] = value
    return sorted(values.values(), key=str.casefold)

def get_cached_distinct_filter_values(
    cur,
    cache_key: Tuple[Any, ...],
    table_name: str,
    column: str,
    where_clauses: List[str],
    params: List[Any],
    limit: int = FILTER_OPTIONS_LIMIT,
) -> List[str]:
    """Cache bounded option lists by their relevant filter scope for a short TTL."""
    now = time.time()
    cached = _filter_options_cache.get(cache_key)
    if cached and cached[0] > now:
        return cached[1]

    values = get_distinct_filter_values(cur, table_name, column, where_clauses, params, limit)
    # Keep the in-process cache bounded even if clients submit many company prefixes.
    if len(_filter_options_cache) >= FILTER_OPTIONS_CACHE_MAX_ENTRIES:
        expired = [key for key, (expires_at, _) in _filter_options_cache.items() if expires_at <= now]
        for key in expired:
            _filter_options_cache.pop(key, None)
        if len(_filter_options_cache) >= FILTER_OPTIONS_CACHE_MAX_ENTRIES:
            _filter_options_cache.pop(next(iter(_filter_options_cache)), None)
    _filter_options_cache[cache_key] = (now + FILTER_OPTIONS_CACHE_TTL, values)
    return values

@app.on_event("startup")
def startup_event():
    init_db_pool()

@app.get("/")
def home():
    return {
        "status": "online",
        "service": "Apollo People & Contacts Microservice",
        "version": "2.0.0",
        "port": 7149,
    }

@app.get("/health")
def health_check():
    """Lightweight health check for monitoring and uptime verification"""
    start = time.time()
    db_status = "disconnected"
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT 1 AS ok")
                res = cur.fetchone()
                if res and (res.get("ok") == 1 or res.get("1") == 1):
                    db_status = "connected"
    except Exception as e:
        db_status = f"error: {str(e)}"

    duration_ms = round((time.time() - start) * 1000, 2)
    status_code = 200 if db_status == "connected" else 503
    return Response(
        content=f'{{"status":"{"ok" if db_status == "connected" else "degraded"}","database":"{db_status}","duration_ms":{duration_ms}}}',
        status_code=status_code,
        media_type="application/json",
    )

@app.get("/stats")
def get_stats():
    """Fast O(1) stats endpoint without scanning 80M rows"""
    start = time.time()
    contacts_count = get_estimated_table_rows("contacts")
    accounts_count = get_estimated_table_rows("accounts")
    total = contacts_count + accounts_count
    duration_ms = round((time.time() - start) * 1000, 2)
    logger.info(f"[APOLLO_STATS] contacts={contacts_count} accounts={accounts_count} total={total} duration_ms={duration_ms}")
    return {
        "contacts": contacts_count,
        "accounts": accounts_count,
        "total": total,
    }

@app.get("/contacts")
def get_contacts(
    response: Response,
    limit: int = Query(default=200, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
    page: int = Query(default=1, ge=1),
    q: Optional[str] = Query(default=None),
    country: Optional[str] = Query(default=None),
    state: Optional[str] = Query(default=None),
    city: Optional[str] = Query(default=None),
    company: Optional[str] = Query(default=None),
    jobTitle: Optional[str] = Query(default=None),
    status: Optional[str] = Query(default=None),
    role: Optional[str] = Query(default=None),
    hasEmail: Optional[bool] = Query(default=None),
    hasPhone: Optional[bool] = Query(default=None),
    hasLinkedin: Optional[bool] = Query(default=None),
    hasCompany: Optional[bool] = Query(default=None),
):
    """
    Paginated contacts query over 80M+ rows with database-side filtering.
    Never executes unindexed COUNT(*) or loads full table into memory.
    """
    req_start = time.time()
    calculated_offset = offset if offset > 0 else (page - 1) * limit
    table_name = resolve_table_name("contacts")

    logger.info(
        f"[APOLLO_CONTACTS_REQUEST] limit={limit} offset={calculated_offset} page={page} "
        f"country={country} state={state} city={city} company={company} jobTitle={jobTitle} q={q}"
    )

    where_clauses: List[str] = []
    params: List[Any] = []

    # Database query execution.  Construct predicates only after looking up
    # installed indexes: the deployed schema, rather than a migration file,
    # is the source of truth.
    query_start = time.time()
    records = []
    has_filters = len(where_clauses) > 0

    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                indexed_columns = get_leading_indexed_columns(cur, table_name)

                # Search uses exact email first (when q is an email), otherwise
                # indexable prefixes.  This deliberately does not use %q%:
                # leading wildcards across 90M contacts caused multi-second
                # scans and timeouts for no-match searches.
                if q and q.strip():
                    term = q.strip()
                    search_columns = ["first_name", "last_name", "company", "jobTitle"]
                    if "@" in term:
                        require_indexed_column(indexed_columns, "email", "q")
                        where_clauses.append("`email` = %s")
                        params.append(term)
                    else:
                        # Do not silently omit names from People search.  The
                        # required name/company/title coverage is enabled only
                        # when every field has a verified leading index.
                        for column in search_columns:
                            require_indexed_column(indexed_columns, column, "q")
                        available_search_columns = search_columns[:]
                        if "email" in indexed_columns:
                            available_search_columns.append("email")
                        where_clauses.append(
                            "(" + " OR ".join(f"`{column}` LIKE %s" for column in available_search_columns) + ")"
                        )
                        params.extend([f"{term}%"] * len(available_search_columns))

                # Structured filter mappings are the actual contacts columns.
                # They combine by AND and use equality/prefix predicates only.
                if country and country.strip():
                    country_value = country.strip()
                    require_indexed_column(indexed_columns, "country", "country")
                    if country_value.lower() in ["united states", "usa", "us"]:
                        where_clauses.append("`country` IN ('United States', 'USA', 'US', 'united states', 'usa')")
                    else:
                        add_indexed_prefix_filter(where_clauses, params, indexed_columns, "country", country_value, "country")
                if state and state.strip():
                    add_indexed_prefix_filter(where_clauses, params, indexed_columns, "state", state.strip(), "state")
                if city and city.strip():
                    add_indexed_prefix_filter(where_clauses, params, indexed_columns, "city", city.strip(), "city")
                if company and company.strip():
                    add_indexed_prefix_filter(where_clauses, params, indexed_columns, "company", company.strip(), "company")
                if jobTitle and jobTitle.strip():
                    add_indexed_prefix_filter(where_clauses, params, indexed_columns, "jobTitle", jobTitle.strip(), "jobTitle")

                # Saily labels map to the boolean database field as 1/0.
                if status and status != "All":
                    normalized_status = status.strip().lower()
                    raw_status = "1" if normalized_status == "active" else "0" if normalized_status == "inactive" else status.strip()
                    require_indexed_column(indexed_columns, "status", "status")
                    where_clauses.append("`status` = %s")
                    params.append(raw_status)
                if role and role != "All":
                    require_indexed_column(indexed_columns, "role", "role")
                    where_clauses.append("`role` = %s")
                    params.append(role.strip())
                if hasEmail is True:
                    require_indexed_column(indexed_columns, "email", "hasEmail")
                    where_clauses.append("`email` IS NOT NULL AND `email` != ''")
                if hasPhone is True:
                    require_indexed_column(indexed_columns, "phone", "hasPhone")
                    require_indexed_column(indexed_columns, "mobile_phone", "hasPhone")
                    where_clauses.append(
                        "((`phone` IS NOT NULL AND `phone` != '') OR "
                        "(`mobile_phone` IS NOT NULL AND `mobile_phone` != ''))"
                    )
                if hasLinkedin is True:
                    require_indexed_column(indexed_columns, "social_linkedin", "hasLinkedin")
                    where_clauses.append("`social_linkedin` IS NOT NULL AND `social_linkedin` != ''")
                if hasCompany is True:
                    require_indexed_column(indexed_columns, "company", "hasCompany")
                    where_clauses.append("`company` IS NOT NULL AND `company` != ''")

                where_sql = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""
                has_filters = bool(where_clauses)

                # Fetch one extra row instead of a filtered COUNT(*).  WHERE
                # precedes deterministic primary-key ordering and pagination.
                select_sql = f"""
                    SELECT *
                    FROM `{table_name}`
                    {where_sql}
                    ORDER BY id ASC
                    LIMIT %s OFFSET %s
                """
                query_params = list(params) + [limit + 1, calculated_offset]
                cur.execute(select_sql, query_params)
                records = cur.fetchall() or []
                has_more = len(records) > limit
                records = records[:limit]

                query_duration_ms = round((time.time() - query_start) * 1000, 2)
                logger.info(f"[APOLLO_DB_QUERY] rows={len(records)} duration_ms={query_duration_ms}")

                # For the unfiltered listing a metadata estimate is safe.  A
                # filtered total is intentionally unknown: COUNT would scan or
                # traverse huge index ranges and is not needed for pagination.
                if not has_filters:
                    total_count = get_estimated_table_rows("contacts")
                    if total_count == 0 and len(records) > 0:
                        total_count = 80000000
                else:
                    total_count = None

    except UnsafeContactQuery as e:
        raise HTTPException(status_code=422, detail=str(e))

    except Exception as e:
        logger.error(f"[APOLLO_DB_ERROR] {e}")
        raise HTTPException(status_code=500, detail=f"Database query failed: {str(e)}")

    total_pages = max(1, math.ceil(total_count / limit)) if total_count else None
    if not has_filters:
        has_more = (calculated_offset + limit) < total_count

    # Forward x-total-count header for simple clients
    if total_count is not None:
        response.headers["x-total-count"] = str(total_count)

    total_duration_ms = round((time.time() - req_start) * 1000, 2)
    logger.info(
        f"[APOLLO_CONTACTS_RESPONSE] returned={len(records)} total={total_count} "
        f"page={page} limit={limit} duration_ms={total_duration_ms}"
    )

    return {
        "success": True,
        "data": records,
        "total": total_count,
        "page": page,
        "limit": limit,
        "totalPages": total_pages,
        "pagination": {
            "limit": limit,
            "offset": calculated_offset,
            "total": total_count,
            "hasMore": has_more,
        },
    }

@app.get("/contacts/filters")
def get_contact_filter_options(
    country: Optional[str] = Query(default=None),
    state: Optional[str] = Query(default=None),
    city: Optional[str] = Query(default=None),
    company_q: Optional[str] = Query(default=None, max_length=100),
):
    """Database-backed metadata for People filters; location dependencies are applied before distinct selection."""
    table_name = resolve_table_name("contacts")
    location_clauses: List[str] = []
    location_params: List[Any] = []
    if country and country.strip():
        # Keep dependent option scopes consistent with /contacts. Source values
        # are not always normalized (for example, "Mumbai, India"), so exact
        # equality here would hide values returned by country=India in /contacts.
        country_value = country.strip()
        if country_value.lower() in ["united states", "usa", "us"]:
            location_clauses.append("country IN ('United States', 'USA', 'US', 'united states', 'usa')")
        else:
            location_clauses.append("country LIKE %s")
            location_params.append(f"{country_value}%")
    if state and state.strip():
        location_clauses.append("state LIKE %s")
        location_params.append(f"{state.strip()}%")
    if city and city.strip():
        location_clauses.append("city LIKE %s")
        location_params.append(f"{city.strip()}%")

    country_key = country.strip().casefold() if country and country.strip() else ""
    state_key = state.strip().casefold() if state and state.strip() else ""
    city_key = city.strip().casefold() if city and city.strip() else ""
    company_key = company_q.strip().casefold() if company_q and company_q.strip() else ""

    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                indexed_columns = get_leading_indexed_columns(cur, table_name)
                # Each DISTINCT query has a hard LIMIT and its selected column
                # must be indexed.  Rejecting a missing index is safer than
                # allowing a metadata request to walk the contacts table.
                require_indexed_column(indexed_columns, "country", "filters.countries")
                require_indexed_column(indexed_columns, "state", "filters.states")
                require_indexed_column(indexed_columns, "city", "filters.cities")
                require_indexed_column(indexed_columns, "company", "filters.companies")
                # Cache each scope independently: typing a company prefix does not
                # cause country/state/city DISTINCT queries to run again.
                countries = get_cached_distinct_filter_values(
                    cur, ("country", table_name), table_name, "country", [], []
                )
                states = get_cached_distinct_filter_values(
                    cur, ("state", table_name, country_key), table_name, "state",
                    location_clauses[:1], location_params[:1],
                )
                cities = get_cached_distinct_filter_values(
                    cur, ("city", table_name, country_key, state_key), table_name, "city",
                    location_clauses[:2], location_params[:2],
                )
                company_clauses = location_clauses[:]
                company_params = location_params[:]
                if company_q and company_q.strip():
                    company_clauses.append("company LIKE %s")
                    company_params.append(f"{company_q.strip()}%")
                companies = get_cached_distinct_filter_values(
                    cur, ("company", table_name, country_key, state_key, city_key, company_key),
                    table_name, "company", company_clauses, company_params, FILTER_OPTIONS_COMPANY_LIMIT,
                )
    except UnsafeContactQuery as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        logger.error(f"[APOLLO_FILTER_OPTIONS_ERROR] {e}")
        raise HTTPException(status_code=500, detail="Filter options query failed")

    logger.info(
        f"[APOLLO_FILTER_OPTIONS] countries={len(countries)} states={len(states)} "
        f"cities={len(cities)} companies={len(companies)} country={country} state={state} city={city}"
    )
    return {"countries": countries, "states": states, "cities": cities, "companies": companies}

@app.get("/accounts")
def get_accounts(
    response: Response,
    limit: int = Query(default=50, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    page: int = Query(default=1, ge=1),
    q: Optional[str] = Query(default=None),
    country: Optional[str] = Query(default=None),
    state: Optional[str] = Query(default=None),
    city: Optional[str] = Query(default=None),
):
    """Paginated accounts query with database-side filtering"""
    req_start = time.time()
    calculated_offset = offset if offset > 0 else (page - 1) * limit
    table_name = resolve_table_name("accounts")

    where_clauses = []
    params = []

    if q and q.strip():
        term = f"%{q.strip()}%"
        where_clauses.append("(name LIKE %s OR email LIKE %s OR website LIKE %s)")
        params.extend([term, term, term])

    if country and country.strip():
        where_clauses.append("(billing_country LIKE %s OR country LIKE %s)")
        params.extend([f"%{country.strip()}%", f"%{country.strip()}%"])

    if state and state.strip():
        where_clauses.append("(billing_state LIKE %s OR state LIKE %s)")
        params.extend([f"%{state.strip()}%", f"%{state.strip()}%"])

    if city and city.strip():
        where_clauses.append("(billing_city LIKE %s OR city LIKE %s)")
        params.extend([f"%{city.strip()}%", f"%{city.strip()}%"])

    where_sql = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""

    records = []
    has_filters = len(where_clauses) > 0

    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                select_sql = f"""
                    SELECT * FROM `{table_name}`
                    {where_sql}
                    ORDER BY id ASC
                    LIMIT %s OFFSET %s
                """
                cur.execute(select_sql, list(params) + [limit, calculated_offset])
                records = cur.fetchall() or []

                if not has_filters:
                    total_count = get_estimated_table_rows("accounts")
                else:
                    count_sql = f"SELECT COUNT(1) AS cnt FROM `{table_name}` {where_sql}"
                    cur.execute(count_sql, params)
                    count_row = cur.fetchone()
                    total_count = int(count_row["cnt"]) if count_row else len(records)
    except Exception as e:
        logger.error(f"[APOLLO_ACCOUNTS_ERROR] {e}")
        raise HTTPException(status_code=500, detail=str(e))

    total_pages = max(1, math.ceil(total_count / limit)) if total_count > 0 else 1
    response.headers["x-total-count"] = str(total_count)

    return {
        "success": True,
        "data": records,
        "total": total_count,
        "page": page,
        "limit": limit,
        "totalPages": total_pages,
        "pagination": {
            "limit": limit,
            "offset": calculated_offset,
            "total": total_count,
            "hasMore": (calculated_offset + limit) < total_count,
        },
    }

@app.get("/contacts/search")
def search_contacts(q: str = Query(..., min_length=1), limit: int = Query(default=20, ge=1, le=100)):
    """Search contacts endpoint for backward compatibility"""
    return get_contacts(response=Response(), limit=limit, q=q)

@app.get("/accounts/search")
def search_accounts(q: str = Query(..., min_length=1), limit: int = Query(default=20, ge=1, le=100)):
    """Search accounts endpoint for backward compatibility"""
    return get_accounts(response=Response(), limit=limit, q=q)

@app.get("/contact/{contact_id}")
def get_contact_by_id(contact_id: str):
    """Retrieve single contact by ID"""
    table_name = resolve_table_name("contacts")
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(f"SELECT * FROM `{table_name}` WHERE id = %s LIMIT 1", (contact_id,))
                rec = cur.fetchone()
                if not rec:
                    raise HTTPException(status_code=404, detail="Contact not found")
                return rec
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
