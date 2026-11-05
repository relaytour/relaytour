import { useLingui } from '@lingui/react/macro'
import { Button, type FormInstance } from 'antd'

/**
 * Sélection rapide des contacts principaux (ADR 0011) parmi les personnes
 * convocables d'une réunion ou d'un sondage. Le bouton ajoute ces personnes au
 * champ `personneIds` du formulaire, sans retirer celles déjà choisies.
 */
export default function AjouterContactsPrincipaux({
  form,
  personnes,
}: {
  form: FormInstance
  personnes: readonly { personneId: string; contactPrincipal: boolean }[]
}) {
  const { t } = useLingui()
  const contacts = personnes
    .filter(p => p.contactPrincipal)
    .map(p => p.personneId)
  if (contacts.length === 0) return null
  const nombre = contacts.length
  return (
    <Button
      type="link"
      size="small"
      style={{ paddingInline: 0, marginTop: -16, marginBottom: 16 }}
      onClick={() => {
        const actuels = (form.getFieldValue('personneIds') ?? []) as string[]
        form.setFieldValue('personneIds', [
          ...new Set([...actuels, ...contacts]),
        ])
        void form.validateFields(['personneIds'])
      }}
    >
      {t`Ajouter les contacts principaux (${nombre})`}
    </Button>
  )
}
