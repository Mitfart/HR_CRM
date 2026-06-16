SENSITIVE_DELETE_ENTITIES = {
    "candidate",
    "resume",
    "resume_version",
    "candidate_file",
    "worker_contract",
}


def can_hard_delete(role: str, entity_type: str) -> bool:
    """Only admins may permanently delete sensitive HR records."""
    if role == "admin":
        return True
    return entity_type not in SENSITIVE_DELETE_ENTITIES
