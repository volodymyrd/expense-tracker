use anchor_lang::prelude::*;

declare_id!("38P5X5bZni6nyT6yg329HyVeGKJr57U9cFPmYPoYdDo5");

#[program]
pub mod expense_tracker {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}

/// An on-chain account.
#[account]
#[derive(Default)]
pub struct ExpenseAccount {
    // Expense entries unique ID
    pub id: u64,
    // The owner value
    pub owner: Pubkey,
    // The merchant name
    pub merchant_name: String,
    // The spent amount
    pub amount: u64,
}
