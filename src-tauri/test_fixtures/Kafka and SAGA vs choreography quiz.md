# Kafka and SAGA vs Choreography Quiz

**Reference Material**: [[SAGA and Kafka]]

## Part 1: Foundational Questions

**1. What is the primary difference between Choreography and Orchestration in the context of a Saga pattern using Kafka?**
- A) Choreography uses centralized commands; Orchestration relies on independent facts.
- B) Choreography relies on services reacting to events autonomously; Orchestration uses a central coordinator issuing commands.
- C) Choreography is recommended for complex systems (5+ services); Orchestration is better for simple systems (2-4 services).
- D) Choreography inherently handles idempotency automatically; Orchestration does not.

**2. In a Kafka-based Saga Choreography, how do services primarily communicate state changes?**
- A) Through direct synchronous REST API calls
- B) By executing centralized commands from a state machine
- C) By producing and consuming events from specific Kafka topics
- D) By sharing database triggers across microservices

**3. When using an Orchestrator with Kafka, what is the Orchestrator's primary responsibility?**
- A) Managing a decentralized web of service interactions without intervention
- B) Acting as a state machine that tracks the order lifecycle, issues specific commands, and triggers compensations
- C) Capturing changes from database transaction logs (CDC) to stream to Kafka
- D) Providing Exactly-Once Semantics (EOS) for all downstream producers

## Part 2: Intermediate Questions

**4. How does the Transactional Outbox Pattern solve the "Dual Write" problem in a Saga?**
- A) By ensuring that a local database update and the Kafka message publication happen atomically
- B) By retrying database operations multiple times before attempting to send a Kafka message
- C) By setting `processing.guarantee` to `exactly_once_v2` in Kafka properties
- D) By organizing topics logically into Fact Topics and Command Topics

**5. To ensure all events for a single order are processed in the correct sequence, which Kafka strategy should be utilized?**
- A) Create dynamically separate topics for each new order
- B) Use multiple Consumer Groups for the Payment service
- C) Use the `orderId` as the Partition Key
- D) Implement a Dead Letter Queue (DLQ) for out-of-order messages

**6. In Orchestration with Kafka, how should error handling for transient errors (e.g., database timeouts) typically be structured before giving up and triggering a compensation?**
- A) Immediately send a CancelCommand to the `saga-reply-topic`
- B) Rely on a Retry Topic, and eventually move the message to a Dead Letter Queue (DLQ) if max retries are exceeded
- C) Use Kafka Connect with Debezium to roll back the database directly
- D) Increase the `max.in.flight.requests.per.connection` configuration on the producer

## Part 3: Advanced Questions

**7. You notice occasionally a service finishes its task but crashes before committing its Kafka offset, causing Kafka to redeliver the message and triggering the task twice. Which combination of practices provides the most robust "fail-safe" approach against this duplicate execution?**
- A) Setting `acks: all` and using Spring Cloud Sleuth for tracing
- B) Relying entirely on Kafka's native `enable.idempotence: true` producer setting
- C) Using the Outbox pattern with Debezium and a Dead Letter Queue
- D) Implementing Idempotency Keys checked against a local database, preferably via Unique Constraints within a single `@Transactional` block

**8. Why is designing state changes as "Upserts" (Natural Idempotency) preferable in a Saga, and how does it manifest?**
- A) Upserts ensure the Transactional Outbox pattern processes faster by avoiding complex database row locks.
- B) Upserts guarantee the exact sequence of execution across partitions without the need for a Partition Key.
- C) Running an Upsert multiple times results in the exact same final state (e.g., `SET status = 'SHIPPED'`), directly mitigating the risks of duplicate message delivery.
- D) Upserts automatically trigger compensating transactions if a downstream service fails, removing the need for failure events.

---

## Answer Key & Explanations

**1. Correct Answer: B**
- **Explanation:** In Choreography, services react independently to "facts" (events) published to topics. In Orchestration, a central state machine explicitly manages the workflow and issues "commands" to services. A is backwards, C is backwards, and neither inherently handles idempotency (D).

**2. Correct Answer: C**
- **Explanation:** In a Choreography workflow, services produce events (e.g., `OrderCreated`) to a Kafka topic and other services act as consumers, reacting to those events to perform their own actions. They do not use REST calls or a centralized state machine.

**3. Correct Answer: B**
- **Explanation:** An Orchestrator acts as a central "conductor" (a state machine) that tracks the overall process, issues specific commands (e.g., `ProcessPayment`), listens for replies, and explicitly triggers compensations if there is a failure.

**4. Correct Answer: A**
- **Explanation:** The "Dual Write" problem occurs when a service must write to its database and send a message to Kafka. If one succeeds and the other fails (e.g., due to a crash), the system is left inconsistent. The Transactional Outbox pattern solves this by persisting the event alongside the business entity in the same database transaction, ensuring atomicity.

**5. Correct Answer: C**
- **Explanation:** Kafka guarantees message ordering only within a single partition. By using the `orderId` as the Partition Key, you ensure that all events related to that specific order are routed to the same partition, thus preserving their sequence.

**6. Correct Answer: B**
- **Explanation:** For transient errors, the standard approach is to move the message to a Retry Topic (e.g., `inventory-commands-retry-5s`). If it continues to fail after a set number of retries, it is moved to a Dead Letter Queue (DLQ). The Orchestrator can then monitor the DLQ to trigger the appropriate compensation.

**7. Correct Answer: D**
- **Explanation:** While Kafka's native idempotency (`enable.idempotence: true`) protects against producer retries, it does not solve consumer-side redelivery (e.g., crashing before committing the offset). The most robust fail-safe is handling idempotency locally in the service by using a Unique Business Key and Database Unique Constraints within a `@Transactional` block to prevent double processing.

**8. Correct Answer: C**
- **Explanation:** "Natural Idempotency" means that an operation can be applied multiple times without changing the result beyond the initial application. Upserts (or state-based updates like `SET status = 'SHIPPED'`) achieve this. Conversely, relative increments (`SET stock = stock - 1`) are not idempotent and can cause inconsistencies if a message is redelivered.