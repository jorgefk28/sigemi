import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { changePassword } from '../../api/auth';
import { ApiError } from '../../api/http';
import { Btn } from '../../components/Btn';
import { FormField, INPUT_CLASSES, fieldDescribedBy } from '../../components/FormField';
import { loadToken } from '../../session/sessionStore';

/**
 * SEG-U09 · Cambiar contraseña (P3).
 *
 * Backing requirement: UCE-SEG-08 pasos 2-8. The only thing this form decides is
 * that the two typed passwords are equal (R4, it never travels to the backend).
 * "The current password is correct" and "the new one is strong enough" are the
 * backend's rules (R1/R3) and arrive as `400` with `campo`.
 */

const PASSWORD_HINT = 'Mínimo 8 caracteres, con al menos una letra y un dígito.';

interface FormValues {
  contrasena_actual: string;
  contrasena_nueva: string;
  repetir_contrasena: string;
}

const NO_VALUES: FormValues = {
  contrasena_actual: '',
  contrasena_nueva: '',
  repetir_contrasena: '',
};

function validate(values: FormValues): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!values.contrasena_actual) {
    errors.contrasena_actual = 'Ingresá tu contraseña actual';
  }
  if (!values.contrasena_nueva) {
    errors.contrasena_nueva = 'Ingresá la nueva contraseña';
  }
  if (!values.repetir_contrasena) {
    errors.repetir_contrasena = 'Repetí la nueva contraseña';
  } else if (values.repetir_contrasena !== values.contrasena_nueva) {
    errors.repetir_contrasena = 'Las contraseñas no coinciden';
  }

  return errors;
}

export function ChangePasswordPage() {
  const navigate = useNavigate();
  const token = loadToken();

  const [values, setValues] = useState<FormValues>(NO_VALUES);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function changeValue(field: keyof FormValues, value: string) {
    setValues((previous) => ({ ...previous, [field]: value }));
    setErrors((previous) => {
      const next = { ...previous };
      delete next[field];
      return next;
    });
  }

  async function save() {
    if (saving) {
      return;
    }

    const localErrors = validate(values);
    setErrors(localErrors);
    setGeneralError(null);
    if (Object.keys(localErrors).length > 0) {
      return;
    }

    setSaving(true);
    try {
      await changePassword(token, {
        contrasena_actual: values.contrasena_actual,
        contrasena_nueva: values.contrasena_nueva,
      });
      setValues(NO_VALUES);
      setSaved(true);
    } catch (error) {
      // R3/R1: the backend names the field that failed.
      if (error instanceof ApiError && error.campo) {
        setErrors({ [error.campo]: error.message });
      } else if (error instanceof ApiError) {
        setGeneralError(error.message);
      } else {
        setGeneralError('No se pudo cambiar la contraseña');
      }
    } finally {
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
          Cambiar contraseña
        </h1>
        <Btn onClick={() => navigate('/perfil')}>Volver</Btn>
      </div>

      {saved ? (
        <div className="mt-6 max-w-xl rounded-md border border-gray-200 bg-white p-4">
          <p role="status" className="text-sm text-gray-800">
            Tu contraseña se actualizó correctamente.
          </p>
          <Btn className="mt-3" variant="primary" onClick={() => navigate('/perfil')}>
            Volver a mi perfil
          </Btn>
        </div>
      ) : (
        <form
          aria-label="Cambio de contraseña"
          className="mt-6 max-w-xl rounded-md border border-gray-200 bg-white p-4"
          onSubmit={handleSubmit}
        >
          <FormField
            id="contrasena_actual"
            label="Contraseña actual"
            error={errors.contrasena_actual}
          >
            <input
              id="contrasena_actual"
              name="contrasena_actual"
              type="password"
              autoComplete="current-password"
              value={values.contrasena_actual}
              onChange={(event) => changeValue('contrasena_actual', event.target.value)}
              className={INPUT_CLASSES}
              aria-invalid={errors.contrasena_actual ? true : undefined}
              aria-describedby={fieldDescribedBy(
                'contrasena_actual',
                errors.contrasena_actual,
              )}
            />
          </FormField>

          <FormField
            id="contrasena_nueva"
            label="Nueva contraseña"
            error={errors.contrasena_nueva}
            hint={PASSWORD_HINT}
          >
            <input
              id="contrasena_nueva"
              name="contrasena_nueva"
              type="password"
              autoComplete="new-password"
              value={values.contrasena_nueva}
              onChange={(event) => changeValue('contrasena_nueva', event.target.value)}
              className={INPUT_CLASSES}
              aria-invalid={errors.contrasena_nueva ? true : undefined}
              aria-describedby={fieldDescribedBy(
                'contrasena_nueva',
                errors.contrasena_nueva,
                PASSWORD_HINT,
              )}
            />
          </FormField>

          <FormField
            id="repetir_contrasena"
            label="Repetir nueva contraseña"
            error={errors.repetir_contrasena}
          >
            <input
              id="repetir_contrasena"
              name="repetir_contrasena"
              type="password"
              autoComplete="new-password"
              value={values.repetir_contrasena}
              onChange={(event) => changeValue('repetir_contrasena', event.target.value)}
              className={INPUT_CLASSES}
              aria-invalid={errors.repetir_contrasena ? true : undefined}
              aria-describedby={fieldDescribedBy(
                'repetir_contrasena',
                errors.repetir_contrasena,
              )}
            />
          </FormField>

          {generalError && (
            <div role="alert" className="mb-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700">
              <p>{generalError}</p>
              <Btn className="mt-2" onClick={() => void save()}>
                Reintentar
              </Btn>
            </div>
          )}

          <div className="mt-6 flex items-center justify-end gap-2 border-t border-gray-200 pt-4">
            <Btn onClick={() => navigate('/perfil')}>Cancelar</Btn>
            <Btn type="submit" variant="primary" disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar'}
            </Btn>
          </div>
        </form>
      )}
    </div>
  );
}
