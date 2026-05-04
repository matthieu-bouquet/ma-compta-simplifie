import Link from "next/link";
import { Building, DatabaseBackup, Settings } from "lucide-react";
import styles from "./parametres.module.css";

export default function ParametresPage() {
  return (
    <div>
      <h1 className="page-title">Paramètres</h1>
      
      <div className={styles.grid}>
        <Link 
          href="/parametres/entites"
          className={`card ${styles.cardLink}`}
        >
          <div className={styles.cardHeader}>
            <Building className={`w-8 h-8 ${styles.iconPrimary}`} />
            <h2 className={styles.cardTitle}>Entités</h2>
          </div>
          <p className={styles.cardText}>
            Gérer les entités pour lesquelles vous faites la comptabilité.
            Créez, modifiez et gérez leurs informations (dont la forme juridique).
          </p>
          <div className={styles.cardCtaPrimary}>Gérer les entités →</div>
        </Link>

        <Link
          href="/parametres/sauvegarde"
          className={`card ${styles.cardLink}`}
        >
          <div className={styles.cardHeader}>
            <DatabaseBackup className={`w-8 h-8 ${styles.iconWarning}`} />
            <h2 className={styles.cardTitle}>Sauvegarde</h2>
          </div>
          <p className={styles.cardText}>
            Télécharger une sauvegarde (données + documents) et restaurer une sauvegarde existante.
          </p>
          <div className={styles.cardCtaWarning}>Gérer les sauvegardes →</div>
        </Link>

        <Link 
          href="/parametres/plan-comptable"
          className={`card ${styles.cardLink}`}
        >
          <div className={styles.cardHeader}>
            <Settings className={`w-8 h-8 ${styles.iconSuccess}`} />
            <h2 className={styles.cardTitle}>Plan Comptable</h2>
          </div>
          <p className={styles.cardText}>
            Configurer le plan comptable global utilisé comme template pour la création 
            des exercices. Ajoutez, modifiez ou supprimez des comptes.
          </p>
          <div className={styles.cardCtaSuccess}>Configurer le plan →</div>
        </Link>
      </div>

      <div
        className={`card ${styles.infoCard}`}
      >
        <div className={styles.infoTitle}>Information</div>
        <p className={styles.infoText}>
          Les paramètres globaux s'appliquent à l'ensemble de l'application. 
          Le plan comptable configuré ici servira de modèle pour tous les nouveaux exercices créés.
        </p>
      </div>
    </div>
  );
}
