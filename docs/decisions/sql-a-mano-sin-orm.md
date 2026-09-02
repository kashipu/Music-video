# SQL a mano, sin ORM

**Estado:** vigente · **Registrada el:** 2026-09-02

## Qué se decidió

Las consultas se escriben como cadenas SQL y se ejecutan con `aiosqlite`. Sin
SQLAlchemy, sin SQLModel, sin capa de repositorio.

## Por qué, de verdad

Coherente con [[sqlite-como-base]]: sin ORM el stack es más pequeño y las
consultas son explícitas. Para un esquema de 16 tablas es defendible.

## Qué obliga

- **139 `execute()`** repartidos entre `routers/` y `services/`, de los cuales
  126 están **dentro de los routers** — donde `RULES.md` dice que no deben estar.
- **`db.commit()` no hace nada** en la implementación actual: 45 llamadas dan una
  sensación de atomicidad que no existe. Borrar un bar son 10 `DELETE` sueltos sin
  transacción (F3).
- **No hay inyección de dependencias**: `Depends(get_db)` está definido y no se
  usa nunca. Cada archivo de tests reinventa su `monkeypatch` (INT-10).
- Filas leídas por **índice posicional** en los `SELECT` anchos: agregar una
  columna en medio rompe lectores silenciosamente (BE-7).

## Costo de salida

**Alto**, y no se recomienda pagarlo. La auditoría concluye que migrar a un ORM
o a arquitectura hexagonal sería sobreingeniería para este dominio.

Lo que sí paga, y es lo único que se toma prestado de hexagonal: **invertir la
dependencia de la base** — pasar de `get_db()` global a `Depends(get_db)` con la
conexión explícita. Habilita transacciones de verdad y elimina el `monkeypatch`
por servicio. Es F3.
