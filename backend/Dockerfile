FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app/ ./app/

RUN mkdir -p /data/logos

EXPOSE 8000

# ponytail: 1 worker obligatorio — el ConnectionManager de WebSocket vive en memoria
# del proceso, asi que con >1 worker un broadcast solo alcanza a los clientes
# conectados a ESE worker (medido: 12-75% de eventos perdidos, no determinista).
# Un worker asyncio sobra para la escala de un bar y evita ademas la contencion de
# escritura de SQLite entre procesos. Si algun dia hace falta escalar horizontalmente,
# el paso es mover el broadcast a Redis pub/sub, no subir workers.
CMD ["gunicorn", "app.main:app", "-w", "1", "-k", "uvicorn.workers.UvicornWorker", "-b", "0.0.0.0:8000", "--access-logfile", "-"]
