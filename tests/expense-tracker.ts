import * as anchor from "@coral-xyz/anchor";
import {Program} from "@coral-xyz/anchor";
import {ExpenseTracker} from "../target/types/expense_tracker";
// Imports the bn.js library, which is used for handling large numbers in JavaScript.
// Since Solana uses 64-bit integers (u64), which can exceed JavaScript's safe integer limit, BN is a necessary tool.
import BN from "bn.js";
import {assert} from "chai";
import {LAMPORTS_PER_SOL} from "@solana/web3.js";

describe("expense-tracker", () => {
    // Creates a new AnchorProvider instance, which is the client that connects to the Solana network.
    const provider = anchor.AnchorProvider.env();
    // Sets this provider as the global client for the test suite.
    anchor.setProvider(provider);

    // loads the compiled program from the anchor.workspace
    const program = anchor.workspace.expenseTracker as Program<ExpenseTracker>;

    // Creates a new Solana Keypair, which represents a public-private key pair.
    // This user will act as the authority for the transactions in the test,
    // making the test isolated and self-contained.
    const user = anchor.web3.Keypair.generate();

    // Test data
    const expenseId = new BN(1);
    const merchantName = "Cafe Shop";
    const amount = new BN(10);

    // Declares a variable to hold the public key of the PDA, which will be derived in the before block.
    let expenseAccountPDA: anchor.web3.PublicKey;
    let expenseAccountRent: number;

    // Helper function to get and log the balance of a public key
    const getBalance = async (pubkey: anchor.web3.PublicKey) => {
        return provider.connection.getBalance(pubkey);
    };

    before(async () => {
        // This is where the PDA address is derived.
        // It uses the same seeds as your Rust program: a hardcoded string ("expense"),
        // the user's public key, and the expense ID. The Sync variant runs synchronously
        // and returns the PDA's public key.
        [expenseAccountPDA] = anchor.web3.PublicKey.findProgramAddressSync(
            [
                anchor.utils.bytes.utf8.encode("expense"),
                user.publicKey.toBuffer(),
                expenseId.toBuffer("le", 8),
            ],
            program.programId
        );
        // Calculate the rent required for the PDA
        expenseAccountRent = await provider.connection.getMinimumBalanceForRentExemption(
            8 + 8 + 32 + (4 + 12) + 8 + 1 // The space of your ExpenseAccount struct
        );

        // Fund the user's account with 1SOL
        const airdropSignature = await provider.connection.requestAirdrop(user.publicKey, 1000000000);

        // A modern, best-practice way to get the latest blockhash and its expiry height.
        // This is crucial for creating and confirming robust transactions.
        const latestBlockhash = await provider.connection.getLatestBlockhash();
        // Confirms that the airdrop transaction has been processed by the network.
        await provider.connection.confirmTransaction({
            signature: airdropSignature,
            blockhash: latestBlockhash.blockhash,
            lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
        });
    });

    it("Is initialized!", async () => {
        // Check initial balances
        const userInitialBalance = await getBalance(user.publicKey);
        const programInitialBalance = await getBalance(program.programId);

        console.log("--- BEFORE TRANSACTION ---");
        console.log(`User balance: ${userInitialBalance / LAMPORTS_PER_SOL} SOL`);
        console.log(`Program balance: ${programInitialBalance / LAMPORTS_PER_SOL} SOL`);
        console.log(`PDA balance: ${await getBalance(expenseAccountPDA) / LAMPORTS_PER_SOL} SOL`);
        console.log("--------------------------\n");

        // Call the initialize_expense instruction
        const txSignature = await program.methods
            // Invokes the initializeExpense method on the program.
            .initializeExpense(expenseId, merchantName, amount)
            // Explicitly lists the on-chain accounts needed for this instruction.
            // This is a crucial step that tells the program which accounts to access.
            .accounts({
                expenseAccount: expenseAccountPDA,
                authority: user.publicKey,
                systemProgram: anchor.web3.SystemProgram.programId,
            })
            // Provides the user's keypair to sign the transaction, proving their authority.
            .signers([user])
            // Sends the transaction to the Solana network.
            .rpc();

        const latestBlockhash = await provider.connection.getLatestBlockhash();
        await provider.connection.confirmTransaction({
            signature: txSignature,
            blockhash: latestBlockhash.blockhash,
            lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
        });

        // Check balances after the transaction
        const userFinalBalance = await getBalance(user.publicKey);
        const programFinalBalance = await getBalance(program.programId);
        const pdaFinalBalance = await getBalance(expenseAccountPDA);

        console.log("--- AFTER TRANSACTION ---");
        console.log(`User balance: ${userFinalBalance / LAMPORTS_PER_SOL} SOL`);
        console.log(`Program balance: ${programFinalBalance / LAMPORTS_PER_SOL} SOL`);
        console.log(`PDA balance: ${pdaFinalBalance / LAMPORTS_PER_SOL} SOL`);
        console.log("-------------------------\n");
        assert.equal(programFinalBalance, programInitialBalance);
        assert.isTrue(
            userInitialBalance - userFinalBalance >= pdaFinalBalance,
            "User's balance should have decreased by rent plus a transaction fee"
        );

        // Fetch the account data from the blockchain.
        // Fetches the data from the PDA account that was just created.
        // This is a key step for verifying the transaction's outcome.
        const expenseAccount = await program.account.expenseAccount.fetch(expenseAccountPDA);

        // Assertions to verify the fetched data.
        assert.isTrue(expenseAccount.id.eq(expenseId), "The ID should match");
        assert.equal(expenseAccount.merchantName, merchantName, "The merchant name should match");
        assert.isTrue(expenseAccount.amount.eq(amount), "The amount should match");
        assert.isTrue(expenseAccount.owner.equals(user.publicKey), "The owner should be the user's public key");

        console.log("Your transaction signature", txSignature);
    });

    it("Modify Expense", async () => {
        // Check initial balances
        const userInitialBalance = await getBalance(user.publicKey);
        const programInitialBalance = await getBalance(program.programId);
        const pdaInitialBalance = await getBalance(expenseAccountPDA);

        console.log("--- BEFORE TRANSACTION ---");
        console.log(`User balance: ${userInitialBalance / LAMPORTS_PER_SOL} SOL`);
        console.log(`Program balance: ${programInitialBalance / LAMPORTS_PER_SOL} SOL`);
        console.log(`PDA balance: ${pdaInitialBalance / LAMPORTS_PER_SOL} SOL`);
        console.log("--------------------------\n");

        const modifiedMerchantName = "Petrol";
        const modifiedAmount = new BN(12570);

        // Call the modifyExpense instruction
        const txSignature = await program.methods
            // Invokes the modifyExpense method on the program.
            .modifyExpense(expenseId, modifiedMerchantName, modifiedAmount)
            // Explicitly lists the on-chain accounts needed for this instruction.
            // This is a crucial step that tells the program which accounts to access.
            .accounts({
                expenseAccount: expenseAccountPDA,
                authority: user.publicKey,
                systemProgram: anchor.web3.SystemProgram.programId,
            })
            // Provides the user's keypair to sign the transaction, proving their authority.
            .signers([user])
            // Sends the transaction to the Solana network.
            .rpc();

        const latestBlockhash = await provider.connection.getLatestBlockhash();
        await provider.connection.confirmTransaction({
            signature: txSignature,
            blockhash: latestBlockhash.blockhash,
            lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
        });

        // Check balances after the transaction
        const userFinalBalance = await getBalance(user.publicKey);
        const programFinalBalance = await getBalance(program.programId);
        const pdaFinalBalance = await getBalance(expenseAccountPDA);

        console.log("--- AFTER TRANSACTION ---");
        console.log(`User balance: ${userFinalBalance / LAMPORTS_PER_SOL} SOL`);
        console.log(`Program balance: ${programFinalBalance / LAMPORTS_PER_SOL} SOL`);
        console.log(`PDA balance: ${pdaFinalBalance / LAMPORTS_PER_SOL} SOL`);
        console.log("-------------------------\n");
        // the code does not contain any logic for transferring SOL between accounts,
        // so the pda balance should not change.
        assert.equal(programFinalBalance, programInitialBalance);
        assert.isTrue(
            userInitialBalance >= userFinalBalance,
            "User's balance should have decreased by a transaction fee"
        );
        assert.equal(pdaInitialBalance, pdaFinalBalance);

        // Fetch the account data from the blockchain.
        // Fetches the data from the PDA account that was just created.
        // This is a key step for verifying the transaction's outcome.
        const expenseAccount = await program.account.expenseAccount.fetch(expenseAccountPDA);

        // Assertions to verify the fetched data.
        assert.isTrue(expenseAccount.id.eq(expenseId), "The ID should match");
        assert.equal(expenseAccount.merchantName, modifiedMerchantName, "The merchant name should match");
        assert.isTrue(expenseAccount.amount.eq(modifiedAmount), "The amount should match");
        assert.isTrue(expenseAccount.owner.equals(user.publicKey), "The owner should be the user's public key");

        console.log("Your transaction signature", txSignature);
    });

    it("Fails to modify with wrong ID", async () => {
        // The correct ID for our existing PDA is `expenseId` (value: 1).
        // We'll create a new BN with a different value to trigger the error.
        const wrongExpenseId = new BN(2);
        const newMerchantName = "Wrong Store";
        const newAmount = new BN(50);

        try {
            // We are calling `modifyExpense` with `wrongExpenseId` (2),
            // but the `expenseAccountPDA` was derived using the original `expenseId` (1).
            // The on-chain program should detect this mismatch and throw our custom error.
            await program.methods
                .modifyExpense(wrongExpenseId, newMerchantName, newAmount)
                .accounts({
                    expenseAccount: expenseAccountPDA,
                    authority: user.publicKey,
                })
                .signers([user])
                .rpc();

            assert.fail("The transaction should have failed with an IdMismatch error.");
        } catch (error) {
            assert.isDefined(error.error, "The error object should have an 'error' property");
            const errorCode = error.error.errorCode;
            assert.equal(errorCode.code, "ConstraintSeeds", "The error code should be ConstraintSeeds.");
            assert.include(
                error.error.errorMessage,
                "A seeds constraint was violated",
                "The error message should match the seeds constraint violation."
            );
        }
    });

    it("Fetch expenses by owner", async () => {
        // At this point in the test suite, one expense account (ID 1) already exists for `user`.
        // Let's create a second one to demonstrate fetching multiple accounts with the filter.
        const secondExpenseId = new BN(2);
        const secondMerchantName = "Grocery Store";
        const secondAmount = new BN(25);

        // Derive PDA for the second expense
        const [secondExpensePDA] = anchor.web3.PublicKey.findProgramAddressSync(
            [
                anchor.utils.bytes.utf8.encode("expense"),
                user.publicKey.toBuffer(),
                secondExpenseId.toBuffer("le", 8),
            ],
            program.programId
        );

        // Create the second expense account
        await program.methods
            .initializeExpense(secondExpenseId, secondMerchantName, secondAmount)
            .accounts({
                expenseAccount: secondExpensePDA,
                authority: user.publicKey,
                systemProgram: anchor.web3.SystemProgram.programId,
            })
            .signers([user])
            .rpc();

        console.log("\nCreated a second expense account for filtering tests.");

        // Now, perform the fetch operation using a `memcmp` filter.
        // `memcmp` (memory compare) filters accounts based on their on-chain data.
        // - offset: 8 (discriminator) + 8 (id) = 16. This is the byte position where the `owner` public key begins.
        // - bytes: The Base58 representation of the public key we want to match.
        const fetchedExpenses = await program.account.expenseAccount.all([
            {
                memcmp: {
                    offset: 8 + 8,
                    bytes: user.publicKey.toBase58(),
                },
            },
        ]);

        // Assertions to verify the filter worked correctly.
        assert.equal(fetchedExpenses.length, 2, "Should fetch exactly two expense accounts for the user.");

        // Verify that both fetched accounts indeed belong to the correct owner.
        assert.isTrue(
            fetchedExpenses.every(exp => exp.account.owner.equals(user.publicKey)),
            "All fetched expenses must belong to the correct owner."
        );

        // For good measure, let's find and verify our specific expenses in the result.
        const originalExpense = fetchedExpenses.find(exp => exp.account.id.eq(expenseId));
        const newExpense = fetchedExpenses.find(exp => exp.account.id.eq(secondExpenseId));

        assert.isDefined(originalExpense, "The original expense (ID 1) should be in the fetched list.");
        assert.equal(originalExpense.account.merchantName, "Petrol", "The original expense's merchant name should be the modified one.");

        assert.isDefined(newExpense, "The newly created expense (ID 2) should be in the fetched list.");
        assert.equal(newExpense.account.merchantName, secondMerchantName, "The new expense's merchant name should be correct.");

        console.log("✅ Successfully fetched and filtered expenses by owner.");

        // Clean up the second expense so it doesn't interfere with the `Delete Expense` test.
        // The `Delete Expense` test is hardcoded to delete the expense with `expenseId` (ID 1).
        await program.methods
            .deleteExpense(secondExpenseId)
            .accounts({
                expenseAccount: secondExpensePDA,
                authority: user.publicKey,
            })
            .signers([user])
            .rpc();

        console.log("Cleaned up the second expense account.");
    });

    it("Delete Expense", async () => {
        // Check initial balances
        const userInitialBalance = await getBalance(user.publicKey);
        const programInitialBalance = await getBalance(program.programId);
        const pdaInitialBalance = await getBalance(expenseAccountPDA);

        console.log("--- BEFORE TRANSACTION ---");
        console.log(`User balance: ${userInitialBalance / LAMPORTS_PER_SOL} SOL`);
        console.log(`Program balance: ${programInitialBalance / LAMPORTS_PER_SOL} SOL`);
        console.log(`PDA balance: ${pdaInitialBalance / LAMPORTS_PER_SOL} SOL`);
        console.log("--------------------------\n");

        const modifiedMerchantName = "Petrol";
        const modifiedAmount = new BN(12570);

        // Call the deleteExpense instruction
        const txSignature = await program.methods
            // Invokes the deleteExpense method on the program.
            .deleteExpense(expenseId)
            // Explicitly lists the on-chain accounts needed for this instruction.
            // This is a crucial step that tells the program which accounts to access.
            .accounts({
                expenseAccount: expenseAccountPDA,
                authority: user.publicKey,
                systemProgram: anchor.web3.SystemProgram.programId,
            })
            // Provides the user's keypair to sign the transaction, proving their authority.
            .signers([user])
            // Sends the transaction to the Solana network.
            .rpc();

        const latestBlockhash = await provider.connection.getLatestBlockhash();
        await provider.connection.confirmTransaction({
            signature: txSignature,
            blockhash: latestBlockhash.blockhash,
            lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
        });

        // Check balances after the transaction
        const userFinalBalance = await getBalance(user.publicKey);
        const programFinalBalance = await getBalance(program.programId);
        const pdaFinalBalance = await getBalance(expenseAccountPDA);

        console.log("--- AFTER TRANSACTION ---");
        console.log(`User balance: ${userFinalBalance / LAMPORTS_PER_SOL} SOL`);
        console.log(`Program balance: ${programFinalBalance / LAMPORTS_PER_SOL} SOL`);
        console.log(`PDA balance: ${pdaFinalBalance / LAMPORTS_PER_SOL} SOL`);
        console.log("-------------------------\n");

        assert.equal(programFinalBalance, programInitialBalance);
        assert.isTrue(
            userFinalBalance <= userInitialBalance + pdaInitialBalance,
            "User's balance should be less than combined initial balance due to transaction fee"
        );
        assert.equal(pdaFinalBalance, 0);

        console.log("Your transaction signature", txSignature);

        try {
            await program.account.expenseAccount.fetch(expenseAccountPDA);

            assert.fail("The account was not deleted and a fetch call unexpectedly succeeded.");
        } catch (error) {
            const errorMessage = error.toString();

            assert.include(errorMessage, "Account does not exist", "Expected 'Account does not exist' error.");

            console.log("Account successfully deleted as expected.");
        }
    })
});
