from sqlalchemy.orm import Session

from app.models.models import Notification, NotificationType


def notify(
    db: Session,
    user_id: str | None,
    type: NotificationType,
    title: str,
    message: str | None = None,
    link: str | None = None,
) -> None:
    """Ajoute une notification à la session en cours, sans la valider (pas de commit).

    L'appelant doit faire son db.commit() habituel juste après : la notification
    est ainsi enregistrée dans la même transaction que l'action qui la déclenche
    (rendez-vous, document, facture...), et ne peut jamais exister sans elle.
    """
    if not user_id:
        return
    db.add(Notification(user_id=user_id, type=type, title=title, message=message, link=link))
