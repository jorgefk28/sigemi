import { useEffect, useState, type FormEvent } from 'react';
import type { User } from '../../api/auth';
import { ApiError } from '../../api/http';
import {
  createUser,
  listRoles,
  replaceRoles,
  updateUser,
  type Rol,
  type UserCreate,
  type UserUpdate,
} from '../../api/usuarios';
import { Btn } from '../../components/Btn';
import { FormField, INPUT_CLASSES, fieldDescribedBy } from '../../components/FormField';
import { loadToken } from '../../session/sessionStore';

/**
 * SEG-U03 · Alta y edición de usuario (P3).
 *
 * Backing requirement: UCE-SEG-02 pasos 3-6. Every decision of the panel lives
 * on the backend: the form only maps a `400` with `campo` onto the offending
 * field (R3) and never decides a rule itself. The password exists only on
 * create (D1); deactivating is not this form's business.
 */

interface FormValues {
  nombre: string;
  apellido: string;
  correo_electronico: string;
  contrasena: string;
}

const PASSWORD_HINT = 'Mínimo 8 caracteres, con al menos una letra y un dígito.';

function initialValues(usuario?: User): FormValues {
  return {
    nombre: usuario?.nombre ?? '',
    apellido: usuario?.apellido ?? '',
    correo_electronico: usuario?.correo_electronico ?? '',
    contrasena: '',
  };
}

/**
 * Locally-required fields only. Messages are the backend's wording, so the user
 * never sees two different texts for the same rule; strength, format and
 * uniqueness are the backend's (S6).
 */
function validate(values: FormValues, roles: string[], isCreate: boolean): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!values.nombre.trim()) {
    errors.nombre = 'El nombre no puede estar vacío';
  }
  if (!values.apellido.trim()) {
    errors.apellido = 'El apellido no puede estar vacío';
  }
  if (!values.correo_electronico.trim()) {
    errors.correo_electronico = 'El correo electrónico no puede estar vacío';
  }
  if (isCreate && !values.contrasena) {
    errors.contrasena = 'La contraseña debe tener al menos 8 caracteres';
  }
  if (roles.length === 0) {
    errors.roles = 'Debe asignar al menos un rol al usuario';
  }

  return errors;
}

/** Only the fields that actually changed; an empty `PATCH` is a `400`. */
function changesOf(usuario: User, values: FormValues): UserUpdate {
  const cambios: UserUpdate = {};

  if (values.nombre.trim() !== usuario.nombre) {
    cambios.nombre = values.nombre.trim();
  }
  if (values.apellido.trim() !== usuario.apellido) {
    cambios.apellido = values.apellido.trim();
  }
  const correo = values.correo_electronico.trim().toLowerCase();
  if (correo !== usuario.correo_electronico) {
    cambios.correo_electronico = correo;
  }

  return cambios;
}

interface UsuarioFormPageProps {
  /** Absent in create mode. */
  usuario?: User;
  onCancel: () => void;
  onSaved: () => void;
  onForbidden: () => void;
}

export function UsuarioFormPage({
  usuario,
  onCancel,
  onSaved,
  onForbidden,
}: UsuarioFormPageProps) {
  const token = loadToken();
  const isCreate = usuario === undefined;

  const [values, setValues] = useState<FormValues>(() => initialValues(usuario));
  const [selectedRoles, setSelectedRoles] = useState<string[]>(() => usuario?.roles ?? []);
  const [catalog, setCatalog] = useState<Rol[] | null>(null);
  const [catalogError, setCatalogError] = useState(false);
  const [catalogAttempt, setCatalogAttempt] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // The role selector reads the closed catalog; it never writes it (S3).
  useEffect(() => {
    let cancelled = false;
    setCatalogError(false);

    listRoles(token)
      .then((pagina) => {
        if (!cancelled) {
          setCatalog(pagina.items);
        }
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }
        if (error instanceof ApiError && error.status === 403) {
          onForbidden();
          return;
        }
        setCatalog([]);
        setCatalogError(true);
      });

    return () => {
      cancelled = true;
    };
  }, [token, catalogAttempt, onForbidden]);

  function changeValue(field: keyof FormValues, value: string) {
    setValues((previous) => ({ ...previous, [field]: value }));
    setErrors((previous) => {
      const next = { ...previous };
      delete next[field];
      return next;
    });
  }

  function toggleRole(codigo: string) {
    setSelectedRoles((previous) =>
      previous.includes(codigo)
        ? previous.filter((actual) => actual !== codigo)
        : [...previous, codigo],
    );
    setErrors((previous) => {
      const next = { ...previous };
      delete next.roles;
      return next;
    });
  }

  /** Role codes in catalog order, so the request and the audit entry are stable. */
  function orderedRoles(): string[] {
    if (!catalog) {
      return selectedRoles;
    }
    return catalog
      .filter((rol) => selectedRoles.includes(rol.codigo))
      .map((rol) => rol.codigo);
  }

  async function save() {
    if (saving) {
      return;
    }

    const localErrors = validate(values, selectedRoles, isCreate);
    setErrors(localErrors);
    setGeneralError(null);
    if (Object.keys(localErrors).length > 0) {
      return;
    }

    const roles = orderedRoles();
    setSaving(true);

    try {
      if (isCreate) {
        const payload: UserCreate = {
          nombre: values.nombre,
          apellido: values.apellido,
          correo_electronico: values.correo_electronico,
          contrasena: values.contrasena,
          roles,
        };
        await createUser(token, payload);
      } else {
        const cambios = changesOf(usuario, values);
        if (Object.keys(cambios).length > 0) {
          await updateUser(token, usuario.id, cambios);
        }
        const previous = [...usuario.roles].sort().join(',');
        const next = [...roles].sort().join(',');
        if (previous !== next) {
          await replaceRoles(token, usuario.id, roles);
        }
      }
      onSaved();
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        onForbidden();
        return;
      }
      // R3: a field-scoped rejection belongs on the field, not in a banner.
      if (error instanceof ApiError && error.campo) {
        setErrors({ [error.campo]: error.message });
      } else {
        setGeneralError('No se pudo guardar el usuario');
      }
      setSaving(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void save();
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <h1 className="text-[28px] font-bold leading-tight tracking-tight text-gray-900">
          {isCreate ? 'Nuevo usuario' : 'Editar usuario'}
        </h1>
        <Btn onClick={onCancel}>Cancelar</Btn>
      </div>

      <form
        aria-label={isCreate ? 'Alta de usuario' : 'Edición de usuario'}
        className="mt-6 max-w-xl rounded-md border border-gray-200 bg-white p-4"
        onSubmit={handleSubmit}
      >
        <FormField id="nombre" label="Nombre" error={errors.nombre}>
          <input
            id="nombre"
            name="nombre"
            type="text"
            autoComplete="off"
            maxLength={100}
            value={values.nombre}
            onChange={(event) => changeValue('nombre', event.target.value)}
            className={INPUT_CLASSES}
            aria-invalid={errors.nombre ? true : undefined}
            aria-describedby={fieldDescribedBy('nombre', errors.nombre)}
          />
        </FormField>

        <FormField id="apellido" label="Apellido" error={errors.apellido}>
          <input
            id="apellido"
            name="apellido"
            type="text"
            autoComplete="off"
            maxLength={100}
            value={values.apellido}
            onChange={(event) => changeValue('apellido', event.target.value)}
            className={INPUT_CLASSES}
            aria-invalid={errors.apellido ? true : undefined}
            aria-describedby={fieldDescribedBy('apellido', errors.apellido)}
          />
        </FormField>

        <FormField id="correo_electronico" label="Correo electrónico" error={errors.correo_electronico}>
          <input
            id="correo_electronico"
            name="correo_electronico"
            type="email"
            autoComplete="off"
            maxLength={255}
            value={values.correo_electronico}
            onChange={(event) => changeValue('correo_electronico', event.target.value)}
            className={INPUT_CLASSES}
            aria-invalid={errors.correo_electronico ? true : undefined}
            aria-describedby={fieldDescribedBy('correo_electronico', errors.correo_electronico)}
          />
        </FormField>

        {/* D1: the password is set on create and changed from its own screen. */}
        {isCreate && (
          <FormField
            id="contrasena"
            label="Contraseña"
            error={errors.contrasena}
            hint={PASSWORD_HINT}
          >
            <input
              id="contrasena"
              name="contrasena"
              type="password"
              autoComplete="new-password"
              value={values.contrasena}
              onChange={(event) => changeValue('contrasena', event.target.value)}
              className={INPUT_CLASSES}
              aria-invalid={errors.contrasena ? true : undefined}
              aria-describedby={fieldDescribedBy(
                'contrasena',
                errors.contrasena,
                PASSWORD_HINT,
              )}
            />
          </FormField>
        )}

        <fieldset
          className="mb-4"
          aria-invalid={errors.roles ? true : undefined}
          aria-describedby={errors.roles ? 'roles-error' : undefined}
        >
          <legend className="mb-1 block text-sm text-body">Roles</legend>

          {catalogError ? (
            <div>
              <p className="text-sm text-gray-800">No se pudieron cargar los roles</p>
              <Btn className="mt-2" onClick={() => setCatalogAttempt((valor) => valor + 1)}>
                Reintentar
              </Btn>
            </div>
          ) : catalog === null ? (
            <p className="text-xs text-muted">Cargando roles…</p>
          ) : (
            <div className="flex flex-col gap-2">
              {catalog.map((rol) => (
                <label key={rol.codigo} className="flex items-center gap-2 text-sm text-gray-800">
                  <input
                    type="checkbox"
                    checked={selectedRoles.includes(rol.codigo)}
                    onChange={() => toggleRole(rol.codigo)}
                  />
                  {rol.nombre}
                </label>
              ))}
            </div>
          )}

          {errors.roles && (
            <p id="roles-error" className="mt-1 text-xs text-red-700">
              {errors.roles}
            </p>
          )}
        </fieldset>

        {generalError && (
          <div role="alert" className="mb-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700">
            <p>{generalError}</p>
            <Btn className="mt-2" onClick={() => void save()}>
              Reintentar
            </Btn>
          </div>
        )}

        <div className="mt-6 flex items-center justify-end gap-2 border-t border-gray-200 pt-4">
          <Btn onClick={onCancel}>Cancelar</Btn>
          <Btn type="submit" variant="primary" disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar'}
          </Btn>
        </div>
      </form>
    </div>
  );
}
