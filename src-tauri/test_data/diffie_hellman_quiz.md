# Diffie-Hellman Key Exchange Quiz

#### 1. Once Alice and Bob have established their shared secret via DH, what is it typically used for?
A) It is used directly as a digital signature to prove their identities.
B) It serves as the key for symmetric encryption (e.g., AES) of subsequent messages.
C) It replaces the prime p for the next round of the exchange.
D) It is published so other parties can join the conversation securely.

#### 2. In the paint analogy, what does the initial common color (Yellow) that Alice and Bob agree on publicly correspond to in the actual protocol?
A) The private keys a and b chosen by each party.
B) The shared secret S computed at the end.
C) The exchanged public keys A and B.
D) The public parameters: the prime p and generator g.

### Answer Key and Explanations

| Q#  | Correct Answer | Explanation                                                                                                                                                                                                                                                                                                     |
| :-- | :------------: | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   |     **B**      | DH only solves *key agreement*. The resulting shared secret becomes the key for a symmetric cipher like AES, which then encrypts the actual communication. It is not a signature (A), is never published (D), and doesn't feed back into the parameters (C).                                                     |
| 2   |     **D**      | The publicly agreed Yellow maps to the **public parameters** p and g — the common starting point both parties build on. The private colors (Red/Blue) are the private keys, the mixes (Orange/Light Blue) are the public keys, and Brown is the shared secret.                                              |
