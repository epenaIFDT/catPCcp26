"""
Exporta la tabla "productos" de admin-local/data/vastec-admin.sqlite a CSV.

Incluye TODAS las columnas (crudo + simplificado lado a lado, igual que se
ve en un visor SQLite) excepto las puramente internas: "rowid_pk" (clave
interna autoincremental, no aporta nada al negocio) y "datos_json" (blob de
respaldo que duplica el resto de columnas). Ver admin-local/RESUMEN-PROYECTO.md
seccion 5 para el detalle del esquema.

Las columnas booleanas (LAN/WLAN/HDMI/etc.) se detectan automaticamente por
su tipo declarado en el esquema (INTEGER, tri-estado 0/1/NULL) y se
convierten a "Si"/"No"/"" para que el CSV sea legible sin tener que
recordar la convencion 0/1.

Solo usa la libreria estandar de Python (sqlite3 + csv) — no hace falta
instalar nada.
"""
import csv
import sqlite3
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DB_PATH = ROOT / "admin-local" / "data" / "vastec-admin.sqlite"
OUTPUT_PATH = Path(__file__).resolve().parent / "Data" / "productos_completo.csv"

COLUMNAS_EXCLUIDAS = {"rowid_pk", "datos_json"}


def obtener_columnas(cursor):
    cursor.execute("PRAGMA table_info(productos)")
    columnas = []
    for _cid, nombre, tipo, *_resto in cursor.fetchall():
        if nombre in COLUMNAS_EXCLUIDAS:
            continue
        columnas.append((nombre, tipo))
    return columnas


def formatear_valor(valor, tipo):
    if valor is None:
        return ""
    if tipo == "INTEGER":
        # Las unicas columnas INTEGER de "productos" (aparte de rowid_pk,
        # ya excluida) son los booleanos tri-estado LAN/WLAN/HDMI/etc.
        return "Si" if valor else "No"
    return valor


def main():
    if not DB_PATH.exists():
        print(f"ERROR: no se encontro {DB_PATH}")
        print('Abri el panel admin (admin-local/index.html) al menos una vez para que se genere la base de datos.')
        sys.exit(1)

    con = sqlite3.connect(str(DB_PATH))
    cur = con.cursor()

    columnas = obtener_columnas(cur)
    if not columnas:
        print("ERROR: no se pudo leer el esquema de la tabla 'productos'.")
        sys.exit(1)

    nombres_columnas = [c[0] for c in columnas]
    tipos_columnas = [c[1] for c in columnas]

    columnas_sql = ", ".join(f'"{n}"' for n in nombres_columnas)
    cur.execute(f"SELECT {columnas_sql} FROM productos ORDER BY categoria, marca, modelo")
    filas = cur.fetchall()
    con.close()

    if not filas:
        print("ADVERTENCIA: la tabla 'productos' esta vacia (sube un Excel en el panel admin primero).")

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_PATH, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f, delimiter=",")
        writer.writerow(nombres_columnas)
        for fila in filas:
            writer.writerow([formatear_valor(v, t) for v, t in zip(fila, tipos_columnas)])

    print(f"OK: {len(filas)} producto(s) exportado(s) a {OUTPUT_PATH}")
    print(f"Columnas: {len(nombres_columnas)}")


if __name__ == "__main__":
    main()
