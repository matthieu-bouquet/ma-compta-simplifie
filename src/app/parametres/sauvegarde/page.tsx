import ParametreLayout from '@/components/ParametreLayout'
import BackupClientPage from './BackupClientPage'

export default function BackupPage() {
  return (
    <ParametreLayout
      title="Sauvegarde"
      description="Exporter les données (et documents) et restaurer une sauvegarde au même format."
    >
      <BackupClientPage />
    </ParametreLayout>
  )
}

