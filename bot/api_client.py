"""HTTP-клиент для общения бота с backend API."""
import httpx
from bot.config import API_URL


async def save_message(application_id: str, channel: str, direction: str, text: str) -> None:
    async with httpx.AsyncClient(base_url=API_URL) as client:
        await client.post("/api/bot/messages", json={
            "application_id": application_id,
            "channel": channel,
            "direction": direction,
            "text": text,
        })


async def update_application(
    application_id: str,
    search_params: dict | None = None,
    status: str | None = None,
    manager_notes: str | None = None,
) -> None:
    payload: dict = {}
    if search_params is not None:
        payload["search_params"] = search_params
    if status is not None:
        payload["status"] = status
    if manager_notes is not None:
        payload["manager_notes"] = manager_notes
    if not payload:
        return
    async with httpx.AsyncClient(base_url=API_URL) as client:
        await client.patch(f"/api/applications/{application_id}", json=payload)


async def get_bot_scripts() -> list[dict]:
    async with httpx.AsyncClient(base_url=API_URL) as client:
        res = await client.get("/api/bot/scripts")
        res.raise_for_status()
        return res.json()


async def get_match(match_id: str) -> dict | None:
    """Возвращает данные о предложении (match) по ID."""
    async with httpx.AsyncClient(base_url=API_URL) as client:
        res = await client.get(f"/api/matches/{match_id}")
        if res.status_code == 404:
            return None
        res.raise_for_status()
        return res.json()


async def update_match_status(match_id: str, status: str) -> None:
    """Обновляет статус предложения (accepted / declined)."""
    async with httpx.AsyncClient(base_url=API_URL) as client:
        await client.patch(
            f"/api/matches/{match_id}",
            json={"status": status},
        )


async def get_application(application_id: str) -> dict | None:
    """Возвращает данные заявки по ID."""
    async with httpx.AsyncClient(base_url=API_URL) as client:
        res = await client.get(f"/api/applications/{application_id}")
        if res.status_code == 404:
            return None
        res.raise_for_status()
        return res.json()
