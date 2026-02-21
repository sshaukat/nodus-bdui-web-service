# Nodus BDUI Web Service (Live Preview)

## Run

### One-time foreground run

```bash
cd bdui-web-service
./start-service.sh
```

Open `http://127.0.0.1:8080`.

Custom host/port:

```bash
HOST=0.0.0.0 PORT=8090 ./start-service.sh
```

### Background service scripts

Restart service in background (single command):

```bash
cd bdui-web-service
./restart-service.sh
```

Stop background service:

```bash
cd bdui-web-service
./stop-service.sh
```

For background mode:

- PID file: `.server.pid`
- Log file: `.server.log`

## Endpoints

- `GET /api/health`
- `POST /api/decode-validate`

Example request:

```json
{
  "schema": {
    "type": "text",
    "value": "Hello"
  }
}
```
