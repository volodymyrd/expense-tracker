# Expense Tracker

Learn how to create an expense tracker app and understand PDAs

## About

PDAs are a very powerful block of Solana. We're going to create a simple expense tracking app that allows us to add,
update and remove expense entries. This tutorial is based
on [Expense Tracker Workshop](https://github.com/GitBolt/expense-tracker-workshop). You can find full client side
code there with table and chart as well.

### Init wallet

```
solana-keygen new -o wallet/id.json
```

```
solana airdrop -u devnet 5 nh62Mg5sAdddJCt8hGZTLLMry6NC5gswgFVmNdL1DEN
```

```
solana balance -u devnet nh62Mg5sAdddJCt8hGZTLLMry6NC5gswgFVmNdL1DEN
```

### How state is managed in Solana programs

**Step 1: Creating the First `ExpenseAccount`**

This is the creation of a new, empty data record.

**1. Client-Side Preparation:**

- The user's application (client) determines the unique identifier for the first expense, let's say 1.

- The client calculates the PDA address. It takes the program's ID and a set of "seeds" (e.g., the user's public key and
  the unique expense ID 1) and runs a cryptographic hash function. This generates the unique, off-curve address for this
  specific ExpenseAccount.

- The client creates a new transaction. This transaction will contain an instruction to call the program's
  create_expense
  function.

**2. Transaction Execution:**

- The user signs and sends the transaction to the Solana network.

- The program receives this transaction. The Anchor framework automatically sees the #[account(init,
  seeds = [...], ...)]
  constraint on your ExpenseAccount struct.

- Acting with its own authority (because it owns the PDA address), the program performs a Cross-Program Invocation (CPI)
  to the SystemProgram.

- The SystemProgram creates a new, empty account at the specific PDA address the program requested. The program pays the
  rent for this new account using the user's funds, which were also included in the transaction.

- The program then serializes the data (id: 1, owner: user_pubkey, etc.) and writes it into the data field of this newly
  created PDA account.

**3. Storage on the Ledger:**

- A new block is added to the blockchain. This block contains the transaction that created the account.

- The ledger now has a new, permanent record. The key is the unique PDA address, and the value is the ExpenseAccount
  data
  you defined.

**Step 2: Creating a Second `ExpenseAccount`**

This process is nearly identical to the first, but it highlights the importance of the unique ID.

**1. Client-Side Preparation:**

- The client determines the next unique ID, 2.

- It calculates a new, different PDA address using the same seeds, but with the updated expense ID (user_pubkey, 2).

- It creates a new transaction, calling the create_expense function.

**2. Transaction Execution:**

- The program receives the transaction. Because the init instruction is used and the PDA address for expense 2 does not
  yet exist, the program follows the same steps as before.

- A brand new PDA account is created on the ledger, this time at the address derived from user_pubkey and 2.

**3. Storage on the Ledger:**

- The blockchain's state now holds two distinct accounts: one for expense 1 and one for expense 2.

**Step 3: Modifying the First `ExpenseAccount`**

This process is fundamentally different because it modifies an existing account, rather than creating a new one.

**1. Client-Side Preparation:**

- The client wants to modify the account with ID 1.

- It calculates the exact same PDA address as before, using the seeds (user_pubkey, 1). This is how the client knows
  which
  specific on-chain account to target.

- The client creates a new transaction. This transaction will contain an instruction to call a different function in the
  program, perhaps an update_expense function. The transaction must also include a special #[account(mut)] instruction,
  which signals that the targeted account will be modified.

**2. Transaction Execution:**

- The user signs and sends the transaction.

- The program receives the transaction. Anchor validates that the PDA account for user_pubkey and 1 is the one that was
  passed in.

- Crucially, because the account already exists, the program does not create a new account. Instead, it deserializes the
  existing data from the on-chain account into an ExpenseAccount struct in its memory.

- The program's code then modifies the fields in the struct (e.g., updates the merchant_name or amount).

- Finally, the program serializes the modified ExpenseAccount struct back into a byte array and writes it to the data
  field of the existing on-chain PDA account.

**3. Storage on the Ledger:**

- A new block is added to the blockchain, but this time, it records a change to an existing account, not the creation of
  a new one. The data at the PDA address for expense 1 is updated, and the old version of that data is now part of the
  permanent history of the blockchain. The record for expense 2 remains completely untouched.

**The PDA address serves as the key in the Solana ledger's key-value store.**

- Key: The PDA address (a unique 32-byte public key).
- Value: The account's data structure, which holds the serialized content of your ExpenseAccount struct.
