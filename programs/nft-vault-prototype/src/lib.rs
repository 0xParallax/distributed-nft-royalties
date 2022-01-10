use anchor_lang::prelude::*;
use anchor_lang::solana_program::system_instruction;
use anchor_lang::solana_program::program::{invoke_signed, invoke};

declare_id!("5GL4DTAqK5j4MFWkdrf51TGGvcFePMuLrDSpnAvfNgqT");

#[program]
pub mod nft_vault_prototype {

    use super::*;
    pub fn initialize_balance_ledger(ctx: Context<InitializeBalanceLedger>) -> ProgramResult {

        //ctx.accounts.vault.authority = *ctx.accounts.authority.key;
        Ok(())
    }

    pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> ProgramResult {

        //if *ctx.accounts.to.key != ctx.accounts.vault.authority {
        //    Err(error::ErrorCode(100))
        //}

        //assert_eq!(*ctx.accounts.to.key, ctx.accounts.vault.authority);

        //let ix = system_instruction::transfer(&ctx.accounts.pda.key, &ctx.accounts.to.key, amount);
//
        //invoke_signed(
        //    &ix, 
        //    &[ctx.accounts.system_program.to_account_info(), ctx.accounts.pda.to_account_info(), ctx.accounts.to.to_account_info()],
        //    &[&[b"vault", &[255]]],
        //)?;
        Ok(())
    }

    pub fn send(ctx: Context<Send>, amount: u64) -> ProgramResult {
        let ix = system_instruction::transfer(&ctx.accounts.from.key, &ctx.accounts.pda.key, amount);

        invoke(
            &ix, 
            &[ctx.accounts.system_program.to_account_info(), ctx.accounts.pda.to_account_info(), ctx.accounts.from.to_account_info()],
        )?;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeBalanceLedger<'info> {
    #[account(init, payer = payer, space = 9000, seeds = [b"balance-ledger"], bump = 254)]
    nft_balance_ledger: Account<'info, NftBalanceLedger>,
    #[account(mut)]
    payer: Signer<'info>,
    system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(mut)]
    to: SystemAccount<'info>,
    #[account(mut)]
    pda: SystemAccount<'info>,
    vault: Account<'info, NftBalanceLedger>,
    system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Send<'info> {
    #[account(mut)]
    from: Signer<'info>,
    #[account(mut)]
    pda: SystemAccount<'info>,
    vault: Account<'info, NftBalanceLedger>,
    system_program: Program<'info, System>,
}

#[account]
pub struct NftBalanceLedger {
    pub nft_balances: Vec<NftBalance>,
    pub size: u64,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct NftBalance {
    pub nft_address: String,
    pub royalties_balance: u64,
}

impl NftBalanceLedger {
    fn distribute_payments(&self, amount: u64) {
        
    }
    
    fn add_nft_to_ledger(&self, nft_address: String) {

    }
}

