# iFrame and postMessage Quiz

Reference: [iFrame.md](../iFrame.md)

1. **Foundational**: What is the primary intent of using an iframe?
A) To execute scripts securely in the background.
B) To compose a webpage from disparate sources without conflict.
C) To improve the parsing speed of large HTML documents.
D) To cache external assets efficiently.

2. **Foundational**: Which security policy restricts an iframe from accessing its host page's DOM by default?
A) Content Security Policy (CSP)
B) Cross-Origin Resource Sharing (CORS)
C) Same-Origin Policy (SOP)
D) HTTP Strict Transport Security (HSTS)

3. **Foundational**: What attribute is used to explicitly grant capabilities back to an iframe after they've been stripped away?
A) `allow`
B) `sandbox`
C) `permissions`
D) `access`

4. **Intermediate**: If you omit the `sandbox` attribute entirely when declaring an iframe, what is the result?
A) The iframe has all standard privileges, like running scripts and submitting forms.
B) The iframe is completely restricted and cannot run any scripts.
C) The iframe content fails to load due to a security exception.
D) The iframe requires a Content Security Policy header to function.

5. **Intermediate**: How do a host page and an embedded cross-origin iframe communicate securely?
A) By reading from a shared LocalStorage object.
B) By using the `window.postMessage` API to send and receive events.
C) By mutating a specific shared variable in the global window object.
D) By accessing the inner `contentDocument` object directly.

6. **Intermediate**: When setting up an event listener for `message` to receive data from an iframe, what is the most critical first step?
A) Checking if the payload size exceeds typical limits.
B) Parsing the payload string into a JSON object.
C) Validating that the `event.origin` matches the expected source.
D) Confirming that `event.source` is equal to `window.parent`.

7. **Advanced**: Why is it highly recommended to avoid combining `allow-scripts` and `allow-same-origin` in an iframe's sandbox attribute?
A) It causes the browser to disable the `postMessage` API entirely for that frame.
B) It triggers immediate CORS preflight failures for all embedded resources.
C) It causes the browser to disable all JavaScript.
D) It allows the iframe to programmatically remove its own sandbox restrictions.

8. **Advanced**: You need to implement a highly performant dashboard with dozens of encapsulated UI components created internally. What is the best architectural choice?
A) Use an iframe for each component to ensure strict styling encapsulation.
B) Use Web Components or a modern UI framework instead of iframes.
C) Use iframes with `loading="lazy"` to defer the performance cost.
D) Use iframes, but omit the `sandbox` attribute to save memory.

---

## Answers and Explanations

1. **Answer**: B
   **Explanation**: An iframe allows embedding another HTML document within the current one. The main benefit is composition without conflict, meaning you can integrate things like a payment widget without its CSS or JS interfering with your main page.

2. **Answer**: C
   **Explanation**: The Same-Origin Policy (SOP) is the fundamental browser security mechanism that prevents documents from different origins from reading or modifying each other's DOM directly.

3. **Answer**: B
   **Explanation**: Applying the `sandbox` attribute (e.g., `sandbox=""`) restricts all capabilities. You then explicitly add tokens like `allow-scripts` within the `sandbox` attribute to grant specific permissions back.

4. **Answer**: A
   **Explanation**: By default, without the `sandbox` attribute, an iframe retains its standard capabilities. It can trigger pop-ups, execute JavaScript, submit forms, and generally act like a normal browsing context.

5. **Answer**: B
   **Explanation**: Because direct DOM access is blocked by the Same-Origin Policy, the secure and modern way to exchange data across origins is via `window.postMessage`.

6. **Answer**: C
   **Explanation**: The most critical security step is validating `event.origin`. Because the `message` event listener catches messages from anywhere, you must verify the message actually came from the trusted iframe or host.

7. **Answer**: D
   **Explanation**: Combining `allow-scripts` (letting it run JS) and `allow-same-origin` (letting it act like it's from the same origin as its source) enables a malicious iframe to access its own element in the host DOM and strip away its sandbox restrictions.

8. **Answer**: B
   **Explanation**: iFrames are heavyweight because each requires a separate browsing context, parsing, and memory allocation. For internal UI composition, Web Components or a framework like React/Vue provide encapsulation with vastly superior performance compared to dozens of iframes.
