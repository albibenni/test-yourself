# ACID Properties Quiz

This quiz is designed to test your understanding of the [[ACID]] properties in database systems, based on the provided documentation.

## Foundational Questions

**1. What does the acronym ACID stand for in the context of databases?**
- A. Atomicity, Concurrency, Isolation, Durability
- B. Atomicity, Consistency, Isolation, Durability
- C. Availability, Consistency, Integrity, Durability
- D. Atomicity, Consistency, Independence, Durability

**2. Which ACID property ensures that a transaction is treated as a single "all or nothing" unit?**
- A. Consistency
- B. Isolation
- C. Durability
- D. Atomicity

**3. What is the primary purpose of the 'Durability' property in ACID?**
- A. To ensure transactions do not interfere with each other.
- B. To guarantee that committed transactions survive system failures.
- C. To maintain database constraints during operations.
- D. To allow partial transaction execution.

## Intermediate Questions

**4. In a Node.js implementation using explicit database queries, what command is typically issued immediately after catching an error during a transaction?**
- A. `BEGIN`
- B. `COMMIT`
- C. `ROLLBACK`
- D. `RELEASE`

**5. In Java applications using the Spring Framework, how are ACID properties typically managed in the application code?**
- A. By manually writing `BEGIN`, `COMMIT`, and `ROLLBACK` SQL statements.
- B. Through the declarative `@Transactional` annotation.
- C. By configuring the `DatabaseClient` connection string.
- D. By enforcing consistency constraints within the database engine itself without application logic.

**6. Which ACID property is responsible for ensuring that multiple concurrent transactions appear to execute sequentially, preventing them from interfering with each other?**
- A. Atomicity
- B. Consistency
- C. Isolation
- D. Durability

## Advanced Questions

**7. When configuring Isolation levels (e.g., READ COMMITTED vs SERIALIZABLE), what is the primary trade-off being made?**
- A. Database storage space vs retrieval speed.
- B. Strictness of data integrity vs system performance and concurrency.
- C. The length of time data is stored vs how quickly it is backed up.
- D. The ability to use ORMs vs writing raw SQL queries.

**8. In a fund transfer scenario (debiting account A, crediting account B), what occurs if the `Consistency` property is violated during the credit phase (e.g., an invalid account state triggers an error)?**
- A. The database attempts to automatically correct the invalid account state.
- B. The transaction pauses and waits for manual intervention.
- C. The `Atomicity` property ensures the database state is left completely unchanged, reverting the successful debit.
- D. The database switches to a lower Isolation level to force the transaction through.

---

## Detailed Solutions

**1. Correct Answer: B**
*Explanation*: ACID stands for Atomicity, Consistency, Isolation, and Durability. These are the four pillars that guarantee database transactions are processed reliably.

**2. Correct Answer: D**
*Explanation*: Atomicity is explicitly defined as the "all or nothing" property. It ensures that a transaction is treated as a single logical unit. If any operation within the transaction fails, the entire transaction fails, preventing partial updates.

**3. Correct Answer: B**
*Explanation*: Durability guarantees that once a transaction has been successfully committed, its changes are permanent and will remain committed even in the event of a system crash or power outage.

**4. Correct Answer: C**
*Explanation*: When explicit transaction management is used (as shown in the generic DB client pattern), errors caught in a `try...catch` block trigger a `ROLLBACK` command. This undoes any partial changes made prior to the error, enforcing Atomicity.

**5. Correct Answer: B**
*Explanation*: The Spring Framework abstracts away manual transaction management (like explicit `BEGIN` or `COMMIT` blocks) using the declarative `@Transactional` annotation, which automatically handles commits on success and rollbacks on thrown exceptions.

**6. Correct Answer: C**
*Explanation*: Isolation determines how transaction integrity is visible to others. It ensures that concurrent transactions do not interfere with each other, making them appear as if they were executed sequentially.

**7. Correct Answer: B**
*Explanation*: The documentation notes that configuring the Isolation level trades off performance for stricter data integrity. Higher isolation levels (like SERIALIZABLE) provide strict integrity but can reduce concurrency and system performance compared to lower levels (like READ COMMITTED).

**8. Correct Answer: C**
*Explanation*: This highlights the interaction between Consistency and Atomicity. If a consistency constraint is violated during the transaction (causing an error), the transaction fails. Atomicity then takes over via a rollback to ensure no partial state (like the initial debit) is persisted, leaving the database completely unchanged.
