# IF4052 BPMN - Online Food Ordering

This repository contains our BPMN assignment for IF4052. We model an online food ordering process. A customer places an order and pays for it, after which the restaurant decides whether to accept or reject the order. If the order is accepted, the system assigns a driver who then delivers the order. If the restaurant rejects the order or does not respond within 5 minutes, the payment is refunded to the customer.

The process runs on Camunda 7 Community Edition.

## Requirements

- Docker
- Camunda Modeler (select Camunda 7 when creating a diagram)
- Node.js

## Running the Project

Start Camunda:

```bash
docker compose up -d
```

After about a minute, open http://localhost:8080/camunda and log in with `demo` / `demo`.

To deploy the diagram, open the `.bpmn` file in Camunda Modeler, click Deploy, set the endpoint to `http://localhost:8080/engine-rest`, and include the `.form` files. The process can then be started from Tasklist.

To stop Camunda:

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

## Group 7

| Name | Student ID |
|---|---|
| Alfian Hanif FY | 13523073 |
| Carlo Angkisan | 13523091 |
| Barru Adi Utomo | 13523101 |
| Azfa Radhiyya Hakim | 13523115 |
