import pytest

from app import main


@pytest.mark.asyncio
async def test_database_size_alert_only_sends_above_threshold(monkeypatch):
    monkeypatch.setattr(main.settings, "database_path", "/tmp/barqueue.db")
    monkeypatch.setattr(main.settings, "db_size_alert_threshold_bytes", 400)
    monkeypatch.setattr(main, "_db_size_alerted", False)
    sent = []

    class Db:
        async def execute_fetchall(self, _query):
            return [("superadmin@repitela.com",)]

    async def get_test_db():
        return Db()

    async def send_email(*args):
        sent.append(args)

    monkeypatch.setattr(main, "get_db", get_test_db)
    monkeypatch.setattr(main.email_service, "send_email", send_email)
    monkeypatch.setattr(main.os.path, "getsize", lambda _path: 401)

    assert await main.check_database_size() is True
    assert sent[0][0] == "superadmin@repitela.com"

    monkeypatch.setattr(main.os.path, "getsize", lambda _path: 400)
    assert await main.check_database_size() is False
    assert len(sent) == 1
