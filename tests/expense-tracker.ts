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
});
