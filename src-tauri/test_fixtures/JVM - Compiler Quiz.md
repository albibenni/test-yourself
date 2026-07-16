- [[Compiler and JVM]]
- [[JVM stack-heap and GC exercises]]
### The Quiz: Modern Java (2026) Internals
#### Phase 1: The `javac` Compiler
**1. What is the primary role of the `javac` compiler in modern Java?** 
A) To aggressively optimize code for the underlying CPU hardware 
B) To run garbage collection on unused source files 
C) To translate human-readable Java into platform-agnostic bytecode and enforce semantics 
D) To execute Java applications

**2. During which `javac` phase is the Abstract Syntax Tree (AST) built?** x
A) Annotation Processing 
B) Parse and Enter 
C) Flow and Semantic Analysis 
D) Desugaring

**3. What is a strict limitation of Annotation Processors during compilation?** 
A) They can only run once per compilation cycle 
B) They can modify existing source files 
C) They can generate new source files but cannot modify existing ones 
D) They bypass the AST entirely

**4. Which compiler phase verifies that local variables are initialized before use?** x
A) Bytecode Generation 
B) Desugaring 
C) Flow and Semantic Analysis 
D) Parse and Enter

**5. What does the "desugaring" process in `javac` do?** 
A) Removes comments and whitespaces to minify the `.class` file 
B) Encrypts the bytecode for security 
C) Translates high-level syntactic sugar into basic bytecode equivalents 
D) Replaces primitive types with wrapper classes

**6. How are lambda expressions invoked at the bytecode level after desugaring?** 
A) `invokevirtual` 
B) `invokestatic` 
C) `invokedynamic` 
D) `invokespecial`

**7. Does the `javac` compiler perform aggressive optimizations like loop unrolling?** 
A) Yes, always 
B) Yes, if the `-O` flag is passed 
C) No, it leaves hardware and runtime optimizations to the JVM's JIT compiler 
D) Only for loops with fewer than 10 iterations

**8. What is NOT found inside a compiled `.class` file?** 
A) Class metadata 
B) The constant pool 
C) The original `.java` source code comments 
D) Bytecode instructions

---
#### Phase 2: JVM Architecture & Memory

**9. What modern JVM feature slashes startup times by caching pre-processed class metadata?** 
A) Ahead-of-Time (AOT) compilation 
B) Generational ZGC 
C) JIT Tier 4 
D) AppCDS (Application Class Data Sharing)

**10. Which ClassLoader phase verifies bytecode for security and allocates memory for static variables?**  x
A) Loading 
B) Linking 
C) Initialization 
D) Instantiation

**11. Where do class metadata and method definitions reside in the modern JVM memory model?** 
A) Metaspace 
B) The Java Heap 
C) The OS Thread Stack 
D) Survivor Space

**12. Where is Metaspace located?** 
A) Inside the JVM Heap allocation 
B) In native OS memory 
C) In the L1 CPU Cache 
D) On disk

**13. What is a defining characteristic of Generational ZGC in 2026?** 
A) It requires the application to halt for seconds to clean memory 
B) It manages heap memory concurrently, resulting in sub-millisecond pauses 
C) It only collects garbage when the JVM is idle 
D) It completely disables garbage collection

**14. When are static blocks and static initializers executed during class loading?** x
A) Loading Phase 
B) Linking Phase 
C) Initialization Phase 
D) Metaspace Allocation Phase

**15. If a piece of bytecode attempts an illegal memory access, which component catches it?** x
A) The JIT Compiler 
B) The Garbage Collector 
C) The Operating System Kernel 
D) The Bytecode Verifier (during Linking)

**16. How does the JVM balance fast startup with peak throughput?** 
A) By interpreting code exclusively 
B) By using Tiered Compilation (Interpreter + JIT) 
C) By compiling everything to native machine code before startup 
D) By disabling garbage collection during startup

---
#### Phase 3: Project Loom & Virtual Threads
**17. What is the name of the underlying OS thread that executes a virtual thread?** 
A) Daemon Thread 
B) Green Thread 
C) Carrier Thread 
D) Supervisor Thread

**18. What internal construct allows a virtual thread to save its exact state and yield execution?** 
A) Continuation 
B) Promise 
C) Future 
D) Fiber Stack

**19. When a virtual thread blocks, where are its stack frames moved to during "unmounting"?** x
A) Metaspace 
B) Native OS Memory 
C) A temporary disk file 
D) The Java Heap

**20. Does unmounting a virtual thread require a context switch in the OS kernel?** 
A) Yes, it requires a heavy system call 
B) Only on Windows 
C) No, it happens entirely in user space within the JVM 
D) Only when heap memory is full

**21. What component is responsible for grabbing unmounted virtual threads and mounting them?** 
A) The OS Kernel Scheduler 
B) The JIT Compiler 
C) The JVM's internal ForkJoinPool scheduler 
D) The Garbage Collector

**22. How does the JVM know a blocked network I/O call is ready to resume?** 
A) It polls the connection every millisecond 
B) It relies on efficient OS primitives like `epoll` or `kqueue` 
C) It puts the thread to `sleep(10)` and checks again 
D) The network router sends an HTTP request to the JVM

**23. What happens during the "Mounting" of a virtual thread?** 
A) The JVM copies the thread's stack frames from the Heap back to a Carrier Thread 
B) The JVM creates a brand new OS thread 
C) The JIT compiler optimizes the thread's run method 
D) The thread is permanently pinned to a specific CPU core

**24. In Java 2026, what happens if a virtual thread enters a `synchronized` block?** 
A) It throws an exception 
B) It executes normally without pinning the carrier thread 
C) It pins the carrier thread and cannot be unmounted (like in JDK 21)
D) It converts the virtual thread into a platform thread permanently

---

#### Phase 4: JIT Compiler & Optimizations

**25. What is the primary advantage of the Tier 0 Interpreter?** 
A) It achieves the highest possible CPU throughput 
B) It uses the least amount of memory 
C) It allows the application to start immediately without waiting for compilation 
D) It eliminates the need for garbage collection

**26. What crucial task does the interpreter perform while running your code?**
A) Compiling bytecode to C++ 
B) Profiling method invocations to identify "hot" code 
C) Deleting unused `.class` files 
D) Pre-fetching data from the database

**27. Which compiler performs deep, aggressive, and speculative optimizations?** 
A) C1 Compiler 
B) C2 / Graal Compiler 
C) `javac` 
D) The Interpreter

**28. What triggers the JVM to throw away compiled native code and drop back to the interpreter?** 
A) A garbage collection pause 
B) Deoptimization (usually from a failed speculative assumption) 
C) A `StackOverflowError` 
D) The application running out of heap space

**29. What is "Inlining" in the context of the JIT compiler?** 
A) Moving variables from the heap to the stack 
B) Copying the bytecode of a called method directly into the calling method 
C) Compiling code on a single CPU thread 
D) Removing dead code from if-statements

**30. What optimization is applied if Escape Analysis proves an object never leaves a method?** x
A) Lock Elision 
B) Devirtualization 
C) Scalar Replacement 
D) Loop Unrolling

**31. How does Scalar Replacement handle the fields of an un-escaped object?** x
A) It serializes them to a fast SSD 
B) It dismantles them and stores them in CPU registers or the native stack
C) It moves them to the Metaspace 
D) It allocates them as a single block on the Heap

**32. What JVM optimization strips out interface lookups and hardcodes a direct CPU jump?** x
A) Escape Analysis 
B) Devirtualization (Monomorphic Dispatch) 
C) Lock Elision 
D) Inlining

---

#### Phase 5: Project Valhalla & Value Classes

**33. What historical 25-year-old JVM divide does Project Valhalla solve?** 
A) The divide between stack-allocated Primitives and heap-allocated References 
B) The divide between Windows and Linux execution 
C) The divide between AOT and JIT compilation 
D) The divide between checked and unchecked exceptions

**34. What keyword combination is used in Java 2026 to declare a Valhalla class with no identity?** 
A) `primitive class` 
B) `record` 
C) `value class` 
D) `struct`

**35. What is a strict requirement for a `value class`?** 
A) It must have a no-args constructor 
B) It must extend `java.lang.Value` 
C) All fields must be implicitly or explicitly final (Immutable) 
D) It cannot contain primitive types

**36. Can you use a `synchronized` block on a `value class` instance?** 
A) Yes, it behaves like any other object 
B) Yes, but only if it contains reference fields 
C) No, because it is strictly single-threaded 
D) No, because it lacks an object header and memory identity to lock onto

**37. How is an array of a `value class` (e.g., `Point[]`) stored in memory?** 
A) As an array of memory pointers to random heap locations 
B) As flattened, contiguous data directly in the array's memory block 
C) As a doubly-linked list 
D) It is not allowed to create arrays of value classes

**38. When you pass a `value class` instance to a method, what actually happens?** 
A) The JVM passes a 64-bit pointer to the Heap 
B) The JVM passes a copy of the actual data payload (stack/registers) 
C) The JVM creates a deep clone of the object on the Heap 
D) The method receives a proxy reference

**39. How does the `==` operator behave when comparing two `value class` instances?** 
A) It compares their memory addresses 
B) It performs a bitwise, field-by-field comparison of their data 
C) It automatically calls the `.equals()` method 
D) It throws a compilation error

**40. Are array objects of Value Classes passed to methods by copy or by pointer?** 
A) By copying the entire flattened array onto the stack 
B) By copying just the first element of the array 
C) Arrays of Value Classes cannot be passed to methods 
D) By pointer; the array itself is an Identity Object on the Heap, even though its contents are flattened


---

### Answer Key

1. **C** (To translate human-readable Java into platform-agnostic bytecode and enforce semantics)
    
2. **B** (Parse and Enter)
    
3. **C** (They can generate new source files but cannot modify existing ones)
    
4. **C** (Flow and Semantic Analysis)
    
5. **C** (Translates high-level syntactic sugar into basic bytecode equivalents)
    
6. **C** (`invokedynamic`)
    
7. **C** (No, it leaves hardware and runtime optimizations to the JVM's JIT compiler)
    
8. **C** (The original `.java` source code comments)
    
9. **D** (AppCDS - Application Class Data Sharing)
    
10. **B** (Linking)
    
11. **A** (Metaspace)
    
12. **B** (In native OS memory)
    
13. **B** (It manages heap memory concurrently, resulting in sub-millisecond pauses)
    
14. **C** (Initialization Phase)
    
15. **D** (The Bytecode Verifier during Linking)
    
16. **B** (By using Tiered Compilation - Interpreter + JIT)
    
17. **C** (Carrier Thread)
    
18. **A** (Continuation)
    
19. **D** (The Java Heap)
    
20. **C** (No, it happens entirely in user space within the JVM)
    
21. **C** (The JVM's internal ForkJoinPool scheduler)
    
22. **B** (It relies on efficient OS primitives like `epoll` or `kqueue`)
    
23. **A** (The JVM copies the thread's stack frames from the Heap back to a Carrier Thread)
    
24. **B** (It executes normally without pinning the carrier thread)
    
25. **C** (It allows the application to start immediately without waiting for compilation)
    
26. **B** (Profiling method invocations to identify "hot" code)
    
27. **B** (C2 / Graal Compiler)
    
28. **B** (Deoptimization - usually from a failed speculative assumption)
    
29. **B** (Copying the bytecode of a called method directly into the calling method)
    
30. **C** (Scalar Replacement)
    
31. **B** (It dismantles them and stores them in CPU registers or the native stack)
    
32. **B** (Devirtualization / Monomorphic Dispatch)
    
33. **A** (The divide between stack-allocated Primitives and heap-allocated References)
    
34. **C** (`value class`)
    
35. **C** (All fields must be implicitly or explicitly final / Immutable)
    
36. **D** (No, because it lacks an object header and memory identity to lock onto)
    
37. **B** (As flattened, contiguous data directly in the array's memory block)
    
38. **B** (The JVM passes a copy of the actual data payload via stack/registers)
    
39. **B** (It performs a bitwise, field-by-field comparison of their data)
    
40. **D** (By pointer; the array itself is an Identity Object on the Heap, even though its contents are flattened)