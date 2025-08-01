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
