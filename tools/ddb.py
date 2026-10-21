"""ddb.py - a DuckDB connection with the few spatial functions the bake scripts use. Loads the real
spatial extension when it's installed; otherwise registers Python versions (GeoParquet geometry is WKB)."""
import duckdb
from shapely import wkb

def connect():
    con = duckdb.connect()
    try:
        con.sql('load spatial')
        return con
    except Exception:
        pass
    T = getattr(duckdb, 'typing', None) or duckdb.sqltypes
    B, D = T.BLOB, T.DOUBLE
    # core DuckDB has ST_AsWKB for the GEOMETRY type; the point coordinates come from Python
    con.create_function('_wkb_x', lambda g: None if g is None else wkb.loads(bytes(g)).centroid.x, [B], D, null_handling='special')
    con.create_function('_wkb_y', lambda g: None if g is None else wkb.loads(bytes(g)).centroid.y, [B], D, null_handling='special')
    con.sql('create macro ST_X(g) as _wkb_x(ST_AsWKB(g))'); con.sql('create macro ST_Y(g) as _wkb_y(ST_AsWKB(g))')
    return con
