# IF4052 BPMN - Online Food Ordering

This repository contains our BPMN assignment for IF4052. We model an online food ordering process. A customer places an order and pays for it. The restaurant confirmation and driver search then run in parallel, so driver availability is known before the order is sent for delivery. If the restaurant accepts the order and a driver is found, the driver delivers it. If the restaurant rejects the order, does not respond within 5 minutes, no driver is found, or driver search times out after 2 minutes, the payment is refunded. The cancellation path terminates the other still-running branch rather than waiting for its result.

The process runs on Camunda 7 Community Edition.

## Requirements

- Docker
- Camunda Modeler (select Camunda 7 when creating a diagram)

## Running the Project

Start Camunda, the mock API, and the external-task worker:

```bash
docker compose up -d
```

After about a minute, open http://localhost:8080/camunda and log in with `demo` / `demo`.
The worker polls Camunda automatically and calls the local mock API for shipping, payment, driver search, and refunds. These are simulations; no real payment or driver service is contacted.

To deploy the diagram, open the `.bpmn` file in Camunda Modeler, click Deploy, set the endpoint to `http://localhost:8080/engine-rest`, and include the `.form` files. The process can then be started from Tasklist.

To stop the project:

```bash
docker compose down
```

Note that `down` removes the container along with all process data. Use `docker compose stop` instead if you want to resume later.

## Project Structure

```
bpmn/       process diagram
forms/      forms for the start event and user tasks
workers/    service task workers
mock-api/   mock API called by the workers
```

To simulate no driver being available in PowerShell:

```powershell
$env:MOCK_DRIVER_AVAILABLE = "false"
docker compose up -d --force-recreate mock-api
```

Set it to `"true"` and recreate `mock-api` to restore the normal path. The worker returns `driverFound=false`, which takes the refund path and cancels the restaurant branch if it is still waiting.

To simulate a slow driver search and see the 2-minute BPMN timer fire:

```powershell
$env:MOCK_DRIVER_AVAILABLE = "true"
$env:MOCK_DRIVER_SEARCH_DELAY_MS = "150000"
docker compose up -d --force-recreate mock-api
```

The refund worker continues polling while this search is pending. Restore normal behavior by setting the delay to `"0"` and recreating `mock-api`.

## Group 7

| Name | Student ID |
|---|---|
| Alfian Hanif FY | 13523073 |
| Carlo Angkisan | 13523091 |
| Barru Adi Utomo | 13523101 |
| Azfa Radhiyya Hakim | 13523115 |
