"""
Muestra las tablas y la cantidad de filas de admin-local/data/vastec-admin.sqlite
(o de la ruta que se le pase como argumento) -- util para confirmar que un
archivo recien sincronizado desde Descargas (ver
actualizar_sqlite_desde_descargas.ps1) tiene el esquema y los datos esperados.

Uso:
    python ScriptsLocales/verificar_sqlite.py
    python ScriptsLocales/verificar_sqlite.py "ruta/al/archivo.sqlite"
"""
import sqlite3
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ruta = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "admin-local" / "data" / "vastec-admin.sqlite"

if not ruta.exists():
    print(f"ERROR: no se encontro {ruta}")
    sys.exit(1)

con = sqlite3.connect(str(ruta))
cur = con.cursor()
cur.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
tablas = [r[0] for r in cur.fetchall() if r[0] != "sqlite_sequence"]

print(f"{ruta}\n")
for t in tablas:
    cur.execute(f"SELECT COUNT(*) FROM {t}")
    print(f"  {t}: {cur.fetchone()[0]} fila(s)")

con.close()
