# Nodus BDUI Web Service (Live Preview)

## Run

### One-time foreground run

```bash
cd /Users/srsalak2/Documents/Projects/Nodus/bdui-web-service
./run-server.sh
```

Open `http://127.0.0.1:8080`.

Custom host/port:

```bash
HOST=0.0.0.0 PORT=8090 ./start-server.sh
```

### Background service scripts

Restart service in background (single command):

```bash
cd /Users/srsalak2/Documents/Projects/Nodus/bdui-web-service
./restart-service.sh
```

Stop background service:

```bash
cd /Users/srsalak2/Documents/Projects/Nodus/bdui-web-service
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
