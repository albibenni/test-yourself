- [[Computer Science/Languages/Java/Basic/Static]]
## The Static Quiz

### Foundational Questions

**1. A class `Config` has a static variable `counter`. If 100 instances of `Config` are created, how many copies of `counter` exist in memory?**
- A) 100, one per instance
- B) Exactly one, shared by all instances
- C) Two: one in the Heap and one in the Metaspace
- D) Zero until the first instance calls it

**2. Inside a static method, which of the following is legal?**
- A) Using the `this` keyword to reference the current object
- B) Reading a non-static instance field directly
- C) Calling another static method of the same class
- D) Using `super` to reach the parent's instance state

**3. What does a static import (e.g., `import static java.lang.Math.*;`) allow you to do?**
- A) Load a class into the Metaspace before the program starts
- B) Import only the non-static members of a class
- C) Make all imported members implicitly `final`
- D) Use a class's static members without qualifying them with the class name

### Intermediate Questions

**4. A class contains two static initialization blocks and a constructor. If `main` creates three objects of this class, how many times does each static block execute in total?**
- A) Once each, when the class is first loaded by the ClassLoader
- B) Three times each, once per object creation
- C) Once each, but only after the first constructor call finishes
- D) It depends on whether the blocks appear before or after the constructor

**5. Why does adding objects to a `public static List` risk a memory leak?**
- A) Static lists are duplicated into every thread's stack
- B) The Metaspace has a fixed size that overflows into the Heap
- C) Everything the list references stays reachable for as long as the class is loaded, so the GC cannot reclaim it
- D) `ArrayList` disables garbage collection for its elements by default

**6. Which statement about a static nested class is TRUE?**
- A) It can only be instantiated from inside the outer class
- B) It can access the `private static` members of its enclosing class
- C) It holds an implicit reference to an instance of the outer class
- D) It must be declared `final` to be instantiated externally

### Advanced Questions

**7. Several threads concurrently execute `counter++` on a `static int counter`. Which change makes the increments safe?**
- A) Declare the field `static final` so the JVM protects it
- B) Replace it with a `static AtomicInteger` and call `incrementAndGet()`
- C) Make the field `private` so only one class can touch it
- D) Nothing is needed; static fields are locked by the JVM during writes

**8. According to the note, what does Java 26's `LazyConstant` (JEP 526) provide?**
- A) Constants that are recomputed on every access to stay fresh
- B) A way to make instance fields behave like static ones
- C) Automatic synchronization for mutable static collections
- D) Static constants whose values are computed only on first access, improving startup time

---
---

## Answer Key

### Part 1: Quiz Answers

**1. Answer: B**
**Explanation:** A static variable belongs to the class, not to instances: the JVM allocates a single shared copy in the Metaspace when the class is loaded. Creating 100 objects (or zero) doesn't change that — the variable exists as soon as the class loads, which also rules out D.

**2. Answer: C**
**Explanation:** Static methods can freely call other static members of the class. They cannot use `this` (A) or `super` (D) because no instance is bound to the call, and they cannot directly touch instance fields (B) — the JVM would have no way to know *which* object's field to read.

**3. Answer: D**
**Explanation:** Static imports let you write `PI` or `assertEquals(...)` without the `Math.` / `Assertions.` prefix. The note warns that overuse pollutes the namespace. They have nothing to do with class loading (A) or `final` semantics (C), and they import static members specifically — the opposite of B.

**4. Answer: A**
**Explanation:** Static blocks run exactly once, when the ClassLoader first loads the class — before any object exists. The number of constructor calls afterward is irrelevant (B), they run *before* the first constructor, not after (C), and their position relative to the constructor in the source only matters relative to *other static initializers*, not to instance creation (D).

**5. Answer: C**
**Explanation:** A static field is a GC root tied to the class lifecycle. As long as the class stays loaded, the list — and transitively every object it holds — remains strongly reachable, so the Garbage Collector can never reclaim them. This is why the note flags static collections as one of the most common memory-leak causes in Java. The stack (A), Metaspace overflow (B), and `ArrayList` behavior (D) are red herrings.

**6. Answer: B**
**Explanation:** A static nested class can access the `private static` members of its enclosing class — exactly what makes it ideal for the Builder pattern (`new User.Builder().build()`). Unlike a regular inner class, it carries *no* implicit reference to an outer instance (C) and needs no outer instance to be created, from anywhere (A). There is no `final` requirement (D).

**7. Answer: B**
**Explanation:** `counter++` is a read-modify-write sequence, not an atomic operation, so concurrent threads can interleave and lose updates. The note recommends synchronization, `volatile`, or `java.util.concurrent.atomic` classes — `AtomicInteger.incrementAndGet()` performs the whole increment atomically. `final` would forbid mutation entirely (A), access modifiers don't affect thread interleaving (C), and the JVM performs no automatic locking on static writes (D).

**8. Answer: D**
**Explanation:** JEP 526's `LazyConstant` defines static constants whose values are computed lazily — only when first accessed — which significantly optimizes startup time (e.g., deferring expensive `Logger` construction). It computes the value once, not on every access (A), and is unrelated to instance fields (B) or collection synchronization (C).
