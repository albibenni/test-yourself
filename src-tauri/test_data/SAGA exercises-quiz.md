- [[SAGA pattern]]
- [[SAGA and Kafka]] , [[Kafka and SAGA vs choreography quiz]], [[SAGA and Kafka]]

This quiz is designed to test your understanding of the **Saga Pattern**, focusing on coordination, failure management, and implementation challenges in a microservices environment.
## Part 1: Conceptual Knowledge (Multiple Choice)
**1. Why is the Saga Pattern preferred over Two-Phase Commit (2PC) in high-scale microservices?** x
- A) Saga ensures immediate atomicity across all databases.
- B) 2PC is too fast for modern databases to handle.
- C) Saga provides eventual consistency without locking resources for long periods.
- D) Saga eliminates the need for compensating transactions.

**2. In an Orchestration-based Saga, what is the role of the "Orchestrator"?**
- A) It acts as a message broker like Kafka or RabbitMQ.
- B) It centralizes the logic and tells each participant when to execute their transaction.
- C) It allows services to communicate directly with each other without a central point.
- D) It automatically undos database changes using SQL triggers.

**3. Which coordination approach is best suited for a small system with only 2 or 3 services?**
- A) Orchestration
- B) Choreography
- C) Monolithic Transaction
- D) Manual Intervention

**4. What does "Idempotency" mean in the context of a compensating transaction?**
- A) The transaction must always fail if called twice.
- B) The transaction must be executed in under 100ms.
- C) Making the same call multiple times has the same effect as making it once.
- D) The transaction must use a Global ID.
---
## Part 2: True or False x

1. **[ ]** The Saga pattern provides ACID-level isolation, meaning "dirty reads" are impossible.
2. **[ ]** A compensating transaction is designed to "undo" the effects of a committed local transaction.
3. **[ ]** Choreography is generally harder to debug and monitor as the number of services increases.
4. **[ ]** In a Saga, if Step 3 fails, the system must trigger compensating transactions for Step 1 and Step 2. x
---
## Part 3: Implementation & Design

**Scenario: A Travel Booking Saga**
You are designing a travel app. The flow is:
1. **Book Flight** $\rightarrow$ 2. **Book Hotel** $\rightarrow$ 3. **Rent Car**.

**The Challenge:**
The "Book Hotel" step succeeds, but "Rent Car" fails because no cars are available.
1. **Write the pseudocode logic** for the compensating transactions required to return the system to a consistent state.
2. **Status Check:** During the time between "Book Flight" and the final "Rent Car" success/failure, what "Status" should the Flight Booking record have to prevent the user from thinking the trip is fully confirmed?
---
## Part 4: Short Answer
1. Explain how a **Correlation ID** helps with "Observability" in a distributed Saga.
2. In the Java example provided in the text, why is the `restoreStock` method in the `InventoryController` considered the "Compensating Transaction"?

---
### Answer Key (Check your work!)
**Part 1:**
1. **C** (2PC locks resources, which hurts scalability; Saga uses local transactions).
2. **B** (It’s the "central brain").
3. **B** (Choreography is simpler for small flows but gets messy for complex ones).
4. **C** (Critical for retries in distributed systems).

**Part 2:**
1. **False** (Isolation is a key challenge; Sagas often suffer from dirty reads).
2. **True**.
3. **True** (No central place to see the state of the workflow).
4. **True**.
**Part 3:**
5. _Logic:_ Call `cancelHotel()` and `cancelFlight()`.
6. _Status:_ "PENDING" or "PROCESSING".
**Part 4:**
7. A Correlation ID allows developers to search logs across multiple different service databases/log files to see the entire history of one specific request.
8. Because it is the logic that runs only when a subsequent step in the Saga fails, designed to reverse the `deductStock` action.