"""Create (or repair) the first administrator account.

The API has no self-registration and no bootstrap endpoint: `POST /usuarios`
requires an authenticated administrator, so a fresh database cannot be entered
at all. This script is the documented way out, and it is deliberately a script
and not a migration: `AGENTS.md` forbids credentials or hashes inside a
migration.

Usage, from ``backend/`` with the project virtualenv:

    .\\.venv\\Scripts\\python.exe scripts\\crear_admin.py --correo admin@sigemi.local --contrasena Secreta123

Idempotent: if the e-mail already exists it only reports it, unless
``--reset-contrasena`` is passed, which replaces the stored hash (that is also
how a forgotten password is recovered). The password rule is the same one the
API enforces (R3): at least 8 characters, one letter and one digit.
"""

from __future__ import annotations

import argparse
import re
import sys
import uuid
from pathlib import Path

from sqlalchemy import select

# Running `python scripts/crear_admin.py` puts `scripts/` on `sys.path`; the
# application package lives one level up.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.security import hash_password  # noqa: E402
from app.db.session import SessionLocal  # noqa: E402
from app.models.access import Rol, Usuario, UsuarioRol  # noqa: E402

PATRON_CONTRASENA = re.compile(r"^(?=.*[A-Za-z])(?=.*\d).{8,}$")


def _validar_contrasena(valor: str) -> str:
    if not PATRON_CONTRASENA.match(valor):
        raise SystemExit(
            "La contraseña debe tener al menos 8 caracteres, una letra y un número."
        )
    return valor


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--correo", default="admin@sigemi.local")
    parser.add_argument("--contrasena", required=True)
    parser.add_argument("--nombre", default="Admin")
    parser.add_argument("--apellido", default="SIGEMI")
    parser.add_argument(
        "--reset-contrasena",
        action="store_true",
        help="replace the stored hash when the user already exists",
    )
    args = parser.parse_args()

    correo = args.correo.strip().lower()
    contrasena = _validar_contrasena(args.contrasena)

    with SessionLocal() as db:
        rol = db.scalar(select(Rol).where(Rol.codigo == "administrador"))
        if rol is None:
            print(
                "No existe el rol 'administrador': corré `alembic upgrade head` primero.",
                file=sys.stderr,
            )
            return 1

        usuario = db.scalar(select(Usuario).where(Usuario.correo_electronico == correo))

        if usuario is None:
            usuario = Usuario(
                id=uuid.uuid4(),
                nombre=args.nombre.strip(),
                apellido=args.apellido.strip(),
                correo_electronico=correo,
                contrasena_hash=hash_password(contrasena),
                estado="activo",
                intentos_fallidos=0,
            )
            db.add(usuario)
            db.flush()
            db.add(UsuarioRol(id=uuid.uuid4(), usuario_id=usuario.id, rol_id=rol.id))
            db.commit()
            print(f"Administrador creado: {correo}")
            return 0

        if not args.reset_contrasena:
            print(
                f"El usuario {correo} ya existe. Usá --reset-contrasena para cambiar la clave."
            )
            return 0

        usuario.contrasena_hash = hash_password(contrasena)
        usuario.estado = "activo"
        usuario.intentos_fallidos = 0
        usuario.bloqueado_hasta = None
        ya_tiene_rol = db.scalar(
            select(UsuarioRol).where(
                UsuarioRol.usuario_id == usuario.id, UsuarioRol.rol_id == rol.id
            )
        )
        if ya_tiene_rol is None:
            db.add(UsuarioRol(id=uuid.uuid4(), usuario_id=usuario.id, rol_id=rol.id))
        db.commit()
        print(f"Contraseña restablecida y cuenta reactivada: {correo}")
        return 0


if __name__ == "__main__":
    raise SystemExit(main())
