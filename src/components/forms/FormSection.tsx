import type { LucideIcon } from 'lucide-react'
import styles from './forms.module.css'

type FormSectionProps = {
  icon: LucideIcon
  title: string
  description?: string
  children: React.ReactNode
}

export default function FormSection({ icon: Icon, title, description, children }: FormSectionProps) {
  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <div className={styles.sectionIcon} aria-hidden="true">
          <Icon size={18} />
        </div>
        <div>
          <div className={styles.sectionTitle}>{title}</div>
          {description ? <div className={styles.sectionDescription}>{description}</div> : null}
        </div>
      </div>
      {children}
    </div>
  )
}
