use anchor_lang::prelude::*;
use anchor_lang::solana_program::system_instruction;
use anchor_lang::solana_program::program::{invoke_signed, invoke};

declare_id!("5GL4DTAqK5j4MFWkdrf51TGGvcFePMuLrDSpnAvfNgqT");

#[program]
pub mod nft_vault_prototype {

    use super::*;
    pub fn initialize_vault(ctx: Context<InitializeVault>) -> ProgramResult {

        ctx.accounts.vault.authority = *ctx.accounts.authority.key;
        Ok(())
    }

    pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> ProgramResult {

        //if *ctx.accounts.to.key != ctx.accounts.vault.authority {
        //    Err(error::ErrorCode(100))
        //}

        assert_eq!(*ctx.accounts.to.key, ctx.accounts.vault.authority);

        let ix = system_instruction::transfer(&ctx.accounts.pda.key, &ctx.accounts.to.key, amount);

        invoke_signed(
            &ix, 
            &[ctx.accounts.system_program.to_account_info(), ctx.accounts.pda.to_account_info(), ctx.accounts.to.to_account_info()],
            &[&[b"test", &[253]]],
        )?;
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
pub struct InitializeVault<'info> {
    #[account(init, payer = authority, space = 128)]
    vault: Account<'info, Vault>,
    #[account(signer, mut)]
    authority: AccountInfo<'info>,
    system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(mut)]
    to: SystemAccount<'info>,
    #[account(mut)]
    pda: SystemAccount<'info>,
    vault: Account<'info, Vault>,
    system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Send<'info> {
    #[account(mut)]
    from: Signer<'info>,
    #[account(mut)]
    pda: SystemAccount<'info>,
    vault: Account<'info, Vault>,
    system_program: Program<'info, System>,
}

#[account]
pub struct Vault {
    pub authority: Pubkey,
    pub amount: u64,
}


